/**
 * Pausing sign-ups (migration 024): with instance_config.signups_open false,
 * Auth can't create an account or turn a demo into one, while demos still
 * start and existing accounts carry on. Data here is made up.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { REGION_PRESETS } from '@/config/regions'
import { regionFromPreset, regionToSettings } from '@/lib/region'
import { createTestDatabase, type TestDatabase } from './support/db'

const REGION = JSON.stringify(regionToSettings(regionFromPreset(REGION_PRESETS[0])))

let t: TestDatabase
let next = 0
const newId = () => `cccccccc-0000-4000-8000-${String(++next).padStart(12, '0')}`

/** A demo becoming an account, as Auth does when a demo user adds an email. */
const becomeAccount = (id: string) =>
  t.asAdmin("UPDATE auth.users SET is_anonymous = false, email = 'kept@example.com' WHERE id = $1", [id])

const setOpen = (open: boolean) => t.asAdmin('UPDATE instance_config SET signups_open = $1', [open])

beforeAll(async () => {
  t = await createTestDatabase()
})

describe('with sign-ups open, as every instance starts', () => {
  it('is open', async () => {
    const { rows } = await t.asAdmin('SELECT signups_open FROM instance_config')
    expect(rows).toEqual([{ signups_open: true }])
  })

  it('creates accounts and demos', async () => {
    await expect(t.addUser(newId())).resolves.toBeUndefined()
    await expect(t.addUser(newId(), null, { anonymous: true })).resolves.toBeUndefined()
  })

  it('lets a demo become an account', async () => {
    const demo = newId()
    await t.addUser(demo, null, { anonymous: true })
    await expect(becomeAccount(demo)).resolves.toBeDefined()
  })
})

describe('with sign-ups paused', () => {
  const existing = newId()

  beforeAll(async () => {
    await t.addUser(existing)
    await setOpen(false)
  })

  afterAll(() => setOpen(true))

  it('refuses a new account, whichever way Auth creates it', async () => {
    await expect(t.addUser(newId())).rejects.toThrow('Sign-ups are paused')
  })

  it('still starts a demo', async () => {
    const demo = newId()
    await t.addUser(demo, null, { anonymous: true })
    await t.asUser(demo, 'SELECT start_demo($1::jsonb)', [REGION])
    const { rows } = await t.asUser<{ n: number }>(demo, 'SELECT count(*)::int AS n FROM parties')
    expect(rows[0].n).toBeGreaterThan(0)
  })

  it("doesn't let a demo become an account", async () => {
    const demo = newId()
    await t.addUser(demo, null, { anonymous: true })
    await expect(becomeAccount(demo)).rejects.toThrow('Sign-ups are paused')
  })

  it('leaves existing accounts alone', async () => {
    await expect(t.asAdmin("UPDATE auth.users SET email = 'renamed@example.com' WHERE id = $1", [existing])).resolves.toBeDefined()
    await expect(t.asAdmin('UPDATE auth.users SET is_anonymous = false WHERE id = $1', [existing])).resolves.toBeDefined()
    const { rows } = await t.asUser<{ n: number }>(existing, 'SELECT count(*)::int AS n FROM settings')
    expect(rows[0].n).toBe(1)
  })

  it('opens again when the switch is turned back', async () => {
    await setOpen(true)
    await expect(t.addUser(newId())).resolves.toBeUndefined()
    await setOpen(false)
  })

  it("can't be changed by a signed-in user", async () => {
    await expect(t.asUser(existing, 'UPDATE instance_config SET signups_open = true')).rejects.toThrow()
    const { rows } = await t.asAdmin('SELECT signups_open FROM instance_config')
    expect(rows).toEqual([{ signups_open: false }])
  })

  it('can be read before signing in, so the app can say so', async () => {
    await t.db.exec('SET ROLE anon')
    try {
      const { rows } = await t.db.query('SELECT signups_open FROM instance_config')
      expect(rows).toEqual([{ signups_open: false }])
    } finally {
      await t.db.exec('RESET ROLE')
    }
  })
})
