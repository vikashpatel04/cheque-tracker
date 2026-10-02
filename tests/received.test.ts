/**
 * Received cheques (migration 012), checked as real signed-in users with
 * row-level security on. See tests/support/db.ts for the test database.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase, type TestDatabase } from './support/db'
import { RECEIVED_ACTIONS, type ReceivedAction, type ReceivedStatus } from '@/types/received'

const U1 = 'aaaaaaaa-0000-4000-8000-000000000001'
const U2 = 'aaaaaaaa-0000-4000-8000-000000000002'

let t: TestDatabase
let party1: string
let party2: string
let account1: string
let account2: string

/** A regular cheque in hand; `values` overrides the defaults. */
async function newCheque(uid = U1, partyId = party1, values: Record<string, unknown> = {}): Promise<string> {
  const row = {
    cheque_number: '000101',
    bank_name: 'Payer Bank',
    amount: 25000,
    received_on: '2026-09-01',
    cheque_date: '2026-10-01',
    due_date: '2026-10-01',
    ...values,
  }
  const cols = Object.keys(row)
  const placeholders = cols.map((_, i) => `$${i + 3}`).join(', ')
  const res = await t.asUser<{ id: string }>(
    uid,
    `INSERT INTO received_cheques (user_id, party_id, ${cols.join(', ')}) VALUES ($1, $2, ${placeholders}) RETURNING id`,
    [uid, partyId, ...Object.values(row)]
  )
  return res.rows[0].id
}

const statusOf = async (id: string) =>
  (await t.asAdmin<{ status: string }>('SELECT status FROM received_cheques WHERE id = $1', [id])).rows[0].status

/** Each action with valid arguments for a cheque dated 2026-10-01. */
const ACTION_SQL: Record<ReceivedAction, string> = {
  deposit: `SELECT deposit_received_cheques(ARRAY[$1]::uuid[], '2026-10-01')`,
  clear: `SELECT clear_received_cheques(ARRAY[$1]::uuid[], '2026-10-03')`,
  bounce: `SELECT bounce_received_cheque($1, '2026-10-03', 'Funds insufficient')`,
  redeposit: `SELECT redeposit_received_cheque($1, '2026-10-10')`,
  settle: `SELECT settle_received_cheque($1, 'TRANSFER', '2026-10-05', 'UTR123')`,
  hand_back: `SELECT hand_back_received_cheque($1, 'Lease ended')`,
  write_off: `SELECT write_off_received_cheque($1, 'Payer unreachable')`,
  replace: `SELECT replace_received_cheque($1, '000999', 'Payer Bank', 25000, '2026-10-20', '2026-10-05')`,
}

const run = (action: ReceivedAction, id: string, uid = U1) => t.asUser(uid, ACTION_SQL[action], [id])

const historyOf = async (id: string) =>
  (
    await t.asAdmin<{ to_status: string; note: string | null }>(
      'SELECT to_status, note FROM received_cheque_history WHERE cheque_id = $1 ORDER BY created_at',
      [id]
    )
  ).rows

beforeAll(async () => {
  t = await createTestDatabase()
  await t.addUser(U1)
  await t.addUser(U2)
  const party = async (uid: string, name: string) =>
    (await t.asUser<{ id: string }>(uid, 'INSERT INTO parties (user_id, name) VALUES ($1, $2) RETURNING id', [uid, name])).rows[0].id
  const account = async (uid: string) =>
    (
      await t.asUser<{ id: string }>(
        uid,
        `INSERT INTO bank_accounts (user_id, name, bank_name, last4, is_default) VALUES ($1, 'Main', 'My Bank', '4521', true) RETURNING id`,
        [uid]
      )
    ).rows[0].id
  party1 = await party(U1, 'Tenant')
  party2 = await party(U2, 'Customer')
  account1 = await account(U1)
  account2 = await account(U2)
})

