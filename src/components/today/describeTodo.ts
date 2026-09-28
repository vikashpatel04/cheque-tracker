import { ArrowDownLeft, Check, CircleX, Hourglass, ShieldCheck, TriangleAlert, Wallet, type LucideIcon } from 'lucide-react'
import { formatMoney, formatShortDate } from '@/lib/formatters'
import type { ChipTone } from '@/lib/statusChips'
import { isReceivedTodo, type Todo } from '@/lib/today'
import type { Cheque } from '@/types'
import type { ReceivedCheque } from '@/types/received'

/** How a to-do reads on Today: its words, icon and main action. */
export interface TodoText {
  title: string
  detail: string
  icon: LucideIcon
  tone: ChipTone | 'in' | 'out'
  direction: 'in' | 'out'
  action: string
  /** Only the main daily actions (deposit, add funds) are solid buttons. */
  primary: boolean
}

const party = (c: Cheque | ReceivedCheque) => c.party?.name ?? 'a party'
const names = (list: (Cheque | ReceivedCheque)[]) => {
  const unique = [...new Set(list.map(party))]
  return unique.length > 3 ? `${unique.slice(0, 3).join(', ')} and ${unique.length - 3} more` : unique.join(', ')
}
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function account(c: ReceivedCheque): string {
  const a = c.deposit_account
  if (!a) return ''
  return ` into ${a.name}${a.last4 ? ` ···${a.last4}` : ''}`
}

export function describeTodo(todo: Todo, today: string): TodoText {
  const direction = isReceivedTodo(todo) ? 'in' : 'out'
  switch (todo.kind) {
    case 'fund': {
      const [first] = todo.cheques
      const one = todo.cheques.length === 1
      const when =
        todo.group === 'overdue'
          ? one
            ? `Was due ${formatShortDate(first.due_date)}`
            : `Overdue since ${formatShortDate(first.due_date)}`
          : todo.date === today
            ? 'Due today'
            : `Due ${formatShortDate(todo.date)}`
      const funded = todo.funded.length
        ? todo.funded.length === 1
          ? ` · ${party(todo.funded[0])} (${formatMoney(Number(todo.funded[0].amount))}) is already funded`
          : ` · ${plural(todo.funded.length, 'other')} already funded`
        : ''
      return {
        title: one
          ? `Add funds for ${party(first)}`
          : todo.group === 'overdue'
            ? `Add funds for ${todo.cheques.length} overdue cheques`
            : `Add funds for ${todo.cheques.length} cheques due ${todo.date === today ? 'today' : formatShortDate(todo.date)}`,
        detail: one ? `${when}${funded}` : `${names(todo.cheques)}${todo.group === 'week' ? '' : ` · ${when.toLowerCase()}`}`,
        icon: Wallet,
        tone: 'attention',
        direction,
        action: 'Add funds',
        primary: todo.group !== 'week',
      }
    }
    case 'passed': {
      const one = todo.cheques.length === 1
      return {
        title: one ? `Did the cheque to ${party(todo.cheques[0])} pass?` : `Did ${todo.cheques.length} funded cheques pass?`,
        detail: one
          ? `Was due ${formatShortDate(todo.cheques[0].due_date)} · funded`
          : `Funded, and due from ${formatShortDate(todo.cheques[0].due_date)} to ${formatShortDate(todo.cheques[todo.cheques.length - 1].due_date)}`,
        icon: Check,
        tone: 'out',
        direction,
        action: one ? 'Mark passed' : 'Review',
        primary: false,
      }
    }
    case 'returned': {
      const one = todo.cheques.length === 1
      const c = todo.cheques[0]
      return {
        title: one ? `Cheque to ${party(c)} was returned` : `${todo.cheques.length} returned cheques need a decision`,
        detail: one ? `Was due ${formatShortDate(c.due_date)} · ${c.return_reason || 'no reason noted'}` : names(todo.cheques),
        icon: CircleX,
        tone: 'problem',
        direction,
        action: one ? 'Decide' : 'Review',
        primary: false,
      }
    }
    case 'deposit': {
      const one = todo.cheques.length === 1
      const stale = todo.staleOn ? ` · goes stale on ${formatShortDate(todo.staleOn)}` : ''
      return {
        title: one
          ? `Deposit the cheque from ${party(todo.cheques[0])}`
          : todo.group === 'overdue'
            ? `Deposit ${todo.cheques.length} overdue cheques`
            : `Deposit ${todo.cheques.length} cheques`,
        detail: one
          ? todo.group === 'overdue'
            ? `Was due ${formatShortDate(todo.cheques[0].due_date)}${stale}`
            : `Due today${stale}`
          : `${names(todo.cheques)}${stale}`,
        icon: ArrowDownLeft,
        tone: 'in',
        direction,
        action: 'Deposit',
        primary: true,
      }
    }
    case 'clearing': {
      const one = todo.cheques.length === 1
      return {
        title: one ? `Did the cheque from ${party(todo.cheques[0])} clear?` : `Did ${todo.cheques.length} cheques clear?`,
        detail: `Deposited ${formatShortDate(todo.date)}${account(todo.cheques[0])}`,
        icon: Hourglass,
        tone: 'progress',
        direction,
        action: 'Check',
        primary: false,
      }
    }
    case 'bounced': {
      const c = todo.cheque
      const charges = Number(c.bank_charges ?? 0)
      return {
        title: `Cheque from ${party(c)} bounced`,
        detail: `${c.bounce_reason || 'No reason noted'}${charges ? ` · bank charges ${formatMoney(charges)}` : ''}`,
        icon: CircleX,
        tone: 'problem',
        direction,
        action: 'Decide',
        primary: false,
      }
    }
    case 'stale':
      return {
        title: `Cheque from ${party(todo.cheque)} went stale`,
        detail: `On ${formatShortDate(todo.staleOn)} · the bank won't take it now`,
        icon: TriangleAlert,
        tone: 'problem',
        direction,
        action: 'Decide',
        primary: false,
      }
    case 'going_stale':
      return {
        title: `Cheque from ${party(todo.cheque)} goes stale on ${formatShortDate(todo.staleOn)}`,
        detail: `Dated ${formatShortDate(todo.cheque.cheque_date ?? todo.cheque.due_date)} · due to deposit ${formatShortDate(todo.cheque.due_date)}`,
        icon: TriangleAlert,
        tone: 'attention',
        direction,
        action: 'Deposit',
        primary: false,
      }
    case 'security':
      return {
        title: `Review the security cheque from ${party(todo.cheque)}`,
        detail: todo.cheque.notes || `Review date ${formatShortDate(todo.cheque.due_date)}`,
        icon: ShieldCheck,
        tone: 'done',
        direction,
        action: 'Review',
        primary: false,
      }
  }
}
