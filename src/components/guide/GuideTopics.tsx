import { Link } from 'react-router-dom'
import { ArrowDown } from 'lucide-react'
import { Chip } from '@/components/shared/Chip'
import { useSettings } from '@/hooks/useSettings'
import { formatMoney } from '@/lib/formatters'
import type { GuideTopicId } from '@/lib/guide'
import { STALE_WARNING_DAYS } from '@/lib/receivedSchedule'
import { getActiveRegion } from '@/lib/region'
import { GIVEN_STATUS_CHIPS, RECEIVED_STATUS_CHIPS } from '@/lib/statusChips'
import { STATUS_LABELS, type ChequeStatus } from '@/types'
import { RECEIVED_STATUS_LABELS, type ReceivedStatus } from '@/types/received'

/*
 * The guide's answers (plan item 75), one per topic in src/lib/guide.ts.
 * Button names are the app's own, in bold, so people can find them. Numbers
 * that depend on the user (clearing days, validity, auto-pass time) come
 * from their settings.
 */

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function Given({ status }: { status: ChequeStatus }) {
  const { tone, icon } = GIVEN_STATUS_CHIPS[status]
  return (
    <Chip tone={tone} icon={icon}>
      {STATUS_LABELS[status]}
    </Chip>
  )
}

function Received({ status }: { status: ReceivedStatus }) {
  const { tone, icon } = RECEIVED_STATUS_CHIPS[status]
  return (
    <Chip tone={tone} icon={icon}>
      {RECEIVED_STATUS_LABELS[status]}
    </Chip>
  )
}

/** A button's name, as it reads in the app. */
function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>
}

/** A stage in a life cycle: its chip and what it means. */
function Stage({ chip, children }: { chip: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="shrink-0 sm:w-[132px]">{chip}</span>
      <span className="text-sm leading-5 text-ink-nav">{children}</span>
    </li>
  )
}

