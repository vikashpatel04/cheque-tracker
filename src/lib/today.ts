import { addDays, format, parseISO } from 'date-fns'
import { isLegacyRepresented } from './chequeTags'
import { lastValidDay, receivedAlerts, STALE_WARNING_DAYS, type AlertRules } from './receivedSchedule'
import type { Cheque } from '@/types'
import type { ReceivedCheque } from '@/types/received'

/**
 * What Today shows: the numbers, the week strip, the chart and the to-dos,
 * for cheques you give, cheques you receive, or both. Pure functions of the
 * cheques and today's date (yyyy-MM-dd, in the user's time zone), so they're
 * easy to test. Wording is left to the screen.
 */

/** Which cheques Today shows. Only a view: it never changes the account. */
export type TodayView = 'all' | 'given' | 'received'

const ISO = 'yyyy-MM-dd'
export const plusDays = (day: string, days: number) => format(addDays(parseISO(day), days), ISO)
const amountOf = (c: { amount: number | null }) => Number(c.amount ?? 0)
const total = (cheques: { amount: number | null }[]) => cheques.reduce((sum, c) => sum + amountOf(c), 0)
const byDue = <T extends { due_date: string }>(a: T, b: T) => a.due_date.localeCompare(b.due_date)

/** Given cheques still to pass: waiting for funds (PENDING) or funded (DEPOSITED). */
const isOpenGiven = (c: Cheque) => c.status === 'PENDING' || c.status === 'DEPOSITED'
/** Received cheques that will bring money in: regular ones still in hand. */
const isToDeposit = (c: ReceivedCheque) => c.status === 'IN_HAND' && c.kind === 'REGULAR'

/* ---------- Given ---------- */

export interface GivenDay {
  date: string
  count: number
  funded: number
  notFunded: number
}

export interface GivenSummary {
  /** Cheques due today or earlier that aren't funded, and how many are due in all. */
  neededNow: { amount: number; notFunded: number; due: number }
  next7: { amount: number; notFunded: number; count: number }
  outstanding: { amount: number; count: number; lastDue: string | null }
  /** Today and the next six days. */
  week: GivenDay[]
  /** Thirty days from today. Today also carries unfunded cheques that are overdue. */
  next30: GivenDay[]
}

export function summarizeGiven(cheques: Cheque[], today: string): GivenSummary {
  const open = cheques.filter(isOpenGiven)
  const dueNow = open.filter((c) => c.due_date <= today)
  const notFundedNow = dueNow.filter((c) => c.status === 'PENDING')
  const weekEnd = plusDays(today, 6)
  const next7 = open.filter((c) => c.due_date >= today && c.due_date <= weekEnd)

  const overdueUnfunded = open.filter((c) => c.status === 'PENDING' && c.due_date < today)
  const dueOn = (date: string) => open.filter((c) => c.due_date === date)
  const day = (date: string, due: Cheque[]): GivenDay => ({
    date,
    count: due.length,
    funded: total(due.filter((c) => c.status === 'DEPOSITED')),
    notFunded: total(due.filter((c) => c.status === 'PENDING')),
  })

  return {
    neededNow: { amount: total(notFundedNow), notFunded: notFundedNow.length, due: dueNow.length },
    next7: {
      amount: total(next7),
      notFunded: total(next7.filter((c) => c.status === 'PENDING')),
      count: next7.length,
    },
    outstanding: {
      amount: total(open),
      count: open.length,
      lastDue: open.length ? open.reduce((last, c) => (c.due_date > last ? c.due_date : last), open[0].due_date) : null,
    },
    week: Array.from({ length: 7 }, (_, i) => day(plusDays(today, i), dueOn(plusDays(today, i)))),
    next30: Array.from({ length: 30 }, (_, i) => {
      const date = plusDays(today, i)
      return day(date, i === 0 ? [...overdueUnfunded, ...dueOn(date)] : dueOn(date))
    }),
  }
}

/* ---------- Received ---------- */

