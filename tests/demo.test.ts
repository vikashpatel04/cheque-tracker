/**
 * The demo (migration 023): an anonymous sign-in gets a private account that
 * start_demo() fills, and that end_demo() or a day deletes. Checked as real
 * signed-in users with row-level security on. Data here is made up.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { REGION_PRESETS } from '@/config/regions'
import { receivedAlerts } from '@/lib/receivedSchedule'
import { regionFromPreset, regionToSettings } from '@/lib/region'
import type { ReceivedCheque } from '@/types/received'
import { createTestDatabase, type TestDatabase } from './support/db'

/** What the app sends: the settings columns of a region preset. */
const REGION = regionToSettings(regionFromPreset(REGION_PRESETS[0]))

const REAL = 'eeeeeeee-0000-4000-8000-000000000001'

let t: TestDatabase
let next = 0

/** A new anonymous sign-in, as Supabase Auth creates one. */
async function anonymous(database = t, createdAt?: string): Promise<string> {
  const id = `dddddddd-0000-4000-8000-${String(++next).padStart(12, '0')}`
  await database.addUser(id, null, { anonymous: true, createdAt })
  return id
}

const startDemo = (user: string, region: object = REGION, database = t) =>
  database.asUser(user, 'SELECT start_demo($1::jsonb)', [JSON.stringify(region)])