/** The step between two stages: what you (or the bank) do. */
function Step({ children }: { children: React.ReactNode }) {
  return (
    <li className="ml-[13px] flex items-center gap-2 border-l-2 border-line-strong py-2 pl-4 text-sm text-ink-quiet">
      <ArrowDown className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}

/** A branch off the usual path, in its own box. */
function Branch({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-line-soft bg-background p-3.5">
      <p className="text-sm font-semibold">{title}</p>
      <ul className="flex flex-col gap-2">{children}</ul>
    </div>
  )
}

function Path({ children }: { children: React.ReactNode }) {
  return <ol className="flex flex-col">{children}</ol>
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-6 text-ink-nav">{children}</p>
}

function GivenLifeCycle() {
  return (
    <>
      <P>From the day you write it to the day the bank pays it:</P>
      <Path>
        <Stage chip={<Given status="PENDING" />}>Written and given to the party. The money for it isn't set aside yet.</Stage>
        <Step>
          <B>Mark funded</B>, or tick it in <B>Add funds</B>, once the money is in the bank
        </Step>
        <Stage chip={<Given status="DEPOSITED" />}>The money to cover it is in the bank, waiting for the cheque.</Stage>
        <Step>
          <B>Mark passed</B> when the bank pays it (auto-pass can do this for you)
        </Step>
        <Stage chip={<Given status="PASSED" />}>Paid. Nothing more to do.</Stage>
      </Path>
      <Branch title="If it doesn't go that way">
        <Stage chip={<Given status="RETURNED" />}>
          The bank didn't pay it (<B>It came back unpaid…</B>). You still owe the money: <B>Present it again</B> with a new date, or{' '}
          <B>Write it off…</B> and <B>Issue a new cheque</B> if you'll pay by cheque.
        </Stage>
        <Stage chip={<Given status="WRITTEN_OFF" />}>Settled some other way, or not paid at all. It stays in the history.</Stage>
        <Stage chip={<Given status="CANCELLED" />}>Never used: torn up, lost, or taken back before its date.</Stage>
      </Branch>
    </>
  )
}

function ReceivedLifeCycle() {
  const { clearingDays } = getActiveRegion()
  return (
    <>
      <P>From the day someone gives it to you to the day the money is in your account:</P>
      <Path>
        <Stage chip={<Received status="IN_HAND" />}>You have it. Deposit it on or after the date on it.</Stage>
        <Step>
          <B>Deposit</B> into one of your accounts
        </Step>
        <Stage chip={<Received status="DEPOSITED" />}>
          Your bank is collecting the money, which usually takes {clearingDays ? plural(clearingDays, 'day') : 'a day'}.
        </Stage>
        <Step>
          <B>Mark cleared</B> when the money arrives
        </Step>
        <Stage chip={<Received status="CLEARED" />}>The money is in your account. Nothing more to do.</Stage>
      </Path>
      <Branch title="If it bounces">
        <Stage chip={<Received status="BOUNCED" />}>
          Their bank refused it (<B>Mark bounced</B>). They still owe you: <B>Deposit again</B>, record that it was <B>Paid another way</B>,{' '}
          <B>Replace with a new cheque</B>, or <B>Write off</B>.
        </Stage>
      </Branch>
      <Branch title="Other ways it can end">
        <Stage chip={<Received status="SETTLED" />}>Paid another way, such as cash or a transfer, so the cheque wasn't needed.</Stage>
        <Stage chip={<Received status="REPLACED" />}>They gave you a new cheque for it. The new one starts in hand.</Stage>
        <Stage chip={<Received status="HANDED_BACK" />}>You gave it back, for example a security cheque once a loan was repaid.</Stage>
        <Stage chip={<Received status="WRITTEN_OFF" />}>You don't expect the money any more.</Stage>
      </Branch>
    </>
  )
}

function AutoPass() {
  const { settings } = useSettings()
  const on = settings.auto_pass_enabled
  const time = settings.auto_pass_time?.slice(0, 5) || '23:59'
  return (
    <>
      <P>
        With auto-pass on, funded cheques are marked passed on their due date, at the time you choose, in your time zone. It saves you
        marking each one, on the understanding that a funded cheque gets paid.
      </P>
      <P>
        Pending cheques are never passed by themselves: the money for them wasn't set aside. If a cheque came back after all, open it and choose{' '}
        <B>It came back unpaid…</B>, or <B>Undo last change</B>.
      </P>
      <P>
        It's {on ? `on, at ${time}` : 'off'}.{' '}
        <Link to="/settings#given" className="font-semibold text-brand hover:underline">
          Change it in Settings
        </Link>
      </P>
    </>
  )
}

function Stale() {
  const { chequeValidityMonths } = getActiveRegion()
  return (
    <>
      <P>
        Banks accept a cheque for a limited time after the date on it: {plural(chequeValidityMonths, 'month')} for you. After that it's stale,
        and the bank will refuse it.
      </P>
      <P>
        The app warns you {plural(STALE_WARNING_DAYS, 'day')} before a cheque you hold goes stale, and tells you when one already has. Deposit
        it before then, or ask for a new one.
      </P>
      <P>
        If your bank's rule is different,{' '}
        <Link to="/settings#region" className="font-semibold text-brand hover:underline">
          change it in Settings → Region
        </Link>
        .
      </P>
    </>
  )
}

function Clearing() {
  const { clearingDays } = getActiveRegion()
  return (
    <>
      <P>
        After you deposit a cheque, your bank collects the money from theirs. For you that usually takes{' '}
        {clearingDays ? plural(clearingDays, 'day') : 'less than a day'}, and the cheque shows <B>In clearing</B> meanwhile.
      </P>
      <P>
        When the money arrives, choose <B>Mark cleared</B>. If it's taking longer than usual, the app asks whether it has cleared, so nothing is
        forgotten.
      </P>
      <P>
        <Link to="/settings#region" className="font-semibold text-brand hover:underline">
          Change the usual number of days in Settings → Region
        </Link>
      </P>
    </>
  )
}

function Totals() {
  return (
    <>
      <P>Totals count money that moved, or will. They leave out cheques that were cancelled, written off, handed back or replaced, and security cheques you're holding.</P>
      <P>
        <B>Still to pay</B> is cheques you gave that are pending, funded or came back. <B>Still to collect</B> is cheques you received that are
        in hand, in clearing or bounced.
      </P>
      <P>
        Where money goes both ways with a party, <B>Net still due</B> says which way in words, like “{formatMoney(5000)} to collect”, rather
        than with a minus sign. Reports group cheques by their due date.
      </P>
    </>
  )
}

/** The answer to one guide topic. */
export function TopicAnswer({ id }: { id: GuideTopicId }) {
  switch (id) {
    case 'given':
      return <GivenLifeCycle />
    case 'received':
      return <ReceivedLifeCycle />
    case 'bounce':
      return (
        <>
          <P>
            <strong className="font-semibold text-ink">A cheque you gave:</strong> choose <B>It came back unpaid…</B> and note why. It stays
            returned, since you still owe the money, until you <B>Present it again</B> with a new date or <B>Write it off…</B>. After a write-off,{' '}
            <B>Issue a new cheque</B> if you'll pay by cheque.
          </P>
          <P>
            <strong className="font-semibold text-ink">A cheque you received:</strong> choose <B>Mark bounced</B>, with the reason and any bank
            charges. Then <B>Deposit again</B>, record that it was <B>Paid another way</B>, <B>Replace with a new cheque</B>, or{' '}
            <B>Write off</B>.
          </P>
          <P>
            Reports → Bounces shows every cheque that came back, both ways, and why.
          </P>
        </>
      )
    case 'add-funds':
      return (
        <>
          <P>
            <B>Add funds</B> is how you record money you put into the bank to cover cheques you gave. Enter the amount, and the app ticks the
            pending cheques it covers, soonest due first (or the order you choose in Settings). Every ticked cheque becomes funded at once.
          </P>
          <P>
            <B>Funds added today</B> starts from zero each day, because it's the money you put in that day. Earlier days are kept: Reports →
            Accounts and funds shows them.
          </P>
          <P>
            For a single cheque, its <B>Mark funded</B> button does the same.
          </P>
        </>
      )
    case 'auto-pass':
      return <AutoPass />
    case 'security':
      return (
        <>
          <P>
            A security cheque is one someone gives you to hold, not to deposit: against a loan, a rent deposit or goods on credit. It's often
            left blank or undated.
          </P>
          <P>
            Add it with the kind <B>Security</B>. It stays in hand with a date to review it, isn't counted as money you're owed, and the app
            reminds you on the review date. If you ever need to deposit it, open it and choose <B>Deposit</B>. Once it's no longer needed,{' '}
            <B>Hand back</B>.
          </P>
        </>
      )
    case 'stale':
      return <Stale />
    case 'clearing':
      return <Clearing />
    case 'undo':
      return (
        <>
          <P>
            Yes. Every change is kept in the cheque's history. Open the cheque and choose <B>Undo last change</B> to step back one change at a
            time, as far as you need.
          </P>
          <P>To fix a typo in the amount, number or dates, use <B>Edit</B> instead: it doesn't change where the cheque stands.</P>
        </>
      )
    case 'totals':
      return <Totals />
    case 'tracks':
      return (
        <>
          <P>
            Yes. In{' '}
            <Link to="/settings#track" className="font-semibold text-brand hover:underline">
              Settings → What you track
            </Link>
            , choose Cheques I give, Cheques I receive, or Both. Today, Cheques and the New menu open on your choice.
          </P>
          <P>Nothing is hidden for good: All, Given and Received stay one tap away.</P>
        </>
      )
  }
}