export interface ReceivedDay {
  date: string
  count: number
  amount: number
  /** On today's card: cheques whose deposit date has already passed. */
  overdue: number
  /** The earliest day a cheque due that day goes stale, when it's soon. */
  staleOn: string | null
}

export interface ReceivedWeek {
  start: string
  /** Cheques to deposit that week; the first week also has the overdue ones. */
  in: number
}

export interface ReceivedSummary {
  toDeposit: { amount: number; count: number; overdue: number; ids: string[] }
  inClearing: { amount: number; count: number; slow: number }
  comingIn30: { amount: number; count: number; security: number }
  week: ReceivedDay[]
  /** Four weeks from today. */
  weeks: ReceivedWeek[]
}

/** The day a cheque stops being valid, if it has a date on it. */
function staleDate(c: ReceivedCheque, rules: AlertRules): string | null {
  return c.cheque_date ? lastValidDay(c.cheque_date, rules.chequeValidityMonths) : null
}

export function summarizeReceived(cheques: ReceivedCheque[], today: string, rules: AlertRules): ReceivedSummary {
  const inHand = cheques.filter(isToDeposit).filter((c) => {
    const stale = staleDate(c, rules)
    return !stale || stale >= today
  })
  const dueNow = inHand.filter((c) => c.due_date <= today)
  const clearing = cheques.filter((c) => c.status === 'DEPOSITED')
  const monthEnd = plusDays(today, 30)
  const coming = inHand.filter((c) => c.due_date > today && c.due_date <= monthEnd)

  const week = Array.from({ length: 7 }, (_, i): ReceivedDay => {
    const date = plusDays(today, i)
    const due = inHand.filter((c) => c.due_date === date)
    const warnings = due
      .map((c) => staleDate(c, rules))
      .filter((d): d is string => !!d && d <= plusDays(date, STALE_WARNING_DAYS))
      .sort()
    return {
      date,
      count: due.length,
      amount: total(due),
      overdue: i === 0 ? total(inHand.filter((c) => c.due_date < today)) : 0,
      staleOn: warnings[0] ?? null,
    }
  })

  return {
    toDeposit: {
      amount: total(dueNow),
      count: dueNow.length,
      overdue: dueNow.filter((c) => c.due_date < today).length,
      ids: dueNow.map((c) => c.id),
    },
    inClearing: {
      amount: total(clearing),
      count: clearing.length,
      slow: clearing.filter((c) => receivedAlerts(c, today, rules).includes('check_clearing')).length,
    },
    comingIn30: {
      amount: total(coming),
      count: coming.length,
      security: cheques.filter((c) => c.status === 'IN_HAND' && c.kind === 'SECURITY').length,
    },
    week,
    weeks: Array.from({ length: 4 }, (_, i) => {
      const start = plusDays(today, i * 7)
      const end = plusDays(start, 6)
      return { start, in: total(inHand.filter((c) => (i === 0 || c.due_date >= start) && c.due_date <= end)) }
    }),
  }
}

/* ---------- Both ---------- */

export interface WeekTotals {
  start: string
  in: number
  out: number
}

/**
 * Money in and out for four weeks from today. The first week also carries
 * what's already due: cheques in clearing or waiting to be deposited, and
 * given cheques not funded yet.
 */
export function weeklyInOut(given: Cheque[], received: ReceivedCheque[], today: string, rules: AlertRules): WeekTotals[] {
  const open = given.filter(isOpenGiven)
  const overdueUnfunded = open.filter((c) => c.status === 'PENDING' && c.due_date < today)
  const inClearing = total(received.filter((c) => c.status === 'DEPOSITED'))
  const inHand = received.filter(isToDeposit).filter((c) => {
    const stale = staleDate(c, rules)
    return !stale || stale >= today
  })
  return Array.from({ length: 4 }, (_, i) => {
    const start = plusDays(today, i * 7)
    const end = plusDays(start, 6)
    const within = <T extends { due_date: string }>(list: T[]) =>
      list.filter((c) => (i === 0 || c.due_date >= start) && c.due_date <= end)
    return i === 0
      ? {
          start,
          in: inClearing + total(within(inHand)),
          out: total(overdueUnfunded) + total(within(open).filter((c) => c.due_date >= today)),
        }
      : { start, in: total(within(inHand)), out: total(within(open)) }
  })
}

