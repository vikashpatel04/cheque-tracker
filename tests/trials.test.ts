/**
 * One free trial per person (migration 021), checked through the real
 * sign-up trigger. Addresses here are made up.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDatabase, type TestDatabase } from './support/db'

let t: TestDatabase
let next = 0

/** Signs up a new account with this address; returns its id. */
async function signUp(email: string | null): Promise<string> {
  next += 1
  const id = `00000000-0000-0000-0000-${String(next).padStart(12, '0')}`
  await t.addUser(id, email)
  return id
}

async function outcome(id: string): Promise<'trial' | string | null> {
  const trial = await t.asAdmin<{ n: number }>(`SELECT count(*)::int AS n FROM entitlements WHERE user_id = $1 AND source = 'trial'`, [id])
  if (trial.rows[0].n) return 'trial'
  const refusal = await t.asAdmin<{ reason: string }>('SELECT reason FROM trial_refusals WHERE user_id = $1', [id])
  return refusal.rows[0]?.reason ?? null
}

beforeAll(async () => {
  t = await createTestDatabase()
  await t.asAdmin(`UPDATE instance_config SET billing_enabled = true, trial_days = 14`)
})

describe('one free trial per person', () => {
  it('gives a new address its trial', async () => {
    expect(await outcome(await signUp('asha.rao@example.com'))).toBe('trial')
  })

  it('treats an inbox written another way as the same person', async () => {
    expect(await outcome(await signUp('ASHA.RAO@Example.com'))).toBe('used')
    expect(await outcome(await signUp('ravi.kumar@gmail.com'))).toBe('trial')
    expect(await outcome(await signUp('r.a.v.i.kumar+2@googlemail.com'))).toBe('used')
    expect(await outcome(await signUp('ravi@outlook.com'))).toBe('trial')
    expect(await outcome(await signUp('Ravi+cheques@outlook.com'))).toBe('used')
  })

  it('never takes different people for one, whatever their names', async () => {
    // Other people called Ravi Kumar, with their own addresses.
    expect(await outcome(await signUp('ravikumar@yahoo.com'))).toBe('trial')
    expect(await outcome(await signUp('ravi.kumar@outlook.com'))).toBe('trial')
    expect(await outcome(await signUp('ravi.kumar@company.example'))).toBe('trial')
    // A company's own addresses: dots and + can name different people there.
    expect(await outcome(await signUp('ravikumar@company.example'))).toBe('trial')
    expect(await outcome(await signUp('ravi+kumar@company.example'))).toBe('trial')
    expect(await outcome(await signUp('ashara.o@example.com'))).toBe('trial')
  })

  it('remembers an address after its account is deleted', async () => {
    const id = await signUp('meena@example.org')
    expect(await outcome(id)).toBe('trial')
    // As account deletion (plan item 57) will: the account's rows go first.
    await t.asAdmin('DELETE FROM settings WHERE user_id = $1', [id])
    await t.asAdmin('DELETE FROM auth.users WHERE id = $1', [id])
    expect(await outcome(await signUp('meena@example.org'))).toBe('used')
  })

  it('gives no trial to throwaway-mail addresses, subdomains included, but still opens the account', async () => {
    const id = await signUp('someone@mailinator.com')
    expect(await outcome(id)).toBe('throwaway')
    expect(await outcome(await signUp('someone@inbox.yopmail.com'))).toBe('throwaway')
    const settings = await t.asAdmin<{ n: number }>('SELECT count(*)::int AS n FROM settings WHERE user_id = $1', [id])
    expect(settings.rows[0].n).toBe(1)
  })

  it('gives no trial without an address', async () => {
    expect(await outcome(await signUp(null))).toBe('no_email')
  })

  it('records nothing when billing is off', async () => {
    await t.asAdmin('UPDATE instance_config SET billing_enabled = false')
    try {
      const id = await signUp('self.hosted@example.com')
      expect(await outcome(id)).toBeNull()
      const claims = await t.asAdmin<{ n: number }>(
        "SELECT count(*)::int AS n FROM internal.trial_claims WHERE email_hash = internal.email_hash('self.hosted@example.com')"
      )
      expect(claims.rows[0].n).toBe(0)
    } finally {
      await t.asAdmin('UPDATE instance_config SET billing_enabled = true')
    }
  })

  it('keeps only a hash of each address', async () => {
    const { rows } = await t.asAdmin<{ email_hash: string }>('SELECT email_hash FROM internal.trial_claims')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.email_hash))).toBe(true)
  })
})

describe('adding throwaway-mail domains', () => {
  it('works the way docs/editions.md shows, with a pasted list', async () => {
    // As pasted from the public list: one domain per line, Windows line ends, a stray blank line.
    const pasted = 'example-throwaway.test\r\nAnother-Throwaway.test\r\n\r\nnot a domain\r\nmailinator.com\r\n'
    await t.asAdmin(`
      insert into internal.throwaway_email_domains (domain)
      select distinct lower(d) from regexp_split_to_table($$${pasted}$$, '\\s+') as d
      where lower(d) ~ '^[a-z0-9-]+(\\.[a-z0-9-]+)+$'
      on conflict do nothing`)
    expect(await outcome(await signUp('someone@another-throwaway.test'))).toBe('throwaway')
  })
})

describe('who can see what', () => {
  it('lets users read only why they themselves got no trial', async () => {
    const refused = await signUp('again@mailinator.com')
    await signUp('another@mailinator.com')
    const own = await t.asUser<{ reason: string }>(refused, 'SELECT reason FROM trial_refusals')
    expect(own.rows).toEqual([{ reason: 'throwaway' }])
    await expect(t.asUser(refused, 'DELETE FROM trial_refusals')).rejects.toThrow(/permission denied/)
  })

  it('keeps the claims and the throwaway list away from users', async () => {
    const id = await signUp('curious@example.com')
    await expect(t.asUser(id, 'SELECT * FROM internal.trial_claims')).rejects.toThrow(/permission denied/)
    await expect(t.asUser(id, 'SELECT * FROM internal.throwaway_email_domains')).rejects.toThrow(/permission denied/)
    await expect(t.asUser(id, `SELECT internal.claim_trial('x@example.com')`)).rejects.toThrow(/permission denied/)
  })
})
