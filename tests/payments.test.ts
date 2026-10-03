/**
 * Buying packs (migration 020), checked as real signed-in users with
 * row-level security on. Packs and prices here are made up.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase, type TestDatabase } from './support/db'

const BUYER = '44444444-4444-4444-4444-444444444444'
const TRIALIST = '55555555-5555-5555-5555-555555555555'
const OTHER = '66666666-6666-6666-6666-666666666666'

let t: TestDatabase

/** An order as the Edge Function writes it when checkout starts. */
async function order(id: string, user: string, pack = 'p1') {
  await t.asAdmin(
    `INSERT INTO payment_orders (id, user_id, pack_id, pack_name, months, currency, amount, tax_amount)
     SELECT $1, $2, id, name, months, currency, total, tax_amount FROM packs WHERE id = $3`,
    [id, user, pack]
  )
}

const plans = async (user: string) =>
  (
    await t.asAdmin<{ source: string; starts: string; ends: string; payment_ref: string | null }>(
      `SELECT source, starts_at::date::text AS starts, expires_at::date::text AS ends, payment_ref
       FROM entitlements WHERE user_id = $1 ORDER BY starts_at, created_at`,
      [user]
    )
  ).rows

beforeAll(async () => {
  t = await createTestDatabase()
  await t.asAdmin(`UPDATE instance_config SET billing_enabled = true, trial_days = 14`)
  await t.addUser(BUYER)
  await t.addUser(TRIALIST)
  await t.addUser(OTHER)
  await t.asAdmin('DELETE FROM entitlements WHERE user_id IN ($1, $2)', [BUYER, OTHER])
  await t.asAdmin(`
    INSERT INTO packs (id, name, months, currency, amount, tax_percent, tax_name, sort) VALUES
      ('p1', '1 month', 1, 'XTS', 10000, 18, 'Tax', 1),
      ('p6', '6 months', 6, 'XTS', 50000, 0, NULL, 2),
      ('old', 'Old pack', 3, 'XTS', 20000, 0, NULL, 3)`)
  await t.asAdmin(`UPDATE packs SET active = false WHERE id = 'old'`)
})

describe('packs', () => {
  it('work out the tax and the total from the price', async () => {
    const { rows } = await t.asAdmin<{ id: string; tax_amount: string; total: string }>(
      `SELECT id, tax_amount::text, total::text FROM packs ORDER BY sort`
    )
    expect(rows.slice(0, 2)).toEqual([
      { id: 'p1', tax_amount: '1800', total: '11800' },
      { id: 'p6', tax_amount: '0', total: '50000' },
    ])
  })

  it('show signed-in users only the ones on sale, and nothing to visitors', async () => {
    const { rows } = await t.asUser<{ id: string }>(BUYER, 'SELECT id FROM packs ORDER BY sort')
    expect(rows.map((r) => r.id)).toEqual(['p1', 'p6'])
    await t.db.exec('SET ROLE anon')
    try {
      await expect(t.db.query('SELECT id FROM packs')).rejects.toThrow(/permission denied/)
    } finally {
      await t.db.exec('RESET ROLE')
    }
  })

  it("can't be changed, and orders can't be written, by signed-in users", async () => {
    await expect(t.asUser(BUYER, `UPDATE packs SET amount = 1 WHERE id = 'p1'`)).rejects.toThrow(/permission denied/)
    await expect(
      t.asUser(BUYER, `INSERT INTO payment_orders (id, user_id, pack_id, pack_name, months, currency, amount)
                       VALUES ('order_x', $1, 'p1', '1 month', 1, 'XTS', 1)`, [BUYER])
    ).rejects.toThrow(/permission denied/)
  })
})

describe('recording a payment', () => {
  it('turns a paid order into a plan that starts now', async () => {
    await order('order_1', BUYER, 'p1')
    await t.asAdmin(`SELECT record_payment('order_1', 'pay_1')`)
    const [plan] = await plans(BUYER)
    expect(plan).toMatchObject({ source: 'purchase', payment_ref: 'pay_1' })
    const { rows } = await t.asAdmin<{ starts_now: boolean; one_month: boolean }>(
      `SELECT starts_at > now() - interval '1 minute' AS starts_now,
              expires_at = starts_at + interval '1 month' AS one_month
       FROM entitlements WHERE payment_ref = 'pay_1'`
    )
    expect(rows[0]).toEqual({ starts_now: true, one_month: true })
    const paid = await t.asUser<{ status: string; payment_id: string }>(BUYER, 'SELECT status, payment_id FROM payment_orders')
    expect(paid.rows).toEqual([{ status: 'paid', payment_id: 'pay_1' }])
  })

  it('gives one plan however many times the same payment is reported', async () => {
    await t.asAdmin(`SELECT record_payment('order_1', 'pay_1')`)
    expect(await plans(BUYER)).toHaveLength(1)
    await expect(t.asAdmin(`SELECT record_payment('order_1', 'pay_other')`)).rejects.toThrow(/another payment/)
    await expect(t.asAdmin(`SELECT record_payment('order_unknown', 'pay_2')`)).rejects.toThrow(/Unknown order/)
  })

  it('starts a pack bought early when the current one ends, so nothing is lost', async () => {
    await order('order_2', BUYER, 'p6')
    await t.asAdmin(`SELECT record_payment('order_2', 'pay_2')`)
    const [first, second] = await plans(BUYER)
    expect(second.starts).toBe(first.ends)
    const { rows } = await t.asAdmin<{ six_months: boolean }>(
      `SELECT expires_at = starts_at + interval '6 months' AS six_months FROM entitlements WHERE payment_ref = 'pay_2'`
    )
    expect(rows[0].six_months).toBe(true)
  })

  it('starts after a free trial', async () => {
    await order('order_3', TRIALIST, 'p1')
    await t.asAdmin(`SELECT record_payment('order_3', 'pay_3')`)
    const [trial, pack] = await plans(TRIALIST)
    expect(trial.source).toBe('trial')
    expect(pack.starts).toBe(trial.ends)
  })

  it("starts now when the only other plan is a demo's day (migration 023)", async () => {
    const converted = '77777777-7777-4777-8777-777777777777'
    await t.addUser(converted)
    await t.asAdmin('DELETE FROM entitlements WHERE user_id = $1', [converted])
    await t.asAdmin(
      `INSERT INTO entitlements (user_id, source, expires_at, note) VALUES ($1, 'demo', now() + interval '1 day', 'Demo')`,
      [converted]
    )
    await order('order_5', converted, 'p1')
    await t.asAdmin(`SELECT record_payment('order_5', 'pay_5')`)
    const { rows } = await t.asAdmin<{ starts_now: boolean }>(
      `SELECT starts_at < now() + interval '1 minute' AS starts_now FROM entitlements WHERE payment_ref = 'pay_5'`
    )
    expect(rows).toEqual([{ starts_now: true }])
  })

  it("isn't something signed-in users can call, even for their own order", async () => {
    await order('order_4', OTHER, 'p1')
    await expect(t.asUser(OTHER, `SELECT record_payment('order_4', 'pay_4')`)).rejects.toThrow(/permission denied/)
    expect(await plans(OTHER)).toEqual([])
  })

  it("only shows users their own payments", async () => {
    const { rows } = await t.asUser<{ id: string }>(OTHER, 'SELECT id FROM payment_orders')
    expect(rows).toEqual([{ id: 'order_4' }])
  })
})
