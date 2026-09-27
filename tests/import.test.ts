/**
 * Import from an export (migration 016), checked as real signed-in users with
 * row-level security on. See tests/support/db.ts for the test database.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase, type TestDatabase } from './support/db'

const U1 = 'bbbbbbbb-0000-4000-8000-000000000001'
const U2 = 'bbbbbbbb-0000-4000-8000-000000000002'
const U3 = 'bbbbbbbb-0000-4000-8000-000000000003'
const U4 = 'bbbbbbbb-0000-4000-8000-000000000004'

let t: TestDatabase

const PAYLOAD = {
  parties: [
    { name: 'Party A', contact_name: 'Contact A', phone: '100', bank_name: 'Bank One', notes: null, is_active: true },
    { name: 'Party B', is_active: false },
  ],
  cheques: [
    { party: 'Party A', cheque_number: '000101', bank_name: 'Bank One', amount: 25000, issue_date: '2026-08-01', due_date: '2026-09-01', status: 'PASSED' },
    { party: 'party a', cheque_number: '000102', bank_name: 'Bank One', amount: 12500.5, issue_date: '2026-08-01', due_date: '2026-10-01', status: 'DEPOSITED' },
    { party: 'Party B', cheque_number: '000103', bank_name: 'Bank Two', amount: 5000, issue_date: '2026-07-01', due_date: '2026-11-15', status: 'RETURNED', original_due_date: '2026-08-15', represent_count: 1 },
    { party: 'Party B', cheque_number: '000104', bank_name: 'Bank Two', amount: 7000, issue_date: '2026-07-01', due_date: '2026-08-01', status: 'WRITTEN_OFF', write_off_reason: 'Account closed' },
    { party: 'Party A', cheque_number: '000105', bank_name: 'Bank One', amount: 3000, issue_date: '2026-09-01', due_date: '2026-12-01', status: 'PENDING', notes: ' Rent ' },
  ],
  deposits: [
    { amount: 25000, deposit_date: '2026-08-30', notes: 'For 000101' },
    { amount: 12500.5, deposit_date: '2026-09-30', notes: null },
  ],
}

type Counts = { parties: number; cheques: number; deposits: number }

const importAs = (uid: string, payload: unknown) =>
  t.asUser<{ result: Counts }>(uid, 'SELECT import_data($1::jsonb) AS result', [JSON.stringify(payload)])

const countFor = async (uid: string, table: 'parties' | 'cheques' | 'daily_deposits') =>
  (await t.asAdmin<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE user_id = $1`, [uid])).rows[0].n

const chequeId = async (uid: string, number: string) =>
  (await t.asUser<{ id: string }>(uid, 'SELECT id FROM cheques WHERE cheque_number = $1 AND deleted_at IS NULL', [number]))
    .rows[0].id

beforeAll(async () => {
  t = await createTestDatabase()
  for (const uid of [U1, U2, U3, U4]) await t.addUser(uid)
})

describe('import_data', () => {
  it('brings in parties, given cheques with their status and dates, and funds added', async () => {
    const { rows } = await importAs(U1, PAYLOAD)
    expect(rows[0].result).toEqual({ parties: 2, cheques: 5, deposits: 2 })

    const parties = await t.asUser(U1, 'SELECT name, contact_name, bank_name, is_active FROM parties ORDER BY name')
    expect(parties.rows).toEqual([
      { name: 'Party A', contact_name: 'Contact A', bank_name: 'Bank One', is_active: true },
      { name: 'Party B', contact_name: null, bank_name: null, is_active: false },
    ])

    const cheques = await t.asUser(U1, `
      SELECT c.cheque_number, p.name AS party, c.amount::float8 AS amount, c.status, c.due_date::text AS due,
             c.original_due_date::text AS printed, c.represent_count, c.write_off_reason, c.notes
      FROM cheques c JOIN parties p ON p.id = c.party_id
      ORDER BY c.cheque_number`)
    expect(cheques.rows).toEqual([
      { cheque_number: '000101', party: 'Party A', amount: 25000, status: 'PASSED', due: '2026-09-01', printed: null, represent_count: 0, write_off_reason: null, notes: null },
      { cheque_number: '000102', party: 'Party A', amount: 12500.5, status: 'DEPOSITED', due: '2026-10-01', printed: null, represent_count: 0, write_off_reason: null, notes: null },
      { cheque_number: '000103', party: 'Party B', amount: 5000, status: 'RETURNED', due: '2026-11-15', printed: '2026-08-15', represent_count: 1, write_off_reason: null, notes: null },
      { cheque_number: '000104', party: 'Party B', amount: 7000, status: 'WRITTEN_OFF', due: '2026-08-01', printed: null, represent_count: 0, write_off_reason: 'Account closed', notes: null },
      { cheque_number: '000105', party: 'Party A', amount: 3000, status: 'PENDING', due: '2026-12-01', printed: null, represent_count: 0, write_off_reason: null, notes: 'Rent' },
    ])

    const funds = await t.asUser(U1, 'SELECT amount::float8 AS amount, deposit_date::text AS date, notes FROM daily_deposits ORDER BY deposit_date')
    expect(funds.rows).toEqual([
      { amount: 25000, date: '2026-08-30', notes: 'For 000101' },
      { amount: 12500.5, date: '2026-09-30', notes: null },
    ])
  })

  it('gives each cheque one "import" history entry, which rollback refuses to undo', async () => {
    const history = await t.asUser(U1, `
      SELECT h.changed_by, count(*)::int AS n, bool_and(h.from_status = h.to_status AND h.to_status = c.status) AS same
      FROM cheque_history h JOIN cheques c ON c.id = h.cheque_id
      GROUP BY h.changed_by`)
    expect(history.rows).toEqual([{ changed_by: 'import', n: 5, same: true }])

    const pending = await chequeId(U1, '000105')
    await expect(t.asUser(U1, 'SELECT rollback_cheque_status($1)', [pending])).rejects.toThrow(/no status change to roll back/)

    // Changes made after the import can be undone, back to the imported status.
    await t.asUser(U1, `SELECT change_cheque_status($1, 'CANCELLED')`, [pending])
    const back = await t.asUser<{ status: string }>(U1, 'SELECT rollback_cheque_status($1) AS status', [pending])
    expect(back.rows[0].status).toBe('PENDING')
    await expect(t.asUser(U1, 'SELECT rollback_cheque_status($1)', [pending])).rejects.toThrow(/no status change to roll back/)
  })

  it('only works on an account without parties or cheques', async () => {
    await expect(importAs(U1, PAYLOAD)).rejects.toThrow(/no parties or cheques yet/)
  })

  it('saves nothing when any value is wrong', async () => {
    const bad = { ...PAYLOAD, cheques: [...PAYLOAD.cheques, { ...PAYLOAD.cheques[0], cheque_number: '000199', status: 'BOUNCED' }] }
    await expect(importAs(U2, bad)).rejects.toThrow(/Cheque 000199: unknown status BOUNCED/)
    expect(await countFor(U2, 'parties')).toBe(0)
    expect(await countFor(U2, 'cheques')).toBe(0)
    expect(await countFor(U2, 'daily_deposits')).toBe(0)
  })

  it('checks every value, because the tables have no constraints', async () => {
    const withCheque = (changes: Record<string, unknown>) => ({ parties: PAYLOAD.parties, cheques: [{ ...PAYLOAD.cheques[0], ...changes }] })
    await expect(importAs(U2, withCheque({ cheque_number: ' ' }))).rejects.toThrow(/has no number/)
    await expect(importAs(U2, withCheque({ bank_name: '' }))).rejects.toThrow(/has no bank/)
    await expect(importAs(U2, withCheque({ amount: 0 }))).rejects.toThrow(/000101: the amount must be more than zero/)
    await expect(importAs(U2, withCheque({ due_date: null }))).rejects.toThrow(/a date is missing/)
    await expect(importAs(U2, withCheque({ represent_count: -1 }))).rejects.toThrow(/can't be negative/)
    await expect(importAs(U2, withCheque({ party: 'Party Z' }))).rejects.toThrow(/the party Party Z isn't in the file/)
    await expect(importAs(U2, { parties: [{ name: 'Party A' }, { name: 'party a ' }] })).rejects.toThrow(/appears more than once/)
    await expect(importAs(U2, { parties: [{ name: '  ' }] })).rejects.toThrow(/has no name/)
    await expect(importAs(U2, { deposits: [{ amount: -5, deposit_date: '2026-09-01' }] })).rejects.toThrow(/more than zero/)
    expect(await countFor(U2, 'parties')).toBe(0)
  })

  it('keeps every row in the signed-in account, whatever the file says', async () => {
    await importAs(U3, { parties: [{ name: 'Party S', user_id: U1 }] })
    const owners = await t.asAdmin(`SELECT user_id FROM parties WHERE name = 'Party S'`)
    expect(owners.rows).toEqual([{ user_id: U3 }])
    const seenByU1 = await t.asUser<{ n: number }>(U1, `SELECT count(*)::int AS n FROM parties WHERE name = 'Party S'`)
    expect(seenByU1.rows[0].n).toBe(0)
  })

  it("doesn't add funds twice when importing again after Delete All Data", async () => {
    // Delete All Data soft-deletes parties and cheques. Funds added stay.
    await t.asUser(U1, 'UPDATE cheques SET deleted_at = now() WHERE deleted_at IS NULL')
    await t.asUser(U1, 'UPDATE parties SET deleted_at = now() WHERE deleted_at IS NULL')
    const { rows } = await importAs(U1, PAYLOAD)
    expect(rows[0].result).toEqual({ parties: 2, cheques: 5, deposits: 0 })
    expect(await countFor(U1, 'daily_deposits')).toBe(2)
  })

  it("isn't available to visitors or to read-only accounts", async () => {
    const anon = await t.asAdmin<{ allowed: boolean }>(
      `SELECT has_function_privilege('anon', 'public.import_data(jsonb)', 'EXECUTE') AS allowed`
    )
    expect(anon.rows).toEqual([{ allowed: false }])

    // U4 signed up while billing was off, so it has no plan once billing is on.
    await t.asAdmin('UPDATE instance_config SET billing_enabled = true')
    try {
      await expect(importAs(U4, PAYLOAD)).rejects.toThrow(/row-level security/)
    } finally {
      await t.asAdmin('UPDATE instance_config SET billing_enabled = false')
    }
    expect(await countFor(U4, 'parties')).toBe(0)
  })
})
