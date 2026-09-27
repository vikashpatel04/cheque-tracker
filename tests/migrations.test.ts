/**
 * Regions and editions, checked as real signed-in users with row-level
 * security on. See tests/support/db.ts for the test database.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase, type TestDatabase } from './support/db'

const U1 = '11111111-1111-1111-1111-111111111111'
const U2 = '22222222-2222-2222-2222-222222222222'
const U3 = '33333333-3333-3333-3333-333333333333'

let t: TestDatabase

const writeAccess = async (uid: string) =>
  (await t.asUser<{ w: boolean }>(uid, 'SELECT has_write_access() AS w')).rows[0].w

/** Every table privilege the Data API roles have on the app's tables, as "role PRIVILEGE table". */
const PRIVILEGES_SQL = `
  SELECT r.role || ' ' || p.privilege || ' ' || t.name AS grant
  FROM (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(role)
  CROSS JOIN (VALUES ('parties'), ('cheques'), ('cheque_history'), ('daily_deposits'), ('settings'),
    ('instance_config'), ('entitlements'), ('bank_accounts'), ('received_cheques'),
    ('received_cheque_history'), ('all_cheques')) AS t(name)
  CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) AS p(privilege)
  WHERE has_table_privilege(r.role, 'public.' || t.name, p.privilege)
  ORDER BY 1`

const grantsIn = async (database: TestDatabase) =>
  (await database.asAdmin<{ grant: string }>(PRIVILEGES_SQL)).rows.map((r) => r.grant)

beforeAll(async () => {
  t = await createTestDatabase()
})

describe('privileges', () => {
  it('give visitors only the instance config', async () => {
    const anon = (await grantsIn(t)).filter((g) => g.startsWith('anon '))
    expect(anon).toEqual(['anon SELECT instance_config'])
  })

  it('never let signed-in users delete or truncate', async () => {
    const risky = (await grantsIn(t)).filter((g) => /^authenticated (DELETE|TRUNCATE) /.test(g))
    expect(risky).toEqual([])
  })

  it('let signed-in users change their data but only read plans and settings of the instance', async () => {
    const grants = await grantsIn(t)
    expect(grants).toContain('authenticated INSERT cheques')
    expect(grants).toContain('authenticated UPDATE received_cheques')
    expect(grants).not.toContain('authenticated INSERT entitlements')
    expect(grants).not.toContain('authenticated UPDATE instance_config')
    expect(grants).not.toContain('authenticated UPDATE cheque_history')
    expect(grants).toContain('service_role DELETE cheques')
  })

  it('end up the same whether or not the project exposes new tables automatically', async () => {
    const exposed = await createTestDatabase({ exposeNewTables: true })
    expect(await grantsIn(exposed)).toEqual(await grantsIn(t))
  })

  it("never let visitors or signed-in users run SECURITY DEFINER functions, Supabase's included", async () => {
    const withHelper = await createTestDatabase({ automaticRls: true })
    const helper = await withHelper.asAdmin<{ found: boolean }>(
      "SELECT to_regprocedure('public.rls_auto_enable()') IS NOT NULL AS found"
    )
    expect(helper.rows).toEqual([{ found: true }])
    const { rows } = await withHelper.asAdmin<{ fn: string }>(`
      SELECT p.oid::regprocedure::text AS fn
      FROM pg_proc p
      WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
        AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))`)
    expect(rows).toEqual([])
  })
})

