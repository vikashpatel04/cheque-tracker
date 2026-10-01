import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { BookOpen, Menu, Plus, Search, WifiOff } from 'lucide-react'
import { AccountMenu } from '@/components/shared/AccountMenu'
import { ActivityBell } from '@/components/shared/ActivityBell'
import { AppActionsProvider } from '@/components/shared/AppActions'
import { AppLogo } from '@/components/shared/AppLogo'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { MoreSheet } from '@/components/shared/MoreSheet'
import { NewMenuButton, NewSheet } from '@/components/shared/NewMenu'
import { PlanBanner } from '@/components/shared/PlanBanner'
import { SourceLink } from '@/components/shared/SourceLink'
import { isActivePath, NAV_ITEMS, type NavItem } from '@/components/shared/navigation'
import { useAppActions } from '@/hooks/useAppActions'
import { daysLeft, usePlan } from '@/hooks/usePlan'
import { useTodos } from '@/hooks/useTodayData'
import { readOnlyWording } from '@/lib/plan'
import { useOnline } from '@/lib/pwa'
import { cn } from '@/lib/utils'

/** How wide pages get on big screens; they're centred in the space beside the sidebar. */
const CONTENT_WIDTH = 'mx-auto w-full max-w-[1400px]'

/** The search shortcut as this device writes it. */
const SEARCH_SHORTCUT = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘K' : 'Ctrl K'

function SidebarLink({ item, count }: { item: NavItem; count?: number }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'flex h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] transition-colors',
          isActive ? 'bg-brand-soft font-semibold text-brand' : 'font-medium text-ink-nav hover:bg-hover'
        )
      }
    >
      <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="flex-1">{item.label}</span>
      {!!count && (
        <span
          aria-label={`${count} to do`}
          className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-brand px-[7px] text-xs font-semibold text-brand-ink"
        >
          {count}
        </span>
      )}
    </NavLink>
  )
}

/** The plan, on instances that sell plans. Paid plans don't nag. */
function SidebarPlan() {
  const plan = usePlan()
  if (plan.loading || !plan.billingEnabled) return null
  const trial = plan.current?.source === 'trial' && plan.current.expires_at ? daysLeft(plan.current.expires_at) : null
  if (!plan.readOnly && trial === null) return null
  const wording = readOnlyWording(plan)
  return (
    <Link
      to="/settings#plan"
      className="flex flex-col gap-1 rounded-xl border bg-surface p-3.5 text-ink transition-colors hover:bg-hover"
    >
      <span className="text-sm font-semibold">
        {plan.readOnly
          ? wording.title
          : trial === 0
            ? 'Free trial · ends today'
            : `Free trial · ${trial} day${trial === 1 ? '' : 's'} left`}
      </span>
      <span className="text-[13px] font-medium text-brand">{plan.readOnly ? wording.action : 'Choose a pack'}</span>
    </Link>
  )
}

function Sidebar() {
  const { todos } = useTodos()
  return (
    <nav
      aria-label="Main"
      className="sticky top-0 hidden h-dvh flex-col gap-1 overflow-y-auto border-r bg-sidebar px-4 py-5 lg:flex"
    >
      <Link to="/" className="flex items-center gap-2.5 px-2.5 pb-[22px] pt-1.5">
        <AppLogo size="sm" />
      </Link>
      {NAV_ITEMS.map((item) => (
        <SidebarLink key={item.to} item={item} count={item.to === '/' ? todos.length : undefined} />
      ))}
      <div className="flex-1" />
      <NavLink
        to="/learn"
        className={({ isActive }) =>
          cn(
            'mb-3 flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors',
            isActive ? 'border-brand bg-brand-soft text-brand' : 'bg-surface text-ink hover:bg-hover'
          )
        }
      >
        <BookOpen className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
        <span className="flex flex-col">
          <span className="text-sm font-semibold">Learn how cheques work</span>
          <span className="text-[13px] text-ink-quiet">Life cycles and questions</span>
        </span>
      </NavLink>
      <SidebarPlan />
      <SourceLink className="px-3 pt-2 text-xs text-ink-quiet" />
    </nav>
  )
}

