/**
 * The account on given cheques and on funds added (migration 018), checked as
 * real signed-in users with row-level security on. See tests/support/db.ts.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase, type TestDatabase } from './support/db'

const U1 = 'cccccccc-0000-4000-8000-000000000001'
const U2 = 'cccccccc-0000-4000-8000-000000000002'

let t: TestDatabase
let party1: string
let account1: string
let account2: string

async function givenCheque(values: Record<string, unknown> = {}, uid = U1): Promise<string> {
  const row = {
    party_id: party1,
    cheque_number: '000201',
    bank_name: 'My Bank',
    amount: 15000,
    issue_date: '2026-09-01',
    due_date: '2026-10-01',
    ...values,
  }
  const cols = Object.keys(row)
  const res = await t.asUser<{ id: string }>(
    uid,
    `INSERT INTO cheques (user_id, ${cols.join(', ')}) VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING id`,
    [uid, ...Object.values(row)]
  )
  return res.rows[0].id
}

beforeAll(async () => {
  t = await createTestDatabase()
  await t.addUser(U1)
  await t.addUser(U2)
  party1 = (await t.asUser<{ id: string }>(U1, `INSERT INTO parties (user_id, name) VALUES ($1, 'Landlord') RETURNING id`, [U1])).rows[0].id
  const account = async (uid: string, name: string) =>
    (
      await t.asUser<{ id: string }>(
        uid,
        `INSERT INTO bank_accounts (user_id, name, bank_name, last4, is_default) VALUES ($1, $2, 'My Bank', '0001', false) RETURNING id`,
        [uid, name]
      )
    ).rows[0].id
  account1 = await account(U1, 'Current')
  account2 = await account(U2, 'Theirs')
})

describe('the account a given cheque is drawn on', () => {
  it('can be one of your accounts, or none, as before', async () => {
    const withAccount = await givenCheque({ bank_account_id: account1 })
    const without = await givenCheque()
    const rows = (
      await t.asUser<{ id: string; bank_account_id: string | null }>(U1, 'SELECT id, bank_account_id FROM cheques WHERE id = ANY($1)', [[withAccount, without]])
    ).rows
    expect(Object.fromEntries(rows.map((r) => [r.id, r.bank_account_id]))).toEqual({ [withAccount]: account1, [without]: null })
  })

  it("can't be someone else's account", async () => {
    await expect(givenCheque({ bank_account_id: account2 })).rejects.toThrow(/Bank account not found/)
    const id = await givenCheque()
    await expect(t.asUser(U1, 'UPDATE cheques SET bank_account_id = $2 WHERE id = $1', [id, account2])).rejects.toThrow(/Bank account not found/)
  })

  it('stays on older cheques after the account is removed, and other edits still work', async () => {
    const extra = (
      await t.asUser<{ id: string }>(U1, `INSERT INTO bank_accounts (user_id, name, bank_name) VALUES ($1, 'Old', 'My Bank') RETURNING id`, [U1])
    ).rows[0].id
    const id = await givenCheque({ bank_account_id: extra })
    await t.asUser(U1, 'UPDATE bank_accounts SET deleted_at = now() WHERE id = $1', [extra])
    await t.asUser(U1, `UPDATE cheques SET notes = 'Rent' WHERE id = $1`, [id])
    // But a new cheque can't be put on it.
    await expect(givenCheque({ bank_account_id: extra })).rejects.toThrow(/Bank account not found/)
  })
})

describe('funds added into an account', () => {
  it('records the account and funds the ticked cheques', async () => {
    const cheque = await givenCheque({ bank_account_id: account1 })
    const deposit = (
      await t.asUser<{ id: string }>(U1, `SELECT record_deposit(15000, '2026-09-29', ARRAY[$1]::uuid[], 'Rent', $2) AS id`, [cheque, account1])
    ).rows[0].id
    const saved = (await t.asAdmin<{ bank_account_id: string }>('SELECT bank_account_id FROM daily_deposits WHERE id = $1', [deposit])).rows[0]
    expect(saved.bank_account_id).toBe(account1)
    expect((await t.asAdmin<{ status: string }>('SELECT status FROM cheques WHERE id = $1', [cheque])).rows[0].status).toBe('DEPOSITED')
  })

  it('still works without an account, and refuses someone else’s', async () => {
    await t.asUser(U1, `SELECT record_deposit(5000, '2026-09-29')`)
    await expect(t.asUser(U1, `SELECT record_deposit(5000, '2026-09-29', '{}', NULL, $1)`, [account2])).rejects.toThrow(/Bank account not found/)
  })
})