describe('adding received cheques', () => {
  it('starts them in hand', async () => {
    expect(await statusOf(await newCheque())).toBe('IN_HAND')
  })

  it("won't add one straight into another status", async () => {
    await expect(newCheque(U1, party1, { status: 'CLEARED' })).rejects.toThrow(/start in hand/)
  })

  it('needs an amount and date for regular cheques, but not for security cheques', async () => {
    await expect(newCheque(U1, party1, { amount: null })).rejects.toThrow(/received_regular_complete/)
    const security = await newCheque(U1, party1, { kind: 'SECURITY', amount: null, cheque_date: null, due_date: '2027-03-31' })
    expect(await statusOf(security)).toBe('IN_HAND')
    // A blank security cheque can't be deposited until it's filled in.
    await expect(run('deposit', security)).rejects.toThrow(/amount and date/)
  })

  it("won't use another user's party", async () => {
    await expect(newCheque(U1, party2)).rejects.toThrow(/Party not found/)
  })
})

describe('actions', () => {
  // How to get a new cheque into each status.
  const pathTo: Record<ReceivedStatus, ReceivedAction[]> = {
    IN_HAND: [],
    DEPOSITED: ['deposit'],
    CLEARED: ['deposit', 'clear'],
    BOUNCED: ['deposit', 'bounce'],
    SETTLED: ['settle'],
    HANDED_BACK: ['hand_back'],
    WRITTEN_OFF: ['write_off'],
    REPLACED: ['replace'],
  }

  it('allow exactly what RECEIVED_ACTIONS lists for each status', async () => {
    const mismatches: string[] = []
    for (const status of Object.keys(pathTo) as ReceivedStatus[]) {
      for (const action of Object.keys(ACTION_SQL) as ReceivedAction[]) {
        const id = await newCheque()
        for (const step of pathTo[status]) await run(step, id)
        expect(await statusOf(id)).toBe(status)
        const allowed = RECEIVED_ACTIONS[status].includes(action)
        const worked = await run(action, id).then(
          () => true,
          () => false
        )
        if (worked !== allowed) mismatches.push(`${status} + ${action}: ${worked ? 'worked' : 'failed'}`)
      }
    }
    expect(mismatches).toEqual([])
  })

  it('deposit several cheques at once, into an account', async () => {
    const a = await newCheque()
    const b = await newCheque()
    const res = await t.asUser<{ n: number }>(
      U1,
      `SELECT deposit_received_cheques(ARRAY[$1, $2]::uuid[], '2026-10-01', $3) AS n`,
      [a, b, account1]
    )
    expect(res.rows[0].n).toBe(2)
    const rows = await t.asAdmin<{ status: string; deposited_on: string; deposit_account_id: string }>(
      'SELECT status, deposited_on::text, deposit_account_id FROM received_cheques WHERE id IN ($1, $2)',
      [a, b]
    )
    expect(rows.rows).toEqual([
      { status: 'DEPOSITED', deposited_on: '2026-10-01', deposit_account_id: account1 },
      { status: 'DEPOSITED', deposited_on: '2026-10-01', deposit_account_id: account1 },
    ])
  })

  it('deposit all or nothing', async () => {
    const a = await newCheque()
    const b = await newCheque()
    await run('hand_back', b)
    await expect(
      t.asUser(U1, `SELECT deposit_received_cheques(ARRAY[$1, $2]::uuid[], '2026-10-01')`, [a, b])
    ).rejects.toThrow(/in hand/)
    expect(await statusOf(a)).toBe('IN_HAND')
  })

  it("won't deposit into another user's account", async () => {
    const a = await newCheque()
    await expect(
      t.asUser(U1, `SELECT deposit_received_cheques(ARRAY[$1]::uuid[], '2026-10-01', $2)`, [a, account2])
    ).rejects.toThrow(/Bank account not found/)
  })

  it("won't clear or bounce a cheque before its deposit date", async () => {
    const a = await newCheque()
    await run('deposit', a)
    await expect(t.asUser(U1, `SELECT clear_received_cheques(ARRAY[$1]::uuid[], '2026-09-30')`, [a])).rejects.toThrow(/before it was deposited/)
    await expect(t.asUser(U1, `SELECT bounce_received_cheque($1, '2026-09-30', 'Funds insufficient')`, [a])).rejects.toThrow(/before it was deposited/)
  })

  it('bounce needs a reason, and bank charges add up', async () => {
    const a = await newCheque()
    await run('deposit', a)
    await expect(t.asUser(U1, `SELECT bounce_received_cheque($1, '2026-10-03', '  ')`, [a])).rejects.toThrow(/reason/)
    await t.asUser(U1, `SELECT bounce_received_cheque($1, '2026-10-03', 'Funds insufficient', 150)`, [a])
    await t.asUser(U1, `SELECT redeposit_received_cheque($1, '2026-10-10')`, [a])
    await t.asUser(U1, `SELECT bounce_received_cheque($1, '2026-10-12', 'Payment stopped', 200)`, [a])
    const { rows } = await t.asAdmin<{ bank_charges: string; redeposit_count: number; bounce_reason: string }>(
      'SELECT bank_charges::text, redeposit_count, bounce_reason FROM received_cheques WHERE id = $1',
      [a]
    )
    expect(rows[0]).toEqual({ bank_charges: '350.00', redeposit_count: 1, bounce_reason: 'Payment stopped' })
  })

  it('can put a bounced cheque back in hand to deposit on a new date', async () => {
    const a = await newCheque()
    await run('deposit', a)
    await run('bounce', a)
    await t.asUser(U1, `SELECT redeposit_received_cheque($1, '2026-11-15', false)`, [a])
    const { rows } = await t.asAdmin<{ status: string; due_date: string; deposited_on: string | null; redeposit_count: number }>(
      'SELECT status, due_date::text, deposited_on, redeposit_count FROM received_cheques WHERE id = $1',
      [a]
    )
    expect(rows[0]).toEqual({ status: 'IN_HAND', due_date: '2026-11-15', deposited_on: null, redeposit_count: 1 })
  })

  it('record how a cheque was settled', async () => {
    const a = await newCheque()
    await run('deposit', a)
    await run('bounce', a)
    await run('settle', a)
    const { rows } = await t.asAdmin<{ settled_via: string; settlement_ref: string; settled_on: string }>(
      'SELECT settled_via, settlement_ref, settled_on::text FROM received_cheques WHERE id = $1',
      [a]
    )
    expect(rows[0]).toEqual({ settled_via: 'TRANSFER', settlement_ref: 'UTR123', settled_on: '2026-10-05' })
    expect((await historyOf(a)).at(-1)?.note).toBe('Paid by transfer · ref UTR123')
  })

  it('write every change to history, with ISO dates in notes', async () => {
    const a = await newCheque()
    await run('deposit', a)
    await run('bounce', a)
    await run('redeposit', a)
    await t.asUser(U1, `SELECT clear_received_cheques(ARRAY[$1]::uuid[], '2026-10-12')`, [a])
    const history = await historyOf(a)
    expect(history.map((h) => h.to_status)).toEqual(['DEPOSITED', 'BOUNCED', 'DEPOSITED', 'CLEARED'])
    expect(history[1].note).toBe('Bounced: Funds insufficient')
    expect(history[2].note).toBe('Deposited again · bounced 2026-10-03: Funds insufficient')
  })
})

