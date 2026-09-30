import type { AllocationSort, Cheque, Party } from '@/types'

export interface AllocationItem {
  cheque: Cheque & { party: Party }
  selected: boolean
}

export function sortChequesForAllocation(
  cheques: (Cheque & { party: Party })[],
  sortOrder: AllocationSort
): (Cheque & { party: Party })[] {
  const sorted = [...cheques]
  switch (sortOrder) {
    case 'amount_asc':
      return sorted.sort((a, b) => Number(a.amount) - Number(b.amount))
    case 'amount_desc':
      return sorted.sort((a, b) => Number(b.amount) - Number(a.amount))
    case 'due_date_asc':
    default:
      return sorted.sort(
        (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      )
  }
}

export function suggestAllocation(
  cheques: (Cheque & { party: Party })[],
  depositAmount: number,
  sortOrder: AllocationSort
): AllocationItem[] {
  const sorted = sortChequesForAllocation(cheques, sortOrder)
  let remaining = depositAmount

  return sorted.map((cheque) => {
    const amount = Number(cheque.amount)
    const canCover = remaining >= amount
    const selected = canCover
    if (selected) {
      remaining -= amount
    }
    return { cheque, selected }
  })
}

/**
 * Add funds into one account (plan item 78): that account's cheques are
 * covered first, then older cheques with no account; cheques drawn on your
 * other accounts are left out. With no account chosen, every cheque counts.
 */
export function suggestForAccount(
  cheques: (Cheque & { party: Party })[],
  depositAmount: number,
  sortOrder: AllocationSort,
  accountId: string | null
): AllocationItem[] {
  if (!accountId) return suggestAllocation(cheques, depositAmount, sortOrder)
  const first = suggestAllocation(
    cheques.filter((c) => c.bank_account_id === accountId),
    depositAmount,
    sortOrder
  )
  const used = first.filter((i) => i.selected).reduce((sum, i) => sum + Number(i.cheque.amount), 0)
  return [...first, ...suggestAllocation(cheques.filter((c) => !c.bank_account_id), depositAmount - used, sortOrder)]
}

export type DueGroup = 'overdue' | 'today' | 'tomorrow' | 'later'

export const DUE_GROUPS: { key: DueGroup; label: string }[] = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'later', label: 'Later' },
]

/** Where a cheque goes in the Add funds list's dividers (plan item 79). Dates are yyyy-MM-dd. */
export function dueGroup(dueDate: string, today: string, tomorrow: string): DueGroup {
  if (dueDate < today) return 'overdue'
  if (dueDate === today) return 'today'
  if (dueDate === tomorrow) return 'tomorrow'
  return 'later'
}

export function calculateAllocationTotals(items: AllocationItem[]) {
  const allocated = items
    .filter((i) => i.selected)
    .reduce((sum, i) => sum + Number(i.cheque.amount), 0)
  const selectedCount = items.filter((i) => i.selected).length

  return { allocated, selectedCount }
}

export function getRemainingBalance(
  items: AllocationItem[],
  depositAmount: number
): { allocated: number; remaining: number; exceeds: number } {
  const allocated = items
    .filter((i) => i.selected)
    .reduce((sum, i) => sum + Number(i.cheque.amount), 0)
  const remaining = depositAmount - allocated
  const exceeds = remaining < 0 ? Math.abs(remaining) : 0
  return { allocated, remaining: Math.max(0, remaining), exceeds }
}