/* ---------- To-dos ---------- */

export type TodoGroup = 'overdue' | 'today' | 'week'
export const TODO_GROUPS: TodoGroup[] = ['overdue', 'today', 'week']

export type Todo =
  /** Add funds for given cheques due on `date` (or overdue ones). `funded` are due the same day and already covered. */
  | { kind: 'fund'; group: TodoGroup; key: string; date: string; cheques: Cheque[]; funded: Cheque[] }
  /** Funded given cheques past their due date: did they pass? */
  | { kind: 'passed'; group: 'overdue'; key: string; date: string; cheques: Cheque[] }
  /** Given cheques that came back and need a decision: present again or write off. */
  | { kind: 'returned'; group: 'today'; key: string; date: string; cheques: Cheque[] }
  /** Received cheques to deposit. `staleOn` is the earliest day one of them stops being valid. */
  | { kind: 'deposit'; group: 'overdue' | 'today'; key: string; date: string; cheques: ReceivedCheque[]; staleOn: string | null }
  /** A cheque in hand that goes stale soon; its deposit day hasn't come yet. */
  | { kind: 'going_stale'; group: 'week'; key: string; date: string; cheque: ReceivedCheque; staleOn: string }
  /** Past its validity: it can't be deposited any more. */
  | { kind: 'stale'; group: 'overdue'; key: string; date: string; cheque: ReceivedCheque; staleOn: string }
  /** Deposited together and still not marked cleared after the usual clearing time. */
  | { kind: 'clearing'; group: 'overdue'; key: string; date: string; cheques: ReceivedCheque[] }
  /** A received cheque that bounced and needs a decision. */
  | { kind: 'bounced'; group: 'today'; key: string; date: string; cheque: ReceivedCheque }
  /** A security cheque whose review date has come or is this week. */
  | { kind: 'security'; group: TodoGroup; key: string; date: string; cheque: ReceivedCheque }

export const isReceivedTodo = (todo: Todo) =>
  todo.kind === 'deposit' ||
  todo.kind === 'going_stale' ||
  todo.kind === 'stale' ||
  todo.kind === 'clearing' ||
  todo.kind === 'bounced' ||
  todo.kind === 'security'

/** The cheque amounts a to-do is about. */
export function todoAmount(todo: Todo): number | null {
  switch (todo.kind) {
    case 'going_stale':
    case 'stale':
    case 'bounced':
    case 'security':
      return todo.cheque.amount === null ? null : amountOf(todo.cheque)
    default:
      return total(todo.cheques)
  }
}

export function givenTodos(cheques: Cheque[], today: string): Todo[] {
  const open = cheques.filter(isOpenGiven).sort(byDue)
  const todos: Todo[] = []

  const overdueUnfunded = open.filter((c) => c.status === 'PENDING' && c.due_date < today)
  if (overdueUnfunded.length) {
    todos.push({ kind: 'fund', group: 'overdue', key: 'fund-overdue', date: overdueUnfunded[0].due_date, cheques: overdueUnfunded, funded: [] })
  }
  const overdueFunded = open.filter((c) => c.status === 'DEPOSITED' && c.due_date < today)
  if (overdueFunded.length) {
    todos.push({ kind: 'passed', group: 'overdue', key: 'passed', date: overdueFunded[0].due_date, cheques: overdueFunded })
  }

  const returned = cheques.filter((c) => c.status === 'RETURNED' && !isLegacyRepresented(c)).sort(byDue)
  if (returned.length) {
    todos.push({ kind: 'returned', group: 'today', key: 'returned', date: returned[0].due_date, cheques: returned })
  }

  // Add funds, one to-do per day: today, then the rest of the week.
  for (let i = 0; i < 7; i++) {
    const date = plusDays(today, i)
    const due = open.filter((c) => c.due_date === date)
    const unfunded = due.filter((c) => c.status === 'PENDING')
    if (unfunded.length) {
      todos.push({
        kind: 'fund',
        group: i === 0 ? 'today' : 'week',
        key: `fund-${date}`,
        date,
        cheques: unfunded,
        funded: due.filter((c) => c.status === 'DEPOSITED'),
      })
    }
  }
  return todos
}

