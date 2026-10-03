import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SettingsSection } from '@/components/settings/SettingsSection'
import { Chip } from '@/components/shared/Chip'
import { brand } from '@/config/brand'
import { usePlan, type Plan } from '@/hooks/usePlan'
import { useSignOut } from '@/hooks/useSignOut'
import { formatMinorUnits, formatShortDate } from '@/lib/formatters'
import { buyPack, loadPacks, loadPayments, packTotal, savingPercent, type Pack, type PaymentOrder } from '@/lib/payments'
import { lapsedWording } from '@/lib/plan'

function describe(plan: Plan): string {
  const { current, until } = plan
  if (!current) {
    const wording = lapsedWording(plan)
    return `${wording.title}. ${wording.text}`
  }
  if (!current.expires_at || !until) return 'Business, with no end date.'
  if (current.source === 'trial') {
    return until === current.expires_at
      ? `Free trial of Business, ends ${formatShortDate(current.expires_at)}. After that you're on the Free plan: your cheques keep moving and you can export, but adding needs Business.`
      : `Free trial until ${formatShortDate(current.expires_at)}, then Business until ${formatShortDate(until)}.`
  }
  return `Business, until ${formatShortDate(until)}.`
}

/** What buying now does, in a line above the choices. */
function buyingNote(plan: Plan): string {
  if (plan.lapsed) return 'Choose how long you want Business for. It starts straight away.'
  if (plan.current?.source === 'trial' && plan.until === plan.current.expires_at) {
    return 'Business starts when your trial ends, so buying now loses no days.'
  }
  return 'More time starts when your current Business plan ends, so renewing early loses nothing.'
}

/** The brand colour for Razorpay's window, from the Passbook tokens. */
function brandColour(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--brand').trim()
}

function PackOption({ pack, packs, busy, onBuy }: { pack: Pack; packs: Pack[]; busy: boolean; onBuy: () => void }) {
  const saving = savingPercent(pack, packs)
  const perMonth = formatMinorUnits(pack.amount / pack.months, pack.currency, { whole: true })
  return (
    <li className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[15px] font-semibold">{pack.name}</span>
        {saving > 0 && (
          <Chip tone="cleared" size="sm">
            Save {saving}%
          </Chip>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[28px] font-semibold leading-[34px] tabular-nums">{formatMinorUnits(pack.amount, pack.currency)}</span>
        <span className="text-[13px] text-ink-quiet">
          {pack.months > 1 && `${perMonth} a month`}
          {pack.months > 1 && pack.tax_name && Number(pack.tax_percent) > 0 && ' · '}
          {pack.tax_name && Number(pack.tax_percent) > 0 && `plus ${formatMinorUnits(pack.tax_amount ?? 0, pack.currency)} ${pack.tax_name}`}
        </span>
      </div>
      <Button className="mt-auto w-full" disabled={busy} onClick={onBuy}>
        Pay {formatMinorUnits(packTotal(pack), pack.currency)}
      </Button>
    </li>
  )
}

/**
 * Settings → Plan, on instances with billing on: your plan (a trial, Business
 * or Free), how long to buy Business for, and your payments. The choices are
 * the `packs` rows. Hidden on self-hosted instances. The demo can't buy, so it
 * offers an account instead.
 */
export function PlanCard() {
  const plan = usePlan()
  const leave = useSignOut()
  const [packs, setPacks] = useState<Pack[]>([])
  const [payments, setPayments] = useState<PaymentOrder[]>([])
  const [buying, setBuying] = useState<string | null>(null)
  const shown = !plan.loading && plan.billingEnabled

  const reload = useCallback(() => {
    void loadPacks().then(setPacks)
    void loadPayments().then(setPayments)
  }, [])

  useEffect(() => {
    if (shown && !plan.demo) reload()
  }, [shown, plan.demo, reload])

  if (!shown) return null

  if (plan.demo) {
    return (
      <SettingsSection
        id="plan"
        title="Plan"
        description="The demo: everything in Business for a day, with made-up cheques. Create an account to keep track of your own."
      >
        <Button className="self-start" onClick={() => void leave('/signup')}>
          Create an account
        </Button>
      </SettingsSection>
    )
  }

  const forever = !!plan.current && !plan.until

  const buy = async (pack: Pack) => {
    setBuying(pack.id)
    const result = await buyPack(pack, { name: brand.name, color: brandColour() })
    setBuying(null)
    if (result.status === 'cancelled') return
    if (result.status === 'failed') {
      toast.error(result.error)
      reload()
      return
    }
    const { entitlement } = result
    const startsLater = Date.parse(entitlement.starts_at) > Date.now() + 60_000
    toast.success(
      startsLater
        ? `Thank you. Business (${pack.name}) starts on ${formatShortDate(entitlement.starts_at)}, when your current plan ends.`
        : `Thank you. You're on Business until ${formatShortDate(entitlement.expires_at!)}.`
    )
    await plan.refresh()
    reload()
  }

  return (
    <SettingsSection id="plan" title="Plan" description={describe(plan)}>
      {plan.current?.note && plan.current.source === 'comp' && <p className="text-sm text-ink-quiet">{plan.current.note}</p>}

      {!forever && packs.length > 0 && (
        <div className="flex flex-col gap-2.5 border-t border-line-soft pt-4">
          <p className="text-sm text-ink-quiet">{buyingNote(plan)}</p>
          <ul className="grid gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
            {packs.map((pack) => (
              <PackOption key={pack.id} pack={pack} packs={packs} busy={buying !== null} onBuy={() => void buy(pack)} />
            ))}
          </ul>
          <p className="text-[13px] text-ink-quiet">
            Payments are handled by Razorpay. Business is paid once for the time you choose, and doesn&apos;t renew by itself.
          </p>
        </div>
      )}

      {payments.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-line-soft pt-4">
          <h3 className="text-[15px] font-semibold">Payments</h3>
          <ul className="flex flex-col">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-line-soft py-2.5 last:border-0">
                <span className="text-[15px]">
                  Business, {p.pack_name}
                  <span className="text-ink-quiet"> · {formatShortDate(p.paid_at ?? p.created_at)}</span>
                </span>
                <span className="flex items-baseline gap-3">
                  <span className="font-cheque text-xs text-ink-quiet">{p.payment_id}</span>
                  <span className="text-[15px] font-semibold tabular-nums">{formatMinorUnits(p.amount, p.currency)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SettingsSection>
  )
}
