import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  AgeingBars,
  CashChart,
  FundsChart,
  MonthBars,
  PartyBars,
  PaymentsChart,
  RankBars,
  RunningChart,
  StandBar,
  TrendChart,
} from '@/components/reports/ReportCharts'
import { Figure, Figures, Key, OtherSide, ReportSection, ReportTableView } from '@/components/reports/ReportParts'
import type { DirectionTab } from '@/lib/chequeList'
import { formatMoney, formatNumber, formatSigned } from '@/lib/formatters'
import {
  accountsReport,
  bouncesReport,
  cashReport,
  collectionsReport,
  overviewReport,
  partiesReport,
  paymentsReport,
  type ReportInput,
  type ReportTab,
  type ReportTable,
} from '@/lib/reportTables'

interface TabProps {
  input: ReportInput
  onTab: (tab: ReportTab) => void
  onDirection: (dir: DirectionTab) => void
}

const plural = (count: number, word: string) => `${formatNumber(count)} ${word}${count === 1 ? '' : 's'}`
const percent = (part: number, whole: number) => (whole ? `${formatNumber((part / whole) * 100, 1)}%` : '—')
const table = (tables: ReportTable[], key: string) => tables.find((t) => t.key === key)!

function Stack({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-4 lg:gap-[18px]">{children}</div>
}

/* ---------- Overview ---------- */

export function OverviewTab({ input, onTab }: TabProps) {
  const report = useMemo(() => overviewReport(input), [input])
  const { figures: f } = report
  const showIn = input.dir !== 'given'
  const showOut = input.dir !== 'received'
  const funds = input.deposits.reduce((s, d) => s + Number(d.amount), 0)

  return (
    <Stack>
      <Figures>
        {showIn && (
          <Figure
            label="Received"
            value={formatSigned(f.received.amount, 'in')}
            tone={f.received.amount ? 'in' : undefined}
            sub={`${plural(f.received.count, 'cheque')} · ${formatMoney(f.received.cleared)} cleared`}
          />
        )}
        {showOut && (
          <Figure
            label="Given"
            value={formatMoney(f.given.amount)}
            sub={`${plural(f.given.count, 'cheque')} · ${formatMoney(f.given.passed)} passed`}
          />
        )}
        {showIn && (
          <Figure
            label="Still to collect"
            value={formatSigned(f.toCollect.amount, 'in')}
            tone={f.toCollect.amount ? 'in' : undefined}
            sub="In hand, in clearing or bounced"
          />
        )}
        {showOut && (
          <Figure
            label="Still to pay"
            value={formatMoney(f.toPay.amount)}
            sub={f.toPay.notFunded ? `${formatMoney(f.toPay.notFunded)} not funded yet` : f.toPay.amount ? 'All funded' : 'Nothing waiting'}
          />
        )}
        {!showIn && (
          <>
            <Figure
              label="Returned, still to pay"
              value={formatMoney(f.toPay.returned)}
              tone={f.toPay.returned ? 'problem' : undefined}
              sub="Came back unpaid; present again or settle"
            />
            <Figure label="Funds added" value={formatMoney(funds)} sub="Money you put in the bank for cheques" />
          </>
        )}
        {!showOut && (
          <>
            <Figure label="In clearing" value={formatSigned(f.toCollect.clearing, 'in')} sub="Deposited, waiting for the bank" />
            <Figure
              label="Bounced, still to collect"
              value={formatMoney(f.toCollect.bounced)}
              tone={f.toCollect.bounced ? 'problem' : undefined}
              sub="Deposit again or record how it was paid"
            />
          </>
        )}
      </Figures>
      {f.securityHeld > 0 && (
        <p className="-mt-1 text-sm text-ink-quiet">
          {plural(f.securityHeld, 'security cheque')} you hold {f.securityHeld === 1 ? "isn't" : "aren't"} counted: {f.securityHeld === 1 ? "it's" : "they're"} kept against a default, not money on the way.
        </p>
      )}

      <ReportSection
        title="Money in and out by month"
        note={input.months.length === 12 ? 'The last 12 months of the dates you chose, by due date.' : 'By due date.'}
        aside={
          <span className="flex gap-4">
            {showIn && <Key color="var(--money-in)">Received</Key>}
            {showOut && <Key color="var(--money-out)">Given</Key>}
          </span>
        }
      >
        <MonthBars months={report.months} showIn={showIn} showOut={showOut} />
      </ReportSection>

      <div className="grid gap-4 lg:gap-[18px] xl:grid-cols-2">
        <ReportSection title="Where the cheques stand">
          <div className="flex flex-col gap-5">
            {showIn && <StandBar direction="in" parts={report.received} />}
            {showOut && <StandBar direction="out" parts={report.given} />}
          </div>
        </ReportSection>
        <ReportSection
          title="Biggest parties"
          aside={
            <Button variant="link" className="h-auto p-0" onClick={() => onTab('parties')}>
              Every party
            </Button>
          }
        >
          <ReportTableView table={table(report.tables, 'biggest')} />
        </ReportSection>
      </div>
    </Stack>
  )
}

/* ---------- Cash flow ---------- */

export function CashFlowTab({ input }: TabProps) {
  const report = useMemo(() => cashReport(input), [input])
  const { around } = report
  const showIn = input.dir !== 'given'
  const showOut = input.dir !== 'received'
  const short = around.neededToday > around.fundsToday

  return (
    <Stack>
      <p className="text-sm text-ink-quiet">Around today: the dates filter doesn't change these figures or the 28-day chart.</p>
      <Figures>
        {showOut && (
          <Figure
            label="Needed today"
            value={formatMoney(around.neededToday)}
            tone={short ? 'attention' : undefined}
            sub={around.fundsToday ? `${formatMoney(around.fundsToday)} funds added today` : 'No funds added today'}
          />
        )}
        {showOut && <Figure label="Next 14 days, out" value={formatMoney(around.next.out)} sub={plural(around.next.outCount, 'cheque')} />}
        {showIn && (
          <Figure
            label="Next 14 days, in"
            value={formatSigned(around.next.in, 'in')}
            tone={around.next.in ? 'in' : undefined}
            sub={`${plural(around.next.inCount, 'cheque')} due`}
          />
        )}
        {showOut && (
          <Figure
            label="Last 14 days, passed"
            value={formatMoney(around.past.paid)}
            sub={`${formatMoney(around.past.funds)} funds added`}
          />
        )}
        {showIn && !showOut && (
          <Figure label="Last 14 days, cleared" value={formatSigned(around.past.cleared, 'in')} tone={around.past.cleared ? 'in' : undefined} />
        )}
      </Figures>

      <ReportSection title="28 days around today" note="Past days show what passed; today and later show what still needs money.">
        <CashChart days={report.days} showIn={showIn} showOut={showOut} />
      </ReportSection>

      <ReportSection title="Day by day" note={table(report.tables, 'days').note}>
        <ReportTableView table={table(report.tables, 'days')} />
      </ReportSection>

      <div className="grid gap-4 lg:gap-[18px] xl:grid-cols-2">
        <ReportSection title="Running total, next 30 days" note={table(report.tables, 'running').note}>
          <RunningChart running={report.running} showIn={showIn} showOut={showOut} />
        </ReportSection>
        {showOut && (
          <ReportSection title="Given cheques, last six months" note={table(report.tables, 'trend').note}>
            <TrendChart trend={report.trend} />
          </ReportSection>
        )}
      </div>

      <ReportSection title="Month by month" note="By due date, within the dates you chose.">
        <ReportTableView table={table(report.tables, 'months')} />
      </ReportSection>
    </Stack>
  )
}

/* ---------- Collections ---------- */

export function CollectionsTab({ input, onDirection }: TabProps) {
  const report = useMemo(() => collectionsReport(input), [input])
  if (input.dir === 'given') {
    return (
      <OtherSide action={<Button onClick={() => onDirection('received')}>Show received cheques</Button>}>
        Collections is about the cheques you receive. You're looking at given cheques only.
      </OtherSide>
    )
  }
  const { rate } = report
  return (
    <Stack>
      <Figures>
        <Figure
          label="Still to collect"
          value={formatSigned(report.toCollect.amount, 'in')}
          tone={report.toCollect.amount ? 'in' : undefined}
          sub={plural(report.toCollect.count, 'cheque')}
        />
        <Figure label="In clearing" value={formatSigned(report.clearing.amount, 'in')} sub={plural(report.clearing.count, 'cheque')} />
        <Figure
          label="Bounced, not collected"
          value={formatMoney(report.bounced.amount)}
          tone={report.bounced.amount ? 'problem' : undefined}
          sub={plural(report.bounced.count, 'cheque')}
        />
        <Figure
          label="Bounce rate"
          value={percent(rate.bounced, rate.deposited)}
          tone={rate.bounced ? 'problem' : undefined}
          sub={rate.deposited ? `${formatNumber(rate.bounced)} of ${plural(rate.deposited, 'cheque')} deposited` : 'Nothing deposited yet'}
        />
      </Figures>

      <div className="grid gap-4 lg:gap-[18px] xl:grid-cols-2">
        <ReportSection title="Ageing" note={table(report.tables, 'ageing').note}>
          <AgeingBars ageing={report.ageing} />
        </ReportSection>
        <ReportSection title="Who owes most">
          <ReportTableView table={table(report.tables, 'owers')} limit={8} />
        </ReportSection>
      </div>

      <ReportSection title="Still to collect, oldest first">
        <ReportTableView table={table(report.tables, 'open')} limit={10} />
      </ReportSection>
    </Stack>
  )
}

/* ---------- Payments ---------- */

export function PaymentsTab({ input, onDirection }: TabProps) {
  const report = useMemo(() => paymentsReport(input), [input])
  if (input.dir === 'received') {
    return (
      <OtherSide action={<Button onClick={() => onDirection('given')}>Show given cheques</Button>}>
        Payments is about the cheques you give. You're looking at received cheques only.
      </OtherSide>
    )
  }
  return (
    <Stack>
      <Figures>
        <Figure label="Given" value={formatMoney(report.given.amount)} sub={plural(report.given.count, 'cheque')} />
        <Figure label="Passed" value={formatMoney(report.passed)} sub="Paid from your account" />
        <Figure
          label="Still to pay"
          value={formatMoney(report.toPay.amount)}
          sub={report.toPay.notFunded ? `${formatMoney(report.toPay.notFunded)} not funded yet` : 'Nothing waiting for funds'}
        />
        <Figure
          label="Returned at some point"
          value={formatMoney(report.returned.amount)}
          tone={report.returned.count ? 'problem' : undefined}
          sub={plural(report.returned.count, 'cheque')}
        />
      </Figures>

      <ReportSection title="Month by month" note={table(report.tables, 'months').note}>
        <PaymentsChart months={report.months} />
        <ReportTableView table={table(report.tables, 'months')} />
      </ReportSection>

      <ReportSection title="By status" note="Every given cheque in these filters, including cancelled and written off.">
        <ReportTableView table={table(report.tables, 'statuses')} />
      </ReportSection>
    </Stack>
  )
}

/* ---------- Parties ---------- */

export function PartiesTab({ input }: TabProps) {
  const navigate = useNavigate()
  const report = useMemo(() => partiesReport(input), [input])
  const showIn = input.dir !== 'given'
  const showOut = input.dir !== 'received'
  const top = report.lines.slice(0, 8).map((p) => ({
    key: p.partyId,
    label: p.party,
    in: p.got.amount,
    out: p.gave.amount,
    onClick: () => navigate(`/parties/${p.partyId}`),
  }))
  return (
    <Stack>
      <ReportSection
        title="Top parties"
        note="The eight you've done the most with, in these filters."
        aside={
          <span className="flex gap-4">
            {showIn && <Key color="var(--money-in)">Received</Key>}
            {showOut && <Key color="var(--money-out)">Given</Key>}
          </span>
        }
      >
        {top.length ? <PartyBars items={top} showIn={showIn} showOut={showOut} /> : <p className="text-sm text-ink-quiet">Nothing here with these filters.</p>}
      </ReportSection>
      <ReportSection title="Every party" note="Open a party for its ledger.">
        <ReportTableView table={table(report.tables, 'parties')} limit={20} />
      </ReportSection>
    </Stack>
  )
}

/* ---------- Bounces ---------- */

export function BouncesTab({ input }: TabProps) {
  const navigate = useNavigate()
  const report = useMemo(() => bouncesReport(input), [input])
  const showIn = input.dir !== 'given'
  const showOut = input.dir !== 'received'
  return (
    <Stack>
      <Figures>
        {showOut && (
          <Figure
            label="Given, returned"
            value={formatMoney(report.given.amount)}
            tone={report.given.count ? 'problem' : undefined}
            sub={`${plural(report.given.count, 'cheque')} · ${formatMoney(report.given.open)} still to pay`}
          />
        )}
        {showIn && (
          <Figure
            label="Received, bounced"
            value={formatMoney(report.received.amount)}
            tone={report.received.count ? 'problem' : undefined}
            sub={`${plural(report.received.count, 'cheque')} · ${formatMoney(report.received.open)} still to collect`}
          />
        )}
        {showIn && (
          <Figure
            label="Bounce rate"
            value={percent(report.rate.bounced, report.rate.deposited)}
            sub={report.rate.deposited ? `Of ${plural(report.rate.deposited, 'cheque')} you deposited` : 'Nothing deposited yet'}
          />
        )}
        {showIn && <Figure label="Bank charges" value={formatMoney(report.received.charges)} sub="Recorded on bounced cheques" />}
      </Figures>

      <div className="grid gap-4 lg:gap-[18px] xl:grid-cols-2">
        <ReportSection title="By reason">
          <RankBars
            color="var(--status-problem)"
            items={report.byReason.map((g) => ({
              key: g.key || 'none',
              label: g.label || 'No reason noted',
              value: g.amount,
              note: `${formatNumber(g.count)} time${g.count === 1 ? '' : 's'}`,
            }))}
          />
        </ReportSection>
        <ReportSection title="By party">
          <RankBars
            color="var(--status-problem)"
            items={report.byParty.slice(0, 8).map((g) => ({
              key: g.key,
              label: g.label,
              value: g.amount,
              note: `${formatNumber(g.count)} time${g.count === 1 ? '' : 's'}`,
              onClick: () => navigate(`/parties/${g.key}`),
            }))}
          />
        </ReportSection>
      </div>

      <ReportSection title="Cheques that came back" note={table(report.tables, 'cheques').note}>
        <ReportTableView table={table(report.tables, 'cheques')} limit={10} />
      </ReportSection>
    </Stack>
  )
}

/* ---------- Accounts and funds ---------- */

export function AccountsTab({ input }: TabProps) {
  const report = useMemo(() => accountsReport(input), [input])
  const showIn = input.dir !== 'given'
  const showOut = input.dir !== 'received'
  const deposited = report.accounts.reduce((s, a) => s + a.deposited, 0)
  const cleared = report.accounts.reduce((s, a) => s + a.cleared, 0)
  const bankTotal = report.banks.reduce((s, b) => s + b.amount, 0)
  return (
    <Stack>
      <Figures>
        {showOut && (
          <Figure label="Funds added" value={formatMoney(report.funds.amount)} sub={`On ${plural(report.funds.days, 'day')}`} />
        )}
        {showOut && <Figure label="Cheque payments" value={formatMoney(report.payments)} sub="Given cheques funded or passed" />}
        {showIn && (
          <Figure
            label="Deposited"
            value={formatSigned(deposited, 'in')}
            tone={deposited ? 'in' : undefined}
            sub={`${formatMoney(cleared)} cleared`}
          />
        )}
        {showOut && <Figure label="Banks you pay from" value={formatNumber(report.banks.length)} sub={`${formatMoney(bankTotal)} given`} />}
      </Figures>
      {showOut && (
        <p className="-mt-1 text-sm text-ink-quiet">Funds added aren't tied to a party or a cheque's status, so only the dates filter changes them.</p>
      )}

      {showOut && (
        <ReportSection title="Given cheques by bank">
          <RankBars
            color="var(--brand)"
            items={report.banks.slice(0, 8).map((b) => ({
              key: b.bank,
              label: b.bank || 'No bank noted',
              value: b.amount,
              note: percent(b.amount, bankTotal),
            }))}
          />
          <ReportTableView table={table(report.tables, 'banks')} limit={8} />
        </ReportSection>
      )}

      {showIn && (
        <ReportSection title="Received cheques by account" note={table(report.tables, 'accounts').note}>
          <ReportTableView table={table(report.tables, 'accounts')} />
        </ReportSection>
      )}

      {showOut && (
        <ReportSection title="Funds added and cheque payments" note={table(report.tables, 'fund-days').note}>
          {report.days.length ? <FundsChart days={report.days} /> : <p className="text-sm text-ink-quiet">Nothing here with these filters.</p>}
          <ReportTableView table={table(report.tables, 'fund-months')} />
        </ReportSection>
      )}
    </Stack>
  )
}
