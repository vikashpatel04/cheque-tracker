import { describe, expect, it } from 'vitest'
import { samplePlan, SAMPLE_NOTE } from '@/lib/sampleData'
import { receivedAlerts } from '@/lib/receivedSchedule'
import type { ReceivedCheque } from '@/types/received'

const TODAY = '2026-09-28'
const RULES = { chequeValidityMonths: 3, clearingDays: 2 }

/** The status and dates a sample cheque ends with once its steps have run. */
function after(c: ReturnType<typeof samplePlan>['received'][number]) {
  let status: ReceivedCheque['status'] = 'IN_HAND'
  let deposited_on: string | null = null
  for (const step of c.steps) {
    if (step.do === 'deposit') {
      status = 'DEPOSITED'
      deposited_on = step.on
    } else if (step.do === 'clear') status = 'CLEARED'
    else if (step.do === 'bounce') status = 'BOUNCED'
    else status = 'SETTLED'
  }
  return { status, kind: c.kind, due_date: c.due, cheque_date: c.chequeDate, deposited_on }
}

describe('sample data', () => {
  const plan = samplePlan(TODAY, RULES.chequeValidityMonths)

  it('is plainly fictional and marked for removal', () => {
    expect(plan.parties.every((name) => name.endsWith(' (sample)'))).toBe(true)
    expect(plan.received.every((c) => (c.notes ?? SAMPLE_NOTE).endsWith(SAMPLE_NOTE))).toBe(true)
  })

  it('shows every state Today and the list care about', () => {
    const alerts = plan.received.map((c) => receivedAlerts(after(c), TODAY, RULES))
    const all = alerts.flat()
    for (const alert of ['deposit_today', 'deposit_overdue', 'going_stale', 'check_clearing', 'needs_decision'] as const) {
      expect(all).toContain(alert)
    }
    const statuses = plan.received.map((c) => after(c).status)
    expect(new Set(statuses)).toEqual(new Set(['IN_HAND', 'DEPOSITED', 'BOUNCED', 'CLEARED', 'SETTLED']))
    expect(plan.received.some((c) => c.kind === 'SECURITY' && c.amount === null)).toBe(true)
  })

  it('never dates a step in the future or before the cheque came in', () => {
    for (const c of plan.received) {
      let last = c.receivedOn
      for (const step of c.steps) {
        expect(step.on >= last).toBe(true)
        expect(step.on <= TODAY).toBe(true)
        last = step.on
      }
    }
  })

  it('starts the monthly series on the first of next month', () => {
    expect(plan.series.firstDate).toBe('2026-10-01')
    expect(plan.series.count).toBe(6)
  })
})
