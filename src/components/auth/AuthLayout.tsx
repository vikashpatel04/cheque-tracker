import type { ReactNode } from 'react'
import { ArrowDownLeft, CalendarCheck, Hourglass, ArrowLeftRight, Smartphone, Wallet } from 'lucide-react'
import { AppLogo } from '@/components/shared/AppLogo'
import { SourceLink } from '@/components/shared/SourceLink'
import { brand } from '@/config/brand'
import { formatShortDate, formatSigned, todayISO } from '@/lib/formatters'
import { plusDays } from '@/lib/today'
import { cn } from '@/lib/utils'

interface AuthLayoutProps {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  /** Under the form, e.g. "New here? Create an account". */
  footer?: ReactNode
}

/**
 * The frame of the sign-in pages. Large screens get the product beside the
 * form: the tagline, a glimpse of Today and what the app does. Phones get the
 * form alone, as on the Signup-phone board.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <ProductPanel />
      <main className="flex min-h-dvh flex-col bg-background lg:bg-surface">
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col gap-[22px] px-5 pb-6 pt-9 sm:justify-center lg:max-w-[440px] lg:px-8">
          <AppLogo size="sm" className="lg:hidden" />
          <div className="flex flex-col gap-2">
            <h1 className="font-title text-[30px] leading-[38px]">{title}</h1>
            {subtitle && <div className="text-base leading-6 text-ink-quiet">{subtitle}</div>}
          </div>
          {children}
          {footer && <div className="text-center text-[15px]">{footer}</div>}
          <div className="flex-1 sm:flex-none" />
          <SourceLink className="text-center text-[13px] text-ink-quiet" />
        </div>
      </main>
    </div>
  )
}

/** Things the app does today. Keep these true as features change. */
const POINTS = [
  { Icon: ArrowLeftRight, text: 'The cheques you give and the cheques you receive, in one place.' },
  { Icon: CalendarCheck, text: 'Today shows what to deposit, what to fund and what came back.' },
  { Icon: Smartphone, text: 'Made for your phone too, and installs like an app.' },
]

function ProductPanel() {
  return (
    <aside className="hidden flex-col gap-10 border-r bg-background px-14 py-12 lg:flex xl:px-20">
      <AppLogo size="sm" />
      <div className="flex flex-1 flex-col justify-center gap-10">
        <div className="flex max-w-[520px] flex-col gap-4">
          <p className="font-title text-[44px] leading-[52px] text-ink">{brand.tagline}</p>
          <p className="text-lg leading-7 text-ink-quiet">For the cheques you give and the cheques you receive.</p>
        </div>
        <TodayPreview />
        <ul className="flex max-w-[520px] flex-col gap-3.5">
          {POINTS.map(({ Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-[15px] leading-6">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

/** A glimpse of Today with made-up cheques, in the app's own look. */
function TodayPreview() {
  const today = todayISO()
  const rows = [
    {
      Icon: ArrowDownLeft,
      tone: 'bg-money-in-soft text-money-in',
      title: 'Deposit 2 cheques',
      detail: `Nimbus Print Works and 1 more · goes stale ${formatShortDate(plusDays(today, 3))}`,
      amount: formatSigned(42000, 'in'),
      amountTone: 'text-money-in',
    },
    {
      Icon: Wallet,
      tone: 'bg-attention-soft text-attention',
      title: 'The cheque to Harbor Logistics needs funds',
      detail: `Due ${formatShortDate(plusDays(today, 2))}`,
      amount: formatSigned(18500, 'out'),
      amountTone: 'text-money-out',
    },
    {
      Icon: Hourglass,
      tone: 'bg-waiting-soft text-waiting',
      title: 'Did the cheque from Pinewood Studio clear?',
      detail: `Deposited ${formatShortDate(plusDays(today, -3))}`,
      amount: formatSigned(7250, 'in'),
      amountTone: 'text-money-in',
    },
  ]
  return (
    <figure aria-label="A preview of Today" className="max-w-[520px] overflow-hidden rounded-2xl border bg-surface shadow-pop">
      <div className="flex items-baseline justify-between border-b border-line-soft px-5 py-3.5">
        <span className="font-semibold">To do</span>
        <span className="text-sm text-ink-quiet">3 things</span>
      </div>
      <ul>
        {rows.map((row, i) => (
          <li
            key={row.title}
            className={cn('grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3.5 px-5 py-3', i > 0 && 'border-t border-line-soft')}
          >
            <span className={cn('flex h-9 w-9 items-center justify-center rounded-full', row.tone)}>
              <row.Icon className="h-[18px] w-[18px]" strokeWidth={2.1} aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[15px] font-semibold">{row.title}</span>
              <span className="truncate text-[13px] text-ink-quiet">{row.detail}</span>
            </span>
            <span className={cn('text-[15px] font-semibold tabular-nums', row.amountTone)}>{row.amount}</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}
