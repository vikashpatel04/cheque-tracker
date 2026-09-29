import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BankAccountsCard } from '@/components/settings/BankAccountsCard'
import { DataCard } from '@/components/settings/DataCard'
import { GivenSettingsCard } from '@/components/settings/GivenSettingsCard'
import { PlanCard } from '@/components/settings/PlanCard'
import { RegionSettingsCard } from '@/components/settings/RegionSettingsCard'
import { SettingsSection } from '@/components/settings/SettingsSection'
import { TracksCard } from '@/components/settings/TracksCard'
import { AppearanceSwitch } from '@/components/shared/AppearanceSwitch'
import { PageHeader } from '@/components/shared/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { goToSection, useCurrentSection } from '@/hooks/useCurrentSection'
import { usePlan } from '@/hooks/usePlan'
import { useSignOut } from '@/hooks/useSignOut'
import { cn } from '@/lib/utils'

/**
 * Settings (design board Settings-desktop): a list of sections beside them on
 * desktop, a row of them on phones. Each section has an address, e.g.
 * /settings#sample-data. Reminders come with plan item 41.
 */
export default function SettingsPage() {
  const { user } = useAuth()
  const signOut = useSignOut()
  const plan = usePlan()
  const location = useLocation()
  const showPlan = !plan.loading && plan.billingEnabled

  const sections = useMemo(
    () => [
      { id: 'track', label: 'What you track' },
      { id: 'region', label: 'Region' },
      { id: 'accounts', label: 'Bank accounts' },
      { id: 'given', label: 'Cheques you give' },
      { id: 'appearance', label: 'Appearance' },
      ...(showPlan ? [{ id: 'plan', label: 'Plan' }] : []),
      { id: 'data', label: 'Your data' },
      { id: 'profile', label: 'Profile and sign-in' },
    ],
    [showPlan]
  )
  const ids = useMemo(() => sections.map((s) => s.id), [sections])
  const current = useCurrentSection(ids)

  // Arriving at /settings#… goes to that section.
  useEffect(() => {
    const id = location.hash.slice(1)
    if (!id) return
    const frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView())
    return () => cancelAnimationFrame(frame)
  }, [location.hash])

  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    goToSection(id)
  }

  return (
    <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="lg:sticky lg:top-[92px]">
        <PageHeader title="Settings" />
        <nav aria-label="Settings sections" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:mb-0 lg:-mt-2 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
          {sections.map((s) => {
            const active = s.id === current
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={go(s.id)}
                aria-current={active ? 'location' : undefined}
                className={cn(
                  'flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition-colors lg:h-10 lg:rounded-lg lg:border-0 lg:px-3 lg:text-[15px]',
                  active ? 'border-brand bg-brand-soft font-semibold text-brand' : 'border-line-strong text-ink-nav hover:bg-hover'
                )}
              >
                {s.label}
              </a>
            )
          })}
        </nav>
      </div>

      <div className="flex max-w-[820px] min-w-0 flex-col gap-4">
        <TracksCard />
        <RegionSettingsCard />
        <BankAccountsCard />
        <GivenSettingsCard />
        <SettingsSection id="appearance" title="Appearance" description="Light, dark, or as your device is set. It's saved on this device only.">
          <AppearanceSwitch className="w-full sm:max-w-[360px]" />
        </SettingsSection>
        <PlanCard />
        <DataCard />
        <SettingsSection id="profile" title="Profile and sign-in">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col">
              <span className="text-sm text-ink-quiet">Signed in as</span>
              <span className="break-all text-[15px] font-semibold">{user?.email}</span>
            </div>
            <Button variant="outline" className="self-start sm:self-auto" onClick={() => void signOut()}>
              <LogOut />
              Sign out
            </Button>
          </div>
        </SettingsSection>
      </div>
    </div>
  )
}
