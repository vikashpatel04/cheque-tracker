import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatSigned } from '@/lib/formatters'
import { TONE_CLASSES } from '@/lib/statusChips'
import { TODO_GROUPS, todoAmount, type Todo, type TodoGroup } from '@/lib/today'
import { cn } from '@/lib/utils'
import { describeTodo } from './describeTodo'

const GROUP_LABELS: Record<TodoGroup, { label: string; className: string }> = {
  overdue: { label: 'Overdue', className: 'text-problem' },
  today: { label: 'Today', className: 'text-attention' },
  week: { label: 'This week', className: 'text-ink-quiet' },
}

const ICON_TONES = {
  in: 'bg-money-in-soft text-money-in',
  out: 'bg-money-out-soft text-money-out',
  ...TONE_CLASSES,
}

interface TodoListProps {
  todos: Todo[]
  today: string
  loading: boolean
  onAction: (todo: Todo) => void
  /** Shown when there's nothing to do. */
  emptyHint: string
}

function Amount({ todo, direction }: { todo: Todo; direction: 'in' | 'out' }) {
  const amount = todoAmount(todo)
  if (amount === null) return <span className="text-ink-quiet">No amount</span>
  return <span className={direction === 'in' ? 'text-money-in' : 'text-money-out'}>{formatSigned(amount, direction)}</span>
}

/** Things to do, grouped as overdue, today and this week, each with one action. */
export function TodoList({ todos, today, loading, onAction, emptyHint }: TodoListProps) {
  const count = todos.length
  return (
    <section aria-labelledby="todo-title" data-tour="todo" className="flex min-w-0 flex-col lg:overflow-hidden lg:rounded-xl lg:border lg:bg-surface">
      <div className="flex items-baseline justify-between pb-3 lg:border-b lg:border-line-soft lg:px-[22px] lg:py-[18px]">
        <h2 id="todo-title" className="text-xl font-semibold lg:text-[19px]">
          To do
        </h2>
        {!loading && <span className="text-sm text-ink-quiet">{count === 1 ? '1 thing' : `${count} things`}</span>}
      </div>

      {loading ? (
        <p className="py-6 text-sm text-ink-quiet lg:px-[22px]">Loading…</p>
      ) : count === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border bg-surface p-4 lg:rounded-none lg:border-0 lg:px-[22px] lg:py-6">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-money-in" aria-hidden="true" />
          <div>
            <p className="font-semibold">Nothing to do right now</p>
            <p className="text-sm text-ink-quiet">{emptyHint}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:gap-0">
          {TODO_GROUPS.map((group) => {
            const items = todos.filter((t) => t.group === group)
            if (!items.length) return null
            return (
              <div key={group} className="flex flex-col gap-2 lg:gap-0">
                <div
                  className={cn(
                    'text-xs font-bold uppercase tracking-[0.07em] lg:px-[22px] lg:pb-2 lg:pt-3.5',
                    GROUP_LABELS[group].className
                  )}
                >
                  {GROUP_LABELS[group].label}
                </div>
                {items.map((todo) => {
                  const text = describeTodo(todo, today)
                  const Icon = text.icon
                  return (
                    <div
                      key={todo.key}
                      className="flex flex-col gap-3 rounded-xl border bg-surface p-3.5 lg:grid lg:grid-cols-[40px_minmax(0,1fr)_auto_124px] lg:items-center lg:gap-4 lg:rounded-none lg:border-0 lg:border-t lg:border-line-soft lg:px-[22px] lg:py-3"
                    >
                      <div className="grid grid-cols-[38px_minmax(0,1fr)] items-start gap-3 lg:contents">
                        <span
                          aria-hidden="true"
                          className={cn(
                            'flex h-[38px] w-[38px] items-center justify-center rounded-full lg:h-10 lg:w-10',
                            ICON_TONES[text.tone]
                          )}
                        >
                          <Icon className="h-[19px] w-[19px] lg:h-5 lg:w-5" strokeWidth={2.1} />
                        </span>
                        <div className="flex min-w-0 flex-col gap-[3px]">
                          <span className="text-base font-semibold leading-snug">{text.title}</span>
                          <span className="text-sm text-ink-quiet lg:truncate">{text.detail}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 pl-[50px] lg:contents">
                        <span className="text-lg font-semibold tabular-nums lg:text-right lg:text-[17px]">
                          <Amount todo={todo} direction={text.direction} />
                        </span>
                        <Button
                          variant={text.primary ? 'default' : 'outline'}
                          className="min-w-[108px] lg:w-full lg:min-w-0 lg:px-3 lg:text-sm"
                          onClick={() => onAction(todo)}
                        >
                          {text.action}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
