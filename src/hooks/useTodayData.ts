import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { useDataChanges } from '@/lib/dataEvents'
import { fetchAllRows } from '@/lib/fetchAll'
import { todayISO } from '@/lib/formatters'
import { getActiveRegion } from '@/lib/region'
import { givenTodos, plusDays, receivedTodos, sortTodos, type Todo } from '@/lib/today'
import type { Cheque } from '@/types'
import type { ReceivedCheque } from '@/types/received'

/**
 * The cheques Today works from, shared by Today and the to-do count in the
 * sidebar, and refreshed whenever anything is saved:
 * - given cheques still open, plus every given cheque due from a month ago
 *   to two months ahead (for the day list behind the week strip);
 * - received cheques still in play.
 */
interface TodayData {
  loading: boolean
  given: Cheque[]
  received: ReceivedCheque[]
  error: string | null
}

let state: TodayData = { loading: true, given: [], received: [], error: null }
let started = false
let loadCount = 0
const listeners = new Set<() => void>()

function setState(next: Partial<TodayData>) {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
}

async function load() {
  started = true
  const run = ++loadCount
  const today = todayISO()
  const [open, around, received] = await Promise.all([
    fetchAllRows<Cheque>('cheques', '*, party:parties(*)', {
      activeOnly: true,
      oneOf: { column: 'status', values: ['PENDING', 'DEPOSITED', 'RETURNED'] },
    }),
    fetchAllRows<Cheque>('cheques', '*, party:parties(*)', {
      activeOnly: true,
      between: { column: 'due_date', from: plusDays(today, -31), to: plusDays(today, 62) },
    }),
    fetchAllRows<ReceivedCheque>('received_cheques', '*, party:parties(*), deposit_account:bank_accounts(*)', {
      activeOnly: true,
      oneOf: { column: 'status', values: ['IN_HAND', 'DEPOSITED', 'BOUNCED'] },
    }),
  ])
  if (run !== loadCount) return // a newer load has started
  const given = new Map<string, Cheque>()
  for (const cheque of [...around.rows, ...open.rows]) given.set(cheque.id, cheque)
  setState({
    loading: false,
    given: [...given.values()],
    received: received.rows,
    error: open.error ?? around.error ?? received.error ?? null,
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useTodayData() {
  const snapshot = useSyncExternalStore(subscribe, () => state)
  useEffect(() => {
    if (!started) void load()
  }, [])
  const refresh = useCallback(() => void load(), [])
  useDataChanges(refresh)
  return snapshot
}

/** Everything to do today, both directions, most urgent first. */
export function useTodos(): { todos: Todo[]; loading: boolean } {
  const { given, received, loading } = useTodayData()
  const today = todayISO()
  const { chequeValidityMonths, clearingDays } = getActiveRegion()
  const todos = useMemo(
    () =>
      sortTodos([
        ...givenTodos(given, today),
        ...receivedTodos(received, today, { chequeValidityMonths, clearingDays }),
      ]),
    [given, received, today, chequeValidityMonths, clearingDays]
  )
  return { todos, loading }
}