export function receivedTodos(cheques: ReceivedCheque[], today: string, rules: AlertRules): Todo[] {
  const todos: Todo[] = []
  const overdue: ReceivedCheque[] = []
  const dueToday: ReceivedCheque[] = []
  const clearing = new Map<string, ReceivedCheque[]>()
  const weekEnd = plusDays(today, 6)

  for (const c of [...cheques].sort(byDue)) {
    const alerts = receivedAlerts(c, today, rules)
    const stale = staleDate(c, rules)
    if (alerts.includes('stale') && stale) {
      todos.push({ kind: 'stale', group: 'overdue', key: `stale-${c.id}`, date: stale, cheque: c, staleOn: stale })
    } else if (alerts.includes('deposit_overdue')) {
      overdue.push(c)
    } else if (alerts.includes('deposit_today')) {
      dueToday.push(c)
    } else if (alerts.includes('going_stale') && stale) {
      todos.push({ kind: 'going_stale', group: 'week', key: `going-stale-${c.id}`, date: stale, cheque: c, staleOn: stale })
    }

    if (alerts.includes('check_clearing')) {
      const key = `${c.deposited_on}|${c.deposit_account_id ?? ''}`
      clearing.set(key, [...(clearing.get(key) ?? []), c])
    }
    if (alerts.includes('needs_decision')) {
      todos.push({ kind: 'bounced', group: 'today', key: `bounced-${c.id}`, date: c.bounced_on ?? c.due_date, cheque: c })
    }
    if (c.status === 'IN_HAND' && c.kind === 'SECURITY' && c.due_date <= weekEnd) {
      const group: TodoGroup = c.due_date < today ? 'overdue' : c.due_date === today ? 'today' : 'week'
      todos.push({ kind: 'security', group, key: `security-${c.id}`, date: c.due_date, cheque: c })
    }
  }

  const earliestStale = (list: ReceivedCheque[]) =>
    list
      .map((c) => staleDate(c, rules))
      .filter((d): d is string => !!d)
      .sort()[0] ?? null
  if (overdue.length) {
    todos.push({ kind: 'deposit', group: 'overdue', key: 'deposit-overdue', date: overdue[0].due_date, cheques: overdue, staleOn: earliestStale(overdue) })
  }
  if (dueToday.length) {
    todos.push({ kind: 'deposit', group: 'today', key: 'deposit-today', date: today, cheques: dueToday, staleOn: earliestStale(dueToday) })
  }
  for (const [key, list] of clearing) {
    todos.push({ kind: 'clearing', group: 'overdue', key: `clearing-${key}`, date: list[0].deposited_on ?? today, cheques: list })
  }
  return todos
}

/** Within a group, the things that move money come first, then decisions, then checks. */
const KIND_ORDER: Todo['kind'][] = ['deposit', 'fund', 'bounced', 'returned', 'clearing', 'passed', 'stale', 'going_stale', 'security']

/** Overdue, then today, then this week; within each, by KIND_ORDER, then earlier dates first. */
export function sortTodos(todos: Todo[]): Todo[] {
  const group = (todo: Todo) => TODO_GROUPS.indexOf(todo.group)
  const kind = (todo: Todo) => KIND_ORDER.indexOf(todo.kind)
  return [...todos].sort((a, b) => group(a) - group(b) || kind(a) - kind(b) || a.date.localeCompare(b.date))
}