function TopBar() {
  const { openSearch } = useAppActions()
  return (
    <header className="sticky top-0 z-30 hidden h-[68px] border-b bg-background/95 backdrop-blur lg:block">
      {/* Same width and centring as the page below, so their edges line up on wide screens. */}
      <div className={cn(CONTENT_WIDTH, 'flex h-full items-center gap-4 lg:px-10')}>
      <button
        type="button"
        onClick={openSearch}
        className="flex h-11 w-[460px] max-w-[45%] items-center gap-2.5 rounded-[10px] border border-line-field bg-surface pl-3.5 pr-2.5 text-left text-[15px] text-ink-faint transition-colors hover:border-line-strong"
      >
        <Search className="h-[18px] w-[18px] shrink-0 text-ink-quiet" aria-hidden="true" />
        <span className="flex-1 truncate">Search cheque no., party or amount</span>
        <kbd className="rounded-md border border-line-field bg-background px-[7px] py-[3px] font-mono text-xs text-ink-quiet">
          {SEARCH_SHORTCUT}
        </kbd>
      </button>
      <div className="flex-1" />
      <NewMenuButton />
      <ActivityBell />
      <AccountMenu />
      </div>
    </header>
  )
}

const MORE_PATHS = NAV_ITEMS.filter((item) => item.underMore).map((item) => item.to)

function BottomTabs() {
  const { pathname } = useLocation()
  const [newOpen, setNewOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const tabs = NAV_ITEMS.filter((item) => !item.underMore)
  const moreActive = MORE_PATHS.some((to) => isActivePath(pathname, to))

  const tabClass = (active: boolean) =>
    cn(
      'flex h-[60px] flex-col items-center justify-center gap-[3px] text-xs transition-colors',
      active ? 'font-bold text-brand' : 'font-medium text-ink-quiet'
    )

  const tab = (item: NavItem) => (
    <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => tabClass(isActive)}>
      <item.icon className="h-[22px] w-[22px]" aria-hidden="true" />
      <span>{item.label}</span>
    </NavLink>
  )

  return (
    <>
      <nav
        aria-label="Main"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-sidebar lg:hidden"
      >
        <div className="grid h-[72px] grid-cols-5 items-center pb-2">
          {tab(tabs[0])}
          {tab(tabs[1])}
          <div className="flex justify-center">
            <button
              type="button"
              aria-label="New"
              onClick={() => setNewOpen(true)}
              className="-mt-[18px] flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-ink shadow-fab transition-colors hover:bg-brand-hover"
            >
              <Plus className="h-[26px] w-[26px]" strokeWidth={2.4} aria-hidden="true" />
            </button>
          </div>
          {tab(tabs[2])}
          <button type="button" onClick={() => setMoreOpen(true)} className={tabClass(moreActive)} aria-current={moreActive ? 'page' : undefined}>
            <Menu className="h-[22px] w-[22px]" aria-hidden="true" />
            <span>More</span>
          </button>
        </div>
      </nav>
      <NewSheet open={newOpen} onOpenChange={setNewOpen} />
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  )
}

function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div role="status" className="flex items-center gap-2 border-b bg-attention-soft px-4 py-2 text-sm text-attention lg:px-10">
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      You're offline. What you see may be out of date, and changes can't be saved until you're back online.
    </div>
  )
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  return (
    <AppActionsProvider>
      <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
        <Sidebar />
        <div className="flex min-w-0 flex-col">
          <TopBar />
          <OfflineBanner />
          <PlanBanner />
          {/* min-w-0 and a horizontal clip, so wide tables and charts scroll inside
              their own wrappers instead of scrolling the page. Clip rather than
              hidden where supported, so sticky bars (Reports' filters) still stick. */}
          <main className={cn(CONTENT_WIDTH, 'min-w-0 overflow-x-hidden supports-[overflow:clip]:overflow-x-clip px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8')}>
            <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>
          </main>
        </div>
        <BottomTabs />
      </div>
    </AppActionsProvider>
  )
}