async function count(table: string, user: string, database = t): Promise<number> {
  const { rows } = await database.asAdmin<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE user_id = $1`, [user])
  return rows[0].n
}

const writeAccess = async (user: string, database = t) =>
  (await database.asUser<{ w: boolean }>(user, 'SELECT has_write_access() AS w')).rows[0].w

const addParty = (user: string, name: string, database = t) =>
  database.asUser(user, 'INSERT INTO parties (user_id, name) VALUES ($1, $2)', [user, name])

beforeAll(async () => {
  t = await createTestDatabase()
  await t.addUser(REAL)
})

describe('starting a demo', () => {
  let demo: string
  let today: string

  beforeAll(async () => {
    demo = await anonymous()
    await startDemo(demo)
    const { rows } = await t.asAdmin<{ today: string }>('SELECT (now() AT TIME ZONE $1)::date::text AS today', [REGION.timezone])
    today = rows[0].today
  })

  it('sets the region it was given, both directions, and leaves the tour to start', async () => {
    const { rows } = await t.asUser(demo, 'SELECT country_code, currency_code, timezone, tracks, tour_done_at FROM settings')
    expect(rows).toEqual([
      { country_code: REGION.country_code, currency_code: REGION.currency_code, timezone: REGION.timezone, tracks: 'both', tour_done_at: null },
    ])
  })

  it('gives one day of Business, marked as the demo', async () => {
    const { rows } = await t.asUser<{ plan: string; source: string; hours: number }>(
      demo,
      `SELECT plan, source, round(extract(epoch FROM expires_at - starts_at) / 3600)::int AS hours FROM entitlements`
    )
    expect(rows).toEqual([{ plan: 'business', source: 'demo', hours: 24 }])
    expect(await writeAccess(demo)).toBe(true)
  })

  it('fills the account with parties, an account and cheques both ways', async () => {
    expect(await count('parties', demo)).toBe(15)
    expect(await count('bank_accounts', demo)).toBe(1)
    expect(await count('received_cheques', demo)).toBe(19)
    expect(await count('cheques', demo)).toBe(5)
    expect(await count('daily_deposits', demo)).toBe(1)
  })

  it('shows every state Today and the lists care about', async () => {
    const received = await t.asUser<Pick<ReceivedCheque, 'status' | 'kind' | 'due_date' | 'cheque_date' | 'deposited_on'>>(
      demo,
      `SELECT status, kind, due_date::text, cheque_date::text, deposited_on::text FROM received_cheques`
    )
    const rules = { chequeValidityMonths: REGION.cheque_validity_months, clearingDays: REGION.clearing_days }
    const alerts = received.rows.flatMap((c) => receivedAlerts(c, today, rules))
    for (const alert of ['deposit_today', 'deposit_overdue', 'going_stale', 'check_clearing', 'needs_decision'] as const) {
      expect(alerts).toContain(alert)
    }
    expect(new Set(received.rows.map((c) => c.status))).toEqual(new Set(['IN_HAND', 'DEPOSITED', 'BOUNCED', 'CLEARED', 'SETTLED']))
    expect(received.rows.some((c) => c.kind === 'SECURITY')).toBe(true)

    const given = await t.asUser<{ status: string }>(demo, 'SELECT status FROM cheques ORDER BY status')
    expect(given.rows.map((c) => c.status)).toEqual(['DEPOSITED', 'PASSED', 'PENDING', 'PENDING', 'RETURNED'])
    const funds = await t.asUser<{ deposit_date: string }>(demo, 'SELECT deposit_date::text FROM daily_deposits')
    expect(funds.rows).toEqual([{ deposit_date: today }])
  })

  it('dates each change to the day it happened, never later than now', async () => {
    const { rows } = await t.asUser<{ to_status: string; day: string; future: boolean }>(
      demo,
      `SELECT h.to_status, (h.created_at AT TIME ZONE $1)::date::text AS day, h.created_at > now() AS future
       FROM received_cheque_history h JOIN received_cheques c ON c.id = h.cheque_id
       WHERE c.cheque_number = '812004' ORDER BY h.created_at`,
      [REGION.timezone]
    )
    const daysAgo = (n: number) => {
      const d = new Date(`${today}T00:00:00Z`)
      d.setUTCDate(d.getUTCDate() - n)
      return d.toISOString().slice(0, 10)
    }
    expect(rows).toEqual([
      { to_status: 'DEPOSITED', day: daysAgo(20), future: false },
      { to_status: 'CLEARED', day: daysAgo(18), future: false },
    ])
  })

  it('puts the monthly series in one series, from the first of next month', async () => {
    const { rows } = await t.asUser<{ series: number; first: string; count: number }>(
      demo,
      `SELECT count(DISTINCT series_id)::int AS series, min(cheque_date)::text AS first, count(*)::int AS count
       FROM received_cheques WHERE series_id IS NOT NULL`
    )
    const first = new Date(`${today}T00:00:00Z`)
    first.setUTCMonth(first.getUTCMonth() + 1, 1)
    expect(rows).toEqual([{ series: 1, first: first.toISOString().slice(0, 10), count: 6 }])
  })

  it('happens once per account', async () => {
    await expect(startDemo(demo)).rejects.toThrow('already started')
  })

  it('is only for anonymous sign-ins', async () => {
    await expect(startDemo(REAL)).rejects.toThrow('Only a demo session')
    expect(await count('parties', REAL)).toBe(0)
    expect(await count('entitlements', REAL)).toBe(0)
  })

  it('needs a region, and changes nothing without one', async () => {
    const user = await anonymous()
    await expect(startDemo(user, {})).rejects.toThrow('needs a region')
    await expect(startDemo(user, { ...REGION, timezone: 'Nowhere/Nothing' })).rejects.toThrow('Unknown time zone')
    expect(await count('entitlements', user)).toBe(0)
    expect(await count('parties', user)).toBe(0)
  })
})

describe('how many demos start', () => {
  it('stops at the hourly limit, and none start when it is 0', async () => {
    const db = await createTestDatabase()
    await db.asAdmin('UPDATE instance_config SET demos_per_hour = 1')
    await startDemo(await anonymous(db), REGION, db)
    await expect(startDemo(await anonymous(db), REGION, db)).rejects.toThrow('busy')
    await db.asAdmin('UPDATE instance_config SET demos_per_hour = 0')
    await expect(startDemo(await anonymous(db), REGION, db)).rejects.toThrow('turned off')
  })
})

describe('what a demo can do', () => {
  it("can't add anything before its demo starts, even where everything else is free", async () => {
    const user = await anonymous()
    expect(await writeAccess(user)).toBe(false)
    await expect(addParty(user, 'Anyone')).rejects.toThrow()
    expect(await count('parties', user)).toBe(0)
  })

  it('can add and change data during the demo, up to a limit', async () => {
    const demo = await anonymous()
    await startDemo(demo)
    await addParty(demo, 'Someone new')
    for (const n of [1, 2, 3, 4]) {
      await t.asUser(demo, `INSERT INTO bank_accounts (user_id, name, bank_name) VALUES ($1, $2, 'Northwind Bank')`, [demo, `Account ${n}`])
    }
    await expect(
      t.asUser(demo, `INSERT INTO bank_accounts (user_id, name, bank_name) VALUES ($1, 'One too many', 'Northwind Bank')`, [demo])
    ).rejects.toThrow('holds up to 5')
  })

  it('keeps notes short in a demo, but not in a real account', async () => {
    const demo = await anonymous()
    await startDemo(demo)
    const long = 'x'.repeat(3000)
    await expect(t.asUser(demo, `UPDATE parties SET notes = $1 WHERE name = 'Summit Tools'`, [long])).rejects.toThrow('more text')
    await addParty(REAL, 'Long notes')
    await t.asUser(REAL, `UPDATE parties SET notes = $1 WHERE name = 'Long notes'`, [long])
  })

  it("can't import an export, even where everything else is free", async () => {
    const demo = await anonymous()
    await startDemo(demo)
    await expect(t.asUser(demo, `SELECT import_data('{}'::jsonb)`)).rejects.toThrow('Business plan')
  })

  it('stops changing data when its day is over', async () => {
    const demo = await anonymous()
    await startDemo(demo)
    await t.asAdmin(
      `UPDATE entitlements SET starts_at = now() - interval '2 days', expires_at = now() - interval '1 day' WHERE user_id = $1`,
      [demo]
    )
    expect(await writeAccess(demo)).toBe(false)
    await expect(addParty(demo, 'Too late')).rejects.toThrow()
  })

  it('gets no trial and no refusal where trials are given, unlike a real sign-up', async () => {
    const db = await createTestDatabase()
    await db.asAdmin('UPDATE instance_config SET billing_enabled = true, trial_days = 30')
    const demo = await anonymous(db)
    expect(await count('entitlements', demo, db)).toBe(0)
    expect(await count('trial_refusals', demo, db)).toBe(0)
    await db.addUser(REAL)
    expect(await count('entitlements', REAL, db)).toBe(1)
  })

  it("loses its demo day if it's made into a real account", async () => {
    const db = await createTestDatabase()
    await db.asAdmin('UPDATE instance_config SET billing_enabled = true')
    const demo = await anonymous(db)
    await startDemo(demo, REGION, db)
    expect(await writeAccess(demo, db)).toBe(true)
    await db.asAdmin(`UPDATE auth.users SET is_anonymous = false, email = 'someone@example.com' WHERE id = $1`, [demo])
    expect(await writeAccess(demo, db)).toBe(false)
  })
})

describe('ending a demo', () => {
  it('deletes the account and everything in it, and nothing else', async () => {
    await addParty(REAL, 'Kept')
    const before = await count('parties', REAL)
    const demo = await anonymous()
    await startDemo(demo)

    await t.asUser(demo, 'SELECT end_demo()')

    for (const table of ['parties', 'bank_accounts', 'cheques', 'received_cheques', 'daily_deposits', 'settings', 'entitlements']) {
      expect(await count(table, demo)).toBe(0)
    }
    const { rows } = await t.asAdmin('SELECT id FROM auth.users WHERE id = $1', [demo])
    expect(rows).toEqual([])
    expect(await count('parties', REAL)).toBe(before)
  })

  it('refuses a real account', async () => {
    await expect(t.asUser(REAL, 'SELECT end_demo()')).rejects.toThrow('Only a demo account')
    const { rows } = await t.asAdmin('SELECT id FROM auth.users WHERE id = $1', [REAL])
    expect(rows).toHaveLength(1)
  })

  it('happens to demos more than a day old as new ones start', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString()
    const old = await anonymous(t, twoDaysAgo)
    await t.asAdmin(`INSERT INTO parties (user_id, name) VALUES ($1, 'Left behind')`, [old])
    const oldReal = 'eeeeeeee-0000-4000-8000-000000000002'
    await t.addUser(oldReal, undefined, { createdAt: twoDaysAgo })

    await startDemo(await anonymous())

    expect(await count('parties', old)).toBe(0)
    expect((await t.asAdmin('SELECT id FROM auth.users WHERE id = $1', [old])).rows).toEqual([])
    expect((await t.asAdmin('SELECT id FROM auth.users WHERE id = $1', [oldReal])).rows).toHaveLength(1)
  })

  it('never lets signed-in users run the clean-up themselves', async () => {
    await expect(t.asUser(REAL, 'SELECT internal.remove_expired_demos()')).rejects.toThrow('permission denied')
    await expect(t.asUser(REAL, 'SELECT internal.remove_demo_account($1)', [REAL])).rejects.toThrow('permission denied')
  })
})