describe('row-level security and indexes', () => {
  it('evaluate auth.uid(), has_write_access() and current_setting() once per statement, not per row', async () => {
    const { rows } = await t.asAdmin<{ policy: string; expr: string }>(`
      SELECT tablename || ': ' || policyname AS policy, concat_ws(' ', qual, with_check) AS expr
      FROM pg_policies WHERE schemaname = 'public'`)
    // Once per statement reads "( SELECT auth.uid() AS uid)"; per row reads "(auth.uid() = user_id)".
    const perRow = rows.filter((r) =>
      /(?<!SELECT (public\.)?)(auth\.uid\(\)|has_write_access\(\)|current_setting\()/.test(r.expr)
    )
    expect(perRow.map((r) => r.policy)).toEqual([])
  })

  it('index every foreign key', async () => {
    const { rows } = await t.asAdmin<{ fkey: string }>(`
      SELECT c.conrelid::regclass::text || ' ' || c.conname AS fkey
      FROM pg_constraint c
      WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
        AND NOT EXISTS (
          SELECT 1 FROM pg_index i
          WHERE i.indrelid = c.conrelid
            AND (string_to_array(i.indkey::text, ' ')::smallint[])[1:cardinality(c.conkey)] = c.conkey
        )
      ORDER BY 1`)
    expect(rows.map((r) => r.fkey)).toEqual([])
  })
})

describe('accounts created before the migrations', () => {
  it('get a settings row too', async () => {
    const early = await createTestDatabase({ usersBeforeMigrations: [U1] })
    const { rows } = await early.asUser<{ country_code: string | null }>(U1, 'SELECT country_code FROM settings')
    expect(rows).toEqual([{ country_code: null }])
  })
})

describe('region settings', () => {
  it('starts new users without a region or India-specific defaults', async () => {
    await t.addUser(U1)
    const { rows } = await t.asAdmin<{ country_code: string | null; currency_symbol: string | null; banks: string[] }>(
      'SELECT country_code, currency_symbol, banks FROM settings WHERE user_id = $1',
      [U1]
    )
    expect(rows[0]).toEqual({ country_code: null, currency_symbol: null, banks: [] })
  })

  it('accepts a valid region and rejects bad values', async () => {
    await t.asUser(U1, `
      UPDATE settings SET country_code = 'IN', currency_code = 'INR', locale = 'en-IN', timezone = 'Asia/Kolkata',
        date_format = 'dd/MM/yyyy', week_starts_on = 1, cheque_validity_months = 3, clearing_days = 2,
        currency_symbol = '₹'
      WHERE user_id = $1`, [U1])
    await expect(t.asUser(U1, `UPDATE settings SET date_format = 'd/M/yy' WHERE user_id = $1`, [U1])).rejects.toThrow(/date_format/)
    await expect(t.asUser(U1, `UPDATE settings SET country_code = 'india' WHERE user_id = $1`, [U1])).rejects.toThrow(/country_code/)
    await expect(t.asUser(U1, `UPDATE settings SET cheque_validity_months = 30 WHERE user_id = $1`, [U1])).rejects.toThrow(/validity/)
    await expect(t.asUser(U1, `UPDATE settings SET clearing_days = 45 WHERE user_id = $1`, [U1])).rejects.toThrow(/clearing_days/)
  })
})

describe('self-hosted edition (billing off)', () => {
  let chequeId: string

  it('has one config row with billing off and gives everyone write access', async () => {
    const { rows } = await t.asAdmin<{ billing_enabled: boolean }>('SELECT billing_enabled FROM instance_config')
    expect(rows).toEqual([{ billing_enabled: false }])
    expect(await writeAccess(U1)).toBe(true)
    const trials = await t.asAdmin<{ n: number }>('SELECT count(*)::int AS n FROM entitlements')
    expect(trials.rows[0].n).toBe(0)
  })

  it('lets users add data and change statuses', async () => {
    const party = await t.asUser<{ id: string }>(U1, `INSERT INTO parties (user_id, name) VALUES ($1, 'Party A') RETURNING id`, [U1])
    const cheque = await t.asUser<{ id: string }>(U1, `
      INSERT INTO cheques (user_id, party_id, cheque_number, bank_name, amount, issue_date, due_date)
      VALUES ($1, $2, '000123', 'Bank', 50000, '2026-09-01', '2026-09-20') RETURNING id`, [U1, party.rows[0].id])
    chequeId = cheque.rows[0].id
    await t.asUser(U1, `SELECT change_cheque_status($1, 'RETURNED', 'manual', NULL, 'Funds insufficient')`, [chequeId])
    await t.asUser(U1, `SELECT represent_cheque($1, '2026-10-05', NULL, true)`, [chequeId])
  })

  it('writes ISO dates and "Funded" in re-present history notes', async () => {
    const { rows } = await t.asAdmin<{ note: string | null }>(
      'SELECT note FROM cheque_history WHERE cheque_id = $1 ORDER BY created_at',
      [chequeId]
    )
    const notes = rows.map((r) => r.note)
    expect(notes.some((n) => n?.includes('was due 2026-09-20'))).toBe(true)
    expect(notes).toContain('Funded on re-presentation')
  })

  it("doesn't let users grant themselves a plan or change the instance", async () => {
    await expect(t.asUser(U1, `INSERT INTO entitlements (user_id, source) VALUES ($1, 'comp')`, [U1])).rejects.toThrow(/permission denied/)
    await expect(t.asUser(U1, 'UPDATE instance_config SET billing_enabled = false')).rejects.toThrow(/permission denied/)
  })
})

describe('hosted edition (billing on)', () => {
  beforeAll(async () => {
    await t.asAdmin(`UPDATE instance_config SET billing_enabled = true, trial_days = 14, default_country_code = 'IN'`)
  })

  it('gives new sign-ups the configured trial', async () => {
    await t.addUser(U2)
    const { rows } = await t.asAdmin<{ source: string; long_enough: boolean }>(
      `SELECT source, expires_at > now() + interval '13 days' AS long_enough FROM entitlements WHERE user_id = $1`,
      [U2]
    )
    expect(rows).toEqual([{ source: 'trial', long_enough: true }])
    expect(await writeAccess(U2)).toBe(true)
    await t.asUser(U2, `INSERT INTO parties (user_id, name) VALUES ($1, 'Party B')`, [U2])
    const own = await t.asUser<{ n: number }>(U2, 'SELECT count(*)::int AS n FROM entitlements')
    expect(own.rows[0].n).toBe(1)
  })

  it('makes accounts without a plan read-only, but keeps their data visible', async () => {
    // U1 signed up while billing was off, so has no entitlement.
    expect(await writeAccess(U1)).toBe(false)
    const visible = await t.asUser<{ n: number }>(U1, 'SELECT count(*)::int AS n FROM cheques')
    expect(visible.rows[0].n).toBe(1)
    await expect(t.asUser(U1, `INSERT INTO parties (user_id, name) VALUES ($1, 'Party C')`, [U1])).rejects.toThrow(/row-level security/)
    await expect(t.asUser(U1, `SELECT record_deposit(1000, '2026-09-26')`)).rejects.toThrow(/row-level security/)
    const updated = await t.asUser(U1, `UPDATE cheques SET notes = 'x' WHERE user_id = $1`, [U1])
    expect(updated.affectedRows).toBe(0)
    // Settings stay editable so the user can still fix their region.
    await t.asUser(U1, `UPDATE settings SET timezone = 'Asia/Kolkata' WHERE user_id = $1`, [U1])
  })

  it('restores access with a complimentary grant', async () => {
    await t.asAdmin(`INSERT INTO entitlements (user_id, source, note) VALUES ($1, 'comp', 'Owner')`, [U1])
    expect(await writeAccess(U1)).toBe(true)
  })

  it('ignores expired purchases', async () => {
    await t.addUser(U3)
    await t.asAdmin('DELETE FROM entitlements WHERE user_id = $1', [U3])
    await t.asAdmin(
      `INSERT INTO entitlements (user_id, source, starts_at, expires_at, payment_ref)
       VALUES ($1, 'purchase', now() - interval '40 days', now() - interval '10 days', 'pay_test')`,
      [U3]
    )
    expect(await writeAccess(U3)).toBe(false)
  })
})