describe('guards', () => {
  it('only let the actions change status', async () => {
    const a = await newCheque()
    await expect(t.asUser(U1, `UPDATE received_cheques SET status = 'CLEARED' WHERE id = $1`, [a])).rejects.toThrow(/received-cheque actions/)
    await expect(t.asUser(U1, `UPDATE received_cheques SET deposited_on = '2026-10-01' WHERE id = $1`, [a])).rejects.toThrow(/received-cheque actions/)
    // Ordinary details can still be edited.
    await t.asUser(U1, `UPDATE received_cheques SET notes = 'Call before depositing', amount = 26000 WHERE id = $1`, [a])
  })

  it("don't let users write history directly", async () => {
    const a = await newCheque()
    await expect(
      t.asUser(
        U1,
        `INSERT INTO received_cheque_history (cheque_id, from_status, to_status, changed_by, prev_state)
         VALUES ($1, 'IN_HAND', 'CLEARED', 'manual', '{}')`,
        [a]
      )
    ).rejects.toThrow(/row-level security/)
  })
})

describe('undo', () => {
  it('steps back one change at a time', async () => {
    const a = await newCheque()
    await run('deposit', a)
    await t.asUser(U1, `SELECT bounce_received_cheque($1, '2026-10-03', 'Funds insufficient', 150)`, [a])

    const back1 = await t.asUser<{ s: string }>(U1, 'SELECT rollback_received_cheque($1) AS s', [a])
    expect(back1.rows[0].s).toBe('DEPOSITED')
    const afterFirst = await t.asAdmin<{ bank_charges: string | null; bounced_on: string | null }>(
      'SELECT bank_charges, bounced_on FROM received_cheques WHERE id = $1',
      [a]
    )
    expect(afterFirst.rows[0]).toEqual({ bank_charges: null, bounced_on: null })

    const back2 = await t.asUser<{ s: string }>(U1, 'SELECT rollback_received_cheque($1) AS s', [a])
    expect(back2.rows[0].s).toBe('IN_HAND')
    await expect(t.asUser(U1, 'SELECT rollback_received_cheque($1)', [a])).rejects.toThrow(/no status change/)
  })

  it('removes the new cheque when a replacement is undone', async () => {
    const a = await newCheque()
    await run('deposit', a)
    await run('bounce', a)
    const newId = (await t.asUser<{ id: string }>(U1, `${ACTION_SQL.replace} AS id`, [a])).rows[0].id
    const replacement = await t.asAdmin<{ status: string; replaces_id: string; party_id: string }>(
      'SELECT status, replaces_id, party_id FROM received_cheques WHERE id = $1',
      [newId]
    )
    expect(replacement.rows[0]).toEqual({ status: 'IN_HAND', replaces_id: a, party_id: party1 })
    expect(await statusOf(a)).toBe('REPLACED')

    await t.asUser(U1, 'SELECT rollback_received_cheque($1)', [a])
    expect(await statusOf(a)).toBe('BOUNCED')
    const gone = await t.asAdmin<{ deleted: boolean }>('SELECT deleted_at IS NOT NULL AS deleted FROM received_cheques WHERE id = $1', [newId])
    expect(gone.rows[0].deleted).toBe(true)
  })

  it('keeps a replacement that has moved on', async () => {
    const a = await newCheque()
    const newId = (await t.asUser<{ id: string }>(U1, `${ACTION_SQL.replace} AS id`, [a])).rows[0].id
    await run('deposit', newId)
    await expect(t.asUser(U1, 'SELECT rollback_received_cheque($1)', [a])).rejects.toThrow(/changed since/)
  })
})

