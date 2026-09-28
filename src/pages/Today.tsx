import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, Landmark, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { ChequeListDialog } from '@/components/today/ChequeListDialog'
import { FundsAddedToday } from '@/components/today/FundsAddedToday'
import { Tile } from '@/components/today/Tile'
import { TodoList } from '@/components/today/TodoList'
import { InOutChart, IncomingChart, OutgoingChart } from '@/components/today/TodayCharts'
import { ViewSwitch } from '@/components/today/ViewSwitch'
import { GivenWeekStrip, ReceivedWeekStrip } from '@/components/today/WeekStrip'
import { useAppActions } from '@/hooks/useAppActions'
import { useDeposits } from '@/hooks/useDeposits'
import { useSettings } from '@/hooks/useSettings'
import { useTodayData } from '@/hooks/useTodayData'
import { announceDataChange } from '@/lib/dataEvents'
import {
  formatLongDate,
  formatMoney,
  formatMoneyShort,
  formatShortDate,
  formatNet,
  formatSigned,
  todayISO,
} from '@/lib/formatters'
import { getActiveRegion } from '@/lib/region'
import {
  givenTodos,
  receivedTodos,
  sortTodos,
  summarizeGiven,
  summarizeReceived,
  weeklyInOut,
  type Todo,
  type TodayView,
} from '@/lib/today'
import { rollbackChequeStatus, updateChequeStatus } from '@/lib/updateChequeStatus'
import type { Cheque } from '@/types'

const VIEWS: TodayView[] = ['all', 'given', 'received']
const cheques = (n: number) => `${n} cheque${n === 1 ? '' : 's'}`

function NotFunded({ amount, count }: { amount: number; count: number }) {
  if (!count) return <span>Nothing due</span>
  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {amount > 0 ? (
        <>
          <span className="font-semibold text-attention lg:hidden">{formatMoneyShort(amount)} not funded</span>
          <span className="inline-flex h-[26px] items-center rounded-full bg-attention-soft px-2.5 text-[13px] font-medium text-attention max-lg:hidden">
            {formatMoney(amount)} not funded
          </span>
        </>
      ) : (
        <span className="font-medium text-cleared">All funded</span>
      )}
      <span className="max-lg:hidden">{cheques(count)}</span>
    </span>
  )
}

function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 lg:gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className={i === 0 ? 'col-span-2 h-[132px] rounded-xl lg:col-span-1' : 'h-[132px] rounded-xl'} />
        ))}
      </div>
      <Skeleton className="h-[112px] rounded-xl" />
      <Skeleton className="h-[260px] rounded-xl" />
    </div>
  )
}

