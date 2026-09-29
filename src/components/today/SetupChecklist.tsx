import { useState } from 'react'
import { Check, FlaskConical } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { BankAccountDialog } from '@/components/shared/BankAccountDialog'
import { countryName } from '@/config/regions'
import { useAppActions } from '@/hooks/useAppActions'
import { useSampleData } from '@/hooks/useSampleData'
import { useSettings } from '@/hooks/useSettings'
import { useSetupStatus } from '@/hooks/useSetupStatus'
import { currencySymbol, todayDate } from '@/lib/formatters'
import { getActiveRegion } from '@/lib/region'
import { cn } from '@/lib/utils'

const HIDDEN_KEY = 'setup-checklist-hidden'

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDDEN_KEY) === '1'
  } catch {
    return false
  }
}

const TRACKS_TEXT = { both: 'Both, given and received', given: 'Cheques you give', received: 'Cheques you receive' } as const

interface Step {
  title: string
  sub: string
  done: boolean
  action?: { label: string; primary?: boolean; run: () => void }
}

/**
 * Today's first-run checklist (design board Today-first-run-phone): what's
 * set up and what's left, until it's all done or hidden, and an offer of
 * sample data while there are no cheques. Hiding is remembered on this device.
 */
export function SetupChecklist() {
  const { settings } = useSettings()
  const status = useSetupStatus()
  const sample = useSampleData()
  const app = useAppActions()
  const [hidden, setHidden] = useState(readHidden)
  const [addingAccount, setAddingAccount] = useState(false)

  if (status.loading || hidden) return null

  const region = getActiveRegion()
  const steps: Step[] = [
    {
      title: 'Choose your region',
      sub: `${countryName(region.country)} · ${currencySymbol(region)} · ${format(todayDate(region), region.dateFormat)}`,
      done: true,
    },
    { title: 'Say what you track', sub: TRACKS_TEXT[settings.tracks ?? 'both'], done: true },
    {
      title: 'Add your bank account',
      sub: 'The one you write cheques from or deposit into. Only the last four digits are kept.',
      done: status.hasAccounts,
      action: { label: 'Add', run: () => setAddingAccount(true) },
    },
    {
      title: 'Add your cheques',
      sub: 'One at a time, a series, or import your Excel sheet',
      done: status.hasCheques,
      action: { label: 'Add', primary: true, run: () => app.newCheque() },
    },
  ]
  const done = steps.filter((s) => s.done).length
  const offerSample = !status.hasCheques && sample.present === false

  if (done === steps.length && !offerSample) return null

  const hide = () => {
    try {
      localStorage.setItem(HIDDEN_KEY, '1')
    } catch {
      // Private browsing: it shows again next time.
    }
    setHidden(true)
  }

  return (
    <div className="flex flex-col gap-4">
      {done < steps.length && (
        <section aria-labelledby="setup-title" className="flex flex-col gap-1 rounded-xl border bg-surface p-4 lg:p-5">
          <div className="flex items-baseline justify-between gap-3 pb-2">
            <h2 id="setup-title" className="text-[19px] font-semibold">
              Let's get you set up
            </h2>
            <span className="text-sm font-semibold text-ink-quiet">
              {done} of {steps.length} done
            </span>
          </div>
          <span className="mb-2 flex h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
            <span className="bg-brand" style={{ width: `${(done / steps.length) * 100}%` }} />
          </span>
          <ul>
            {steps.map((step) => (
              <li key={step.title} className="grid min-h-[60px] grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-3 border-t border-line-soft py-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-[26px] w-[26px] items-center justify-center rounded-full',
                    step.done ? 'bg-money-in text-brand-ink' : 'border-2 border-line-strong'
                  )}
                >
                  {step.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className={cn('text-[15px] font-semibold', step.done && 'text-ink-quiet line-through')}>
                    <span className="sr-only">{step.done ? 'Done: ' : 'To do: '}</span>
                    {step.title}
                  </span>
                  <span className="text-[13px] text-ink-quiet">{step.sub}</span>
                </span>
                {!step.done && step.action && (
                  <Button variant={step.action.primary ? 'default' : 'outline'} onClick={step.action.run}>
                    {step.action.label}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <Button variant="link" className="h-auto self-start p-0 text-ink-quiet" onClick={hide}>
            Hide this
          </Button>
        </section>
      )}

      {offerSample && (
        <section aria-labelledby="sample-title" className="flex flex-col gap-2.5 rounded-xl border border-dashed border-line-strong bg-surface p-4 lg:p-5">
          <h2 id="sample-title" className="text-[17px] font-semibold">
            Want to look around first?
          </h2>
          <p className="text-sm leading-5 text-ink-quiet">
            Fill the app with made-up cheques to see how everything works. They're marked as samples, and one tap in Settings removes them all.
          </p>
          <Button variant="outline" className="self-start" disabled={sample.busy} onClick={() => void sample.add()}>
            <FlaskConical />
            {sample.busy ? 'Adding…' : 'Try with sample data'}
          </Button>
        </section>
      )}

      <BankAccountDialog open={addingAccount} onOpenChange={setAddingAccount} makeDefault />
    </div>
  )
}
