import { describe, expect, it } from 'vitest'
import { daysLeft, needsPlan, nextPlanChange, planAt, readOnlyWording } from '@/lib/plan'
import type { Entitlement } from '@/types'

const NOW = Date.parse('2026-10-01T10:00:00Z')
const DAY = 86_400_000

function grant(source: Entitlement['source'], startsIn: number, endsIn: number | null): Entitlement {
  return {
    id: `${source}-${startsIn}-${endsIn}`,
    user_id: 'u',
    plan: 'pro',
    source,
    starts_at: new Date(NOW + startsIn * DAY).toISOString(),
    expires_at: endsIn === null ? null : new Date(NOW + endsIn * DAY).toISOString(),
    payment_ref: null,
    note: null,
    created_at: new Date(NOW).toISOString(),
  }
}

describe('the plan at a moment', () => {
  it('gives everyone access when billing is off', () => {
    expect(planAt(false, [], NOW)).toEqual({ billingEnabled: false, hasAccess: true, current: null, ended: null })
  })

  it('is read-only with billing on and no active plan, and remembers what ended last', () => {
    const trial = grant('trial', -20, -6)
    const plan = planAt(true, [trial], NOW)
    expect(plan.hasAccess).toBe(false)
    expect(plan.ended).toBe(trial)
    expect(readOnlyWording(plan.ended)).toEqual({ title: 'Your free trial has ended', action: 'Choose a pack' })
  })

  it('picks the plan that lasts longest, and one that never ends first', () => {
    const trial = grant('trial', -2, 12)
    const pack = grant('purchase', -1, 180)
    expect(planAt(true, [trial, pack], NOW).current).toBe(pack)
    const comp = grant('comp', -1, null)
    expect(planAt(true, [trial, pack, comp], NOW).current).toBe(comp)
  })

  it("doesn't count a bought pack before it starts", () => {
    const next = grant('purchase', 3, 183)
    expect(planAt(true, [grant('purchase', -177, -1), next], NOW).hasAccess).toBe(false)
    expect(nextPlanChange([next], NOW)).toBe(NOW + 3 * DAY)
  })

  it('knows when it next changes by itself', () => {
    expect(nextPlanChange([grant('trial', -2, 12)], NOW)).toBe(NOW + 12 * DAY)
    expect(nextPlanChange([grant('comp', -2, null)], NOW)).toBeNull()
    expect(nextPlanChange([grant('purchase', -40, -10)], NOW)).toBeNull()
  })

  it('names plans that ended and accounts that never had one', () => {
    expect(readOnlyWording(grant('purchase', -200, -20))).toEqual({ title: 'Your plan has ended', action: 'Renew' })
    expect(readOnlyWording(null)).toEqual({ title: 'No active plan', action: 'Choose a pack' })
  })

  it('counts whole days left, never below zero', () => {
    expect(daysLeft(new Date(NOW + 2.5 * DAY).toISOString(), NOW)).toBe(3)
    expect(daysLeft(new Date(NOW - DAY).toISOString(), NOW)).toBe(0)
  })
})

describe('changes held back on a read-only account', () => {
  const api = 'https://project.supabase.co'

  it('are writes to the database API', () => {
    expect(needsPlan(`${api}/rest/v1/cheques`, 'POST')).toBe(true)
    expect(needsPlan(`${api}/rest/v1/cheques?id=eq.1`, 'PATCH')).toBe(true)
    expect(needsPlan(`${api}/rest/v1/rpc/change_cheque_status`, 'POST')).toBe(true)
  })

  it('never include reads, your settings, signing in or server functions such as paying', () => {
    expect(needsPlan(`${api}/rest/v1/cheques?select=*`, 'GET')).toBe(false)
    expect(needsPlan(`${api}/rest/v1/cheques`, 'HEAD')).toBe(false)
    expect(needsPlan(`${api}/rest/v1/settings?user_id=eq.1`, 'PATCH')).toBe(false)
    expect(needsPlan(`${api}/auth/v1/token?grant_type=password`, 'POST')).toBe(false)
    expect(needsPlan(`${api}/functions/v1/checkout`, 'POST')).toBe(false)
  })
})