/** Today: what needs doing, in one of three views (docs/feature-map.md, Views). */
export default function Today() {
  const { settings } = useSettings()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const actions = useAppActions()
  const { given, received, loading, error } = useTodayData()
  const { todayTotal } = useDeposits()
  const [list, setList] = useState<{ title: string; description?: string; cheques: Cheque[] } | null>(null)

  const today = todayISO()
  const { chequeValidityMonths, clearingDays } = getActiveRegion()
  const rules = useMemo(() => ({ chequeValidityMonths, clearingDays }), [chequeValidityMonths, clearingDays])

  // The view comes from the address bar, else from Settings → What you track.
  const tracks = settings.tracks ?? 'both'
  const fallback: TodayView = tracks === 'both' ? 'all' : tracks
  const asked = params.get('view') as TodayView | null
  const view: TodayView = asked && VIEWS.includes(asked) ? asked : fallback
  const setView = (next: TodayView) => {
    const nextParams = new URLSearchParams(params)
    if (next === fallback) nextParams.delete('view')
    else nextParams.set('view', next)
    setParams(nextParams, { replace: true })
  }

  const givenSummary = useMemo(() => summarizeGiven(given, today), [given, today])
  const receivedSummary = useMemo(() => summarizeReceived(received, today, rules), [received, today, rules])
  const weeks = useMemo(() => weeklyInOut(given, received, today, rules), [given, received, today, rules])
  const todos = useMemo(
    () =>
      sortTodos([
        ...(view === 'received' ? [] : givenTodos(given, today)),
        ...(view === 'given' ? [] : receivedTodos(received, today, rules)),
      ]),
    [view, given, received, today, rules]
  )

  /** Mark one cheque funded or passed, with an undo in the message. */
  const setStatus = async (cheque: Cheque, status: 'DEPOSITED' | 'PASSED') => {
    const word = status === 'DEPOSITED' ? 'funded' : 'passed'
    const result = await updateChequeStatus(cheque.id, status, { changedBy: 'manual' })
    if (!result.success) {
      toast.error(`Couldn't mark it ${word}: ${result.error}`)
      return
    }
    announceDataChange()
    toast.success(`Marked ${word}: the cheque to ${cheque.party?.name ?? 'the party'}`, {
      action: {
        label: 'Undo',
        onClick: async () => {
          const undo = await rollbackChequeStatus(cheque.id)
          if (undo.success) announceDataChange()
          else toast.error(`Couldn't undo: ${undo.error}`)
        },
      },
    })
  }

  const onAction = (todo: Todo) => {
    switch (todo.kind) {
      case 'fund': {
        if (todo.cheques.length === 1) return void setStatus(todo.cheques[0], 'DEPOSITED')
        const needed = todo.cheques.reduce((sum, c) => sum + Number(c.amount), 0)
        return actions.addFunds(needed)
      }
      case 'passed':
        if (todo.cheques.length === 1) return void setStatus(todo.cheques[0], 'PASSED')
        return setList({
          title: `Did ${todo.cheques.length} funded cheques pass?`,
          description: 'Open each one to mark it passed, or returned if it bounced.',
          cheques: todo.cheques,
        })
      case 'returned':
        if (todo.cheques.length === 1) return actions.openCheque(todo.cheques[0].id)
        return navigate('/cheques?dir=given&view=returned')
      case 'deposit':
        return actions.depositReceived(todo.cheques.map((c) => c.id))
      case 'going_stale':
        return actions.depositReceived([todo.cheque.id])
      case 'clearing':
        if (todo.cheques.length === 1) return actions.actOnReceived('clear', todo.cheques[0])
        return navigate('/cheques?dir=received&view=in_clearing')
      case 'bounced':
      case 'stale':
      case 'security':
        return actions.openReceivedCheque(todo.cheque.id)
    }
  }

  const needed = givenSummary.neededNow
  const neededText = !needed.due
    ? 'Nothing is due today'
    : needed.notFunded
      ? `${needed.notFunded} of ${cheques(needed.due)} due ${needed.notFunded === 1 ? "isn't" : "aren't"} funded`
      : `All ${cheques(needed.due)} due are funded`
  const net = weeks[0].in - weeks[0].out
  const nothingGiven = !loading && given.length === 0
  const nothingReceived = !loading && received.length === 0

  const subtitle =
    view === 'given' ? (
      <>
        {formatLongDate(today)}
        <span className="max-lg:hidden">
          {' · '}
          <FundsAddedToday total={todayTotal} />
        </span>
      </>
    ) : (
      formatLongDate(today)
    )

  return (
    <div>
      <PageHeader title="Today" subtitle={subtitle} actions={<ViewSwitch value={view} onChange={setView} className="w-full" />} />

      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-problem-line bg-problem-soft p-3 text-sm text-problem">
          Couldn't load everything: {error}
        </p>
      )}

      {loading ? (
        <Loading />
      ) : (
        <div className="flex flex-col gap-[18px] lg:gap-6">
          {view === 'given' && (
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 lg:gap-4">
              <Tile
                hero
                className="col-span-2 lg:col-span-1"
                label="Needed in the bank today"
                value={formatMoney(needed.amount)}
                tone={needed.amount ? 'attention' : 'out'}
                highlight={needed.amount > 0}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <span>
                    {neededText}
                    <span className="lg:hidden">
                      {' · '}
                      <FundsAddedToday total={todayTotal} label="added today" />
                    </span>
                  </span>
                  <Button className="max-lg:h-12 max-lg:text-base lg:text-sm" onClick={() => actions.addFunds(needed.amount || undefined)}>
                    <Wallet />
                    Add funds
                  </Button>
                </div>
              </Tile>
              <Tile
                label="Due in the next 7 days"
                shortLabel="Due in 7 days"
                value={formatSigned(givenSummary.next7.amount, 'out')}
                shortValue={formatSigned(givenSummary.next7.amount, 'out', formatMoneyShort)}
              >
                <NotFunded amount={givenSummary.next7.notFunded} count={givenSummary.next7.count} />
              </Tile>
              <Tile
                label="Outstanding"
                value={formatSigned(givenSummary.outstanding.amount, 'out')}
                shortValue={formatSigned(givenSummary.outstanding.amount, 'out', formatMoneyShort)}
              >
                {givenSummary.outstanding.count ? (
                  <>
                    {cheques(givenSummary.outstanding.count)} to pass
                    {givenSummary.outstanding.lastDue && (
                      <span className="max-lg:hidden"> · last one due {formatShortDate(givenSummary.outstanding.lastDue)}</span>
                    )}
                  </>
                ) : (
                  'Nothing left to pass'
                )}
              </Tile>
            </div>
          )}

          {view === 'received' && (
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 lg:gap-4">
              <Tile
                hero
                className="col-span-2 lg:col-span-1"
                label="To deposit now"
                value={formatSigned(receivedSummary.toDeposit.amount, 'in')}
                tone={receivedSummary.toDeposit.amount ? 'in' : 'out'}
                highlight={receivedSummary.toDeposit.count > 0}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <span>
                    {receivedSummary.toDeposit.count
                      ? `${cheques(receivedSummary.toDeposit.count)}${receivedSummary.toDeposit.overdue ? ` · ${receivedSummary.toDeposit.overdue} overdue` : ''}`
                      : 'Nothing to deposit today'}
                  </span>
                  <Button
                    className="max-lg:h-12 max-lg:text-base lg:text-sm"
                    disabled={!receivedSummary.toDeposit.count}
                    onClick={() => actions.depositReceived(receivedSummary.toDeposit.ids)}
                  >
                    <Landmark />
                    Deposit
                  </Button>
                </div>
              </Tile>
              <Tile
                label="In clearing"
                value={formatSigned(receivedSummary.inClearing.amount, 'in')}
                shortValue={formatSigned(receivedSummary.inClearing.amount, 'in', formatMoneyShort)}
                tone={receivedSummary.inClearing.amount ? 'in' : 'out'}
              >
                <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  {receivedSummary.inClearing.slow > 0 && (
                    <span className="inline-flex items-center rounded-full font-medium text-attention lg:h-[26px] lg:bg-attention-soft lg:px-2.5 lg:text-[13px]">
                      {receivedSummary.inClearing.slow} {receivedSummary.inClearing.slow === 1 ? 'is' : 'are'} taking longer than usual
                    </span>
                  )}
                  <span className={receivedSummary.inClearing.slow ? 'max-lg:hidden' : undefined}>
                    {cheques(receivedSummary.inClearing.count)}
                  </span>
                </span>
              </Tile>
              <Tile
                label="Coming in, next 30 days"
                shortLabel="Coming in, 30 days"
                value={formatSigned(receivedSummary.comingIn30.amount, 'in')}
                shortValue={formatSigned(receivedSummary.comingIn30.amount, 'in', formatMoneyShort)}
                tone={receivedSummary.comingIn30.amount ? 'in' : 'out'}
              >
                {cheques(receivedSummary.comingIn30.count)} in hand
                {receivedSummary.comingIn30.security > 0 && (
                  <span className="max-lg:hidden">
                    {' '}
                    · plus {receivedSummary.comingIn30.security} security cheque{receivedSummary.comingIn30.security === 1 ? '' : 's'} held
                  </span>
                )}
              </Tile>
            </div>
          )}

          {view === 'all' && (
            <div className="grid grid-cols-3 gap-2 lg:gap-4">
              <Tile
                label="In clearing"
                icon={<ArrowDownLeft className="h-[18px] w-[18px] text-money-in max-lg:hidden" strokeWidth={2.4} aria-hidden="true" />}
                value={formatSigned(receivedSummary.inClearing.amount, 'in')}
                shortValue={formatSigned(receivedSummary.inClearing.amount, 'in', formatMoneyShort)}
                tone={receivedSummary.inClearing.amount ? 'in' : 'out'}
              >
                {cheques(receivedSummary.inClearing.count)}
                <span className="max-lg:hidden"> · usually clear in {clearingDays} day{clearingDays === 1 ? '' : 's'}</span>
              </Tile>
              <Tile
                label="Due in 7 days"
                shortLabel="Due, 7 days"
                icon={<ArrowUpRight className="h-[18px] w-[18px] text-money-out max-lg:hidden" strokeWidth={2.4} aria-hidden="true" />}
                value={formatSigned(givenSummary.next7.amount, 'out')}
                shortValue={formatSigned(givenSummary.next7.amount, 'out', formatMoneyShort)}
              >
                <NotFunded amount={givenSummary.next7.notFunded} count={givenSummary.next7.count} />
              </Tile>
              <Tile
                label="Net, next 7 days"
                shortLabel="Net, 7 days"
                value={formatNet(net)}
                shortValue={formatNet(net, formatMoneyShort)}
                tone={net >= 0 ? 'in' : 'out'}
              >
                <span className="lg:hidden">in minus out</span>
                <span className="tabular-nums max-lg:hidden">
                  {formatMoney(weeks[0].in)} in · {formatMoney(weeks[0].out)} out
                </span>
              </Tile>
            </div>
          )}

          {view === 'given' && !nothingGiven && (
            <GivenWeekStrip days={givenSummary.week} onSelectDay={(date) => navigate(`/calendar?date=${date}&dir=given`)} />
          )}
          {view === 'received' && !nothingReceived && <ReceivedWeekStrip days={receivedSummary.week} />}

          {(view === 'given' && nothingGiven) || (view === 'received' && nothingReceived) ? (
            <section className="flex flex-col items-start gap-3 rounded-xl border bg-surface p-5 lg:p-6">
              <h2 className="text-[19px] font-semibold">
                {view === 'given' ? 'No cheques given yet' : 'No received cheques yet'}
              </h2>
              <p className="max-w-prose text-ink-quiet">
                {view === 'given'
                  ? "Add the cheques you write to people. Today then shows what's due, what needs funds, and what went through."
                  : 'Cheques people give you show here: what to deposit and when, what is clearing, and what bounced.'}
              </p>
              {view === 'given' ? (
                <Button onClick={() => actions.newGivenCheque()}>
                  <ArrowUpRight />
                  Add a given cheque
                </Button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => actions.newReceivedCheque()}>
                    <ArrowDownLeft />
                    Add a received cheque
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/settings')}>
                    Try with sample data
                  </Button>
                </div>
              )}
            </section>
          ) : (
            <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start lg:gap-4">
              <TodoList
                todos={todos}
                today={today}
                loading={false}
                onAction={onAction}
                emptyHint={
                  view === 'received'
                    ? 'Nothing to deposit, check or decide today.'
                    : view === 'given'
                      ? 'Every cheque due is funded, and nothing came back.'
                      : 'Nothing to deposit, fund or decide today.'
                }
              />
              {view === 'given' && <OutgoingChart days={givenSummary.next30} />}
              {view === 'received' && <IncomingChart weeks={receivedSummary.weeks} />}
              {view === 'all' && <InOutChart weeks={weeks} />}
            </div>
          )}
        </div>
      )}

      <ChequeListDialog
        title={list?.title ?? null}
        description={list?.description}
        cheques={list?.cheques ?? []}
        onClose={() => setList(null)}
        onSelect={(id) => {
          setList(null)
          actions.openCheque(id)
        }}
      />
    </div>
  )
}