describe('privacy and plans', () => {
  it("keep each user's cheques, history and accounts private", async () => {
    const a = await newCheque()
    await run('deposit', a)
    const count = async (sql: string, params: unknown[]) => (await t.asUser<{ n: number }>(U2, sql, params)).rows[0].n
    expect(await count('SELECT count(*)::int AS n FROM received_cheques WHERE id = $1', [a])).toBe(0)
    expect(await count('SELECT count(*)::int AS n FROM received_cheque_history WHERE cheque_id = $1', [a])).toBe(0)
    expect(await count('SELECT count(*)::int AS n FROM bank_accounts WHERE id = $1', [account1])).toBe(0)
    await expect(run('clear', a, U2)).rejects.toThrow(/not found/)
  })

  it('combine both directions in all_cheques, still per user', async () => {
    await t.asUser(
      U1,
      `INSERT INTO cheques (user_id, party_id, cheque_number, bank_name, amount, issue_date, due_date)
       VALUES ($1, $2, '500001', 'My Bank', 10000, '2026-09-01', '2026-10-15')`,
      [U1, party1]
    )
    const directions = await t.asUser<{ direction: string }>(U1, 'SELECT DISTINCT direction FROM all_cheques ORDER BY direction')
    expect(directions.rows.map((r) => r.direction)).toEqual(['GIVEN', 'RECEIVED'])
    const seenByOther = await t.asUser<{ n: number }>(U2, 'SELECT count(*)::int AS n FROM all_cheques WHERE user_id = $1', [U1])
    expect(seenByOther.rows[0].n).toBe(0)
  })

  it('keep received cheques moving on the Free plan, but nothing new comes in', async () => {
    const a = await newCheque()
    const b = await newCheque()
    await t.asAdmin('UPDATE instance_config SET billing_enabled = true')
    try {
      await run('deposit', a)
      expect(await statusOf(a)).toBe('DEPOSITED')
      await expect(run('replace', b)).rejects.toThrow(/Free plan/)
      await expect(newCheque()).rejects.toThrow(/row-level security/)
      const visible = await t.asUser<{ n: number }>(U1, 'SELECT count(*)::int AS n FROM received_cheques WHERE id = $1', [a])
      expect(visible.rows[0].n).toBe(1)
    } finally {
      await t.asAdmin('UPDATE instance_config SET billing_enabled = false')
    }
  })
})
