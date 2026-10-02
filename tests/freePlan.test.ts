/**
 * The Free plan (migration 019): after a trial or plan ends, an account can
 * still move its cheques along and edit notes, but can't add or change
 * anything else, or import. Checked as real signed-in users with row-level
 * security on. Data here is made up.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase, type TestDatabase } from './support/db'

const FREE = 'bbbbbbbb-0000-4000-8000-000000000001'
const TRIAL = 'bbbbbbbb-0000-4000-8000-000000000002'
const PAID = 'bbbbbbbb-0000-4000-8000-000000000003'

let t: TestDatabase
let party: string
let account: string

async function givenCheque(number: string, status?: 'RETURNED'): Promise<string> {
  const { rows } = await t.asUser<{ id: string }>(
    FREE,
    `INSERT INTO cheques (user_id, party_id, cheque_number, bank_name, amount, issue_date, due_date)
     VALUES ($1, $2, $3, 'Northwind Bank', 10000, '2026-09-01', '2026-10-01') RETURNING id`,
    [FREE, party, number]
  )
  const id = rows[0].id
  if (status === 'RETURNED') {
    await t.asUser(FREE, `SELECT change_cheque_status($1, 'RETURNED', 'manual', NULL, 'Funds insufficient')`, [id])
  }
  return id
}

async function receivedCheque(number: string): Promise<string> {
  const { rows } = await t.asUser<{ id: string }>(
    FREE,
    `INSERT INTO received_cheques (user_id, party_id, cheque_number, bank_name, amount, received_on, cheque_date, due_date)
     VALUES ($1, $2, $3, 'Payer Bank', 25000, '2026-09-01', '2026-10-01', '2026-10-01') RETURNING id`,
    [FREE, party, number]
  )
  return rows[0].id
}

const given = async (id: string) =>
  (await t.asAdmin<{ status: string; due_date: string; notes: string | null }>(
    `SELECT status, due_date::text, notes FROM cheques WHERE id = $1`, [id])).rows[0]

const received = async (id: string) =>
  (await t.asAdmin<{ status: string }>('SELECT status FROM received_cheques WHERE id = $1', [id])).rows[0].status

// Made while the account had a plan; the plan is taken away in beforeAll.
let g: Record<'fund' | 'deposit' | 'returned' | 'writeOff' | 'edit', string>
let r: Record<'clear' | 'bounce' | 'settle' | 'handBack' | 'replace' | 'undo', string>

beforeAll(async () => {
  t = await createTestDatabase()
  await t.asAdmin(`UPDATE instance_config SET billing_enabled = true, trial_days = 30`)
  for (const id of [FREE, TRIAL, PAID]) await t.addUser(id)

  // FREE starts with a grant, sets up some data, then loses it.
  await t.asAdmin(`DELETE FROM entitlements WHERE user_id = $1`, [FREE])
  await t.asAdmin(`INSERT INTO entitlements (user_id, source, note) VALUES ($1, 'comp', 'Setting up')`, [FREE])
  party = (await t.asUser<{ id: string }>(FREE, `INSERT INTO parties (user_id, name) VALUES ($1, 'Party A') RETURNING id`, [FREE])).rows[0].id
  account = (
    await t.asUser<{ id: string }>(
      FREE,
      `INSERT INTO bank_accounts (user_id, name, bank_name, is_default) VALUES ($1, 'Current', 'Northwind Bank', true) RETURNING id`,
      [FREE]
    )
  ).rows[0].id
  g = {
    fund: await givenCheque('100001'),
    deposit: await givenCheque('100002'),
    returned: await givenCheque('100003', 'RETURNED'),
    writeOff: await givenCheque('100004', 'RETURNED'),
    edit: await givenCheque('100005'),
  }
  r = {
    clear: await receivedCheque('200001'),
    bounce: await receivedCheque('200002'),
    settle: await receivedCheque('200003'),
    handBack: await receivedCheque('200004'),
    replace: await receivedCheque('200005'),
    undo: await receivedCheque('200006'),
  }
  await t.asAdmin(`DELETE FROM entitlements WHERE user_id = $1`, [FREE])

  // PAID has a pack; TRIAL keeps the trial it got at sign-up.
  await t.asAdmin(
    `INSERT INTO entitlements (user_id, source, expires_at, payment_ref) VALUES ($1, 'purchase', now() + interval '30 days', 'pay_free_plan_test')`,
    [PAID]
  )
})

describe('on the Free plan, an account can still', () => {
  it('move given cheques along, and undo', async () => {
    await t.asUser(FREE, `SELECT change_cheque_status($1, 'DEPOSITED')`, [g.fund])
    await t.asUser(FREE, `SELECT change_cheque_status($1, 'PASSED')`, [g.fund])
    expect((await given(g.fund)).status).toBe('PASSED')
    await t.asUser(FREE, `SELECT rollback_cheque_status($1)`, [g.fund])
    expect((await given(g.fund)).status).toBe('DEPOSITED')
  })

  it('present a returned cheque again, or write one off', async () => {
    await t.asUser(FREE, `SELECT represent_cheque($1, '2026-10-20')`, [g.returned])
    expect(await given(g.returned)).toMatchObject({ status: 'PENDING', due_date: '2026-10-20' })
    await t.asUser(FREE, `SELECT write_off_cheque($1, 'Party closed')`, [g.writeOff])
    expect((await given(g.writeOff)).status).toBe('WRITTEN_OFF')
  })

  it('add funds for the cheques they cover', async () => {
    await t.asUser(FREE, `SELECT record_deposit(10000, '2026-10-01', ARRAY[$1]::uuid[], NULL, $2)`, [g.deposit, account])
    expect((await given(g.deposit)).status).toBe('DEPOSITED')
  })

  it('move received cheques along, and undo', async () => {
    await t.asUser(FREE, `SELECT deposit_received_cheques(ARRAY[$1, $2]::uuid[], '2026-10-01', $3)`, [r.clear, r.bounce, account])
    await t.asUser(FREE, `SELECT clear_received_cheques(ARRAY[$1]::uuid[], '2026-10-03')`, [r.clear])
    await t.asUser(FREE, `SELECT bounce_received_cheque($1, '2026-10-03', 'Funds insufficient')`, [r.bounce])
    await t.asUser(FREE, `SELECT redeposit_received_cheque($1, '2026-10-10')`, [r.bounce])
    await t.asUser(FREE, `SELECT settle_received_cheque($1, 'TRANSFER', '2026-10-05', 'UTR123')`, [r.settle])
    await t.asUser(FREE, `SELECT hand_back_received_cheque($1, 'Lease ended')`, [r.handBack])
    expect([await received(r.clear), await received(r.bounce), await received(r.settle), await received(r.handBack)]).toEqual([
      'CLEARED',
      'DEPOSITED',
      'SETTLED',
      'HANDED_BACK',
    ])
    await t.asUser(FREE, `SELECT deposit_received_cheques(ARRAY[$1]::uuid[], '2026-10-01')`, [r.undo])
    await t.asUser(FREE, `SELECT rollback_received_cheque($1)`, [r.undo])
    expect(await received(r.undo)).toBe('IN_HAND')
  })

  it('edit notes', async () => {
    await t.asUser(FREE, `UPDATE cheques SET notes = 'Call before the date' WHERE id = $1`, [g.edit])
    expect((await given(g.edit)).notes).toBe('Call before the date')
    await t.asUser(FREE, `UPDATE received_cheques SET notes = 'Rent for October' WHERE id = $1`, [r.replace])
  })

  it('read everything and change its settings', async () => {
    const { rows } = await t.asUser<{ n: number }>(FREE, 'SELECT count(*)::int AS n FROM received_cheque_history')
    expect(rows[0].n).toBeGreaterThan(0)
    await t.asUser(FREE, `UPDATE settings SET timezone = 'Asia/Kolkata' WHERE user_id = $1`, [FREE])
  })
})

describe("on the Free plan, an account can't", () => {
  it('add cheques, parties or bank accounts', async () => {
    await expect(givenCheque('100099')).rejects.toThrow(/row-level security/)
    await expect(receivedCheque('200099')).rejects.toThrow(/row-level security/)
    await expect(t.asUser(FREE, `INSERT INTO parties (user_id, name) VALUES ($1, 'Party B')`, [FREE])).rejects.toThrow(/row-level security/)
    await expect(
      t.asUser(FREE, `INSERT INTO bank_accounts (user_id, name, bank_name) VALUES ($1, 'Savings', 'Northwind Bank')`, [FREE])
    ).rejects.toThrow(/row-level security/)
  })

  it('take a new cheque in place of one', async () => {
    await expect(
      t.asUser(FREE, `SELECT replace_received_cheque($1, '200100', 'Payer Bank', 25000, '2026-10-20', '2026-10-05')`, [r.replace])
    ).rejects.toThrow(/Free plan/)
    expect(await received(r.replace)).toBe('IN_HAND')
  })

  it('change anything but notes, or delete', async () => {
    const refused = [
      `UPDATE cheques SET amount = 99999 WHERE id = $1`,
      `UPDATE cheques SET due_date = '2026-12-01' WHERE id = $1`,
      `UPDATE cheques SET cheque_number = '999999' WHERE id = $1`,
      `UPDATE cheques SET deleted_at = now() WHERE id = $1`,
    ]
    for (const sql of refused) await expect(t.asUser(FREE, sql, [g.edit])).rejects.toThrow(/Free plan/)
    await expect(t.asUser(FREE, `UPDATE received_cheques SET amount = 1 WHERE id = $1`, [r.replace])).rejects.toThrow(/Free plan/)
    await expect(t.asUser(FREE, `UPDATE parties SET name = 'Renamed' WHERE id = $1`, [party])).resolves.toMatchObject({ affectedRows: 0 })
  })

  it('write history or funds added by hand', async () => {
    await expect(
      t.asUser(FREE, `INSERT INTO cheque_history (cheque_id, from_status, to_status, changed_by) VALUES ($1, 'PENDING', 'PASSED', 'manual')`, [g.edit])
    ).rejects.toThrow(/row-level security/)
    await expect(
      t.asUser(FREE, `INSERT INTO daily_deposits (user_id, amount, deposit_date) VALUES ($1, 500, '2026-10-01')`, [FREE])
    ).rejects.toThrow(/row-level security/)
  })

  it('add funds that cover no cheques', async () => {
    await expect(t.asUser(FREE, `SELECT record_deposit(1000, '2026-10-01')`)).rejects.toThrow(/Tick at least one/)
  })

  it('import an export', async () => {
    await expect(t.asUser(FREE, `SELECT import_data('{"parties": [{"name": "X"}]}'::jsonb)`)).rejects.toThrow(/Business plan/)
  })
})

describe('around the Free plan', () => {
  it("doesn't let a free trial import, but does a paid plan", async () => {
    await expect(t.asUser(TRIAL, `SELECT import_data('{"parties": [{"name": "X"}]}'::jsonb)`)).rejects.toThrow(/Business plan/)
    const { rows } = await t.asUser<{ result: { parties: number } }>(
      PAID,
      `SELECT import_data('{"parties": [{"name": "Imported party"}]}'::jsonb) AS result`
    )
    expect(rows[0].result.parties).toBe(1)
  })

  it('leaves jobs with no signed-in user alone', async () => {
    await t.asAdmin(`UPDATE cheques SET amount = 12000 WHERE id = $1`, [g.edit])
  })

  it('gives everything back with a plan, and with billing off', async () => {
    await t.asAdmin(`INSERT INTO entitlements (user_id, source, note) VALUES ($1, 'comp', 'Back')`, [FREE])
    await t.asUser(FREE, `UPDATE cheques SET amount = 15000 WHERE id = $1`, [g.edit])
    await t.asAdmin(`DELETE FROM entitlements WHERE user_id = $1`, [FREE])
    await t.asAdmin(`UPDATE instance_config SET billing_enabled = false`)
    try {
      await t.asUser(FREE, `INSERT INTO parties (user_id, name) VALUES ($1, 'Party C')`, [FREE])
      await t.asUser(FREE, `UPDATE cheques SET amount = 16000 WHERE id = $1`, [g.edit])
    } finally {
      await t.asAdmin(`UPDATE instance_config SET billing_enabled = true`)
    }
  })

  it('calls the paid plan Business', async () => {
    const { rows } = await t.asAdmin<{ plan: string }>(`SELECT DISTINCT plan FROM entitlements`)
    expect(rows.map((row) => row.plan)).toEqual(['business'])
  })
})
