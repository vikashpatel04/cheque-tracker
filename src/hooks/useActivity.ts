import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase'
import { useDataChanges } from '@/lib/dataEvents'
import type { ChequeHistory } from '@/types'

/**
 * Recent changes to your cheques, for the bell. Loaded once and shared by
 * every bell on the page. "New" means newer than when you last opened it, on
 * this device.
 */
const LIMIT = 20
const SEEN_KEY = 'activity-seen-at'

interface ActivityState {
  items: ChequeHistory[] | null
  seenAt: string
}

let state: ActivityState = { items: null, seenAt: readSeenAt() }
let loading = false
const listeners = new Set<() => void>()

function readSeenAt(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? ''
  } catch {
    return ''
  }
}

function setState(next: Partial<ActivityState>) {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
}

async function load() {
  if (loading) return
  loading = true
  const { data } = await supabase
    .from('cheque_history')
    .select('*, cheque:cheques(*, party:parties(*))')
    // An import isn't something that happened to the cheque.
    .neq('changed_by', 'import')
    .order('created_at', { ascending: false })
    .limit(LIMIT)
  loading = false
  setState({ items: (data ?? []) as ChequeHistory[] })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useActivity() {
  const snapshot = useSyncExternalStore(subscribe, () => state)

  useEffect(() => {
    if (snapshot.items === null) void load()
  }, [snapshot.items])
  const refresh = useCallback(() => void load(), [])
  useDataChanges(refresh)

  const unread = (snapshot.items ?? []).filter((item) => item.created_at > snapshot.seenAt).length

  const markSeen = useCallback(() => {
    const newest = state.items?.[0]?.created_at
    if (!newest || newest <= state.seenAt) return
    try {
      localStorage.setItem(SEEN_KEY, newest)
    } catch {
      // Private browsing: it stays read until the page closes.
    }
    setState({ seenAt: newest })
  }, [])

  return { items: snapshot.items, unread, markSeen, refresh }
}
