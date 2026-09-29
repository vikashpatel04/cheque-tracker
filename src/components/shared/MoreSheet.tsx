import { NavLink } from 'react-router-dom'
import { BookOpen, ChevronRight, Download, LogOut } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AppearanceSwitch } from '@/components/shared/AppearanceSwitch'
import { useInstallApp } from '@/components/shared/InstallApp'
import { NAV_ITEMS } from '@/components/shared/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useSignOut } from '@/hooks/useSignOut'

const MORE_ITEMS = NAV_ITEMS.filter((item) => item.underMore)

/** More, from the phone's bottom tabs: the sections that don't fit there, and the account. */
export function MoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth()
  const signOut = useSignOut()
  const { canInstall, install, help } = useInstallApp()
  const close = () => onOpenChange(false)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto px-4 pt-5">
          <SheetHeader className="text-left">
            <SheetTitle className="font-title text-2xl">More</SheetTitle>
            <SheetDescription className="truncate">{user?.email}</SheetDescription>
          </SheetHeader>
          <nav aria-label="More" className="mt-1 flex flex-col">
            {MORE_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={close}
                className="flex min-h-13 items-center gap-3.5 rounded-xl px-2 text-base font-medium text-ink transition-colors hover:bg-hover aria-[current=page]:text-brand"
              >
                <Icon className="h-[22px] w-[22px] text-ink-quiet" aria-hidden="true" />
                <span className="flex-1">{label}</span>
                <ChevronRight className="h-5 w-5 text-ink-faint" aria-hidden="true" />
              </NavLink>
            ))}
            <NavLink
              to="/learn"
              onClick={close}
              className="flex min-h-13 items-center gap-3.5 rounded-xl px-2 text-base font-medium text-ink transition-colors hover:bg-hover aria-[current=page]:text-brand"
            >
              <BookOpen className="h-[22px] w-[22px] text-ink-quiet" aria-hidden="true" />
              <span className="flex-1">Learn how cheques work</span>
              <ChevronRight className="h-5 w-5 text-ink-faint" aria-hidden="true" />
            </NavLink>
            {canInstall && (
              <button
                type="button"
                onClick={() => {
                  close()
                  install()
                }}
                className="flex min-h-13 items-center gap-3.5 rounded-xl px-2 text-left text-base font-medium text-ink transition-colors hover:bg-hover"
              >
                <Download className="h-[22px] w-[22px] text-ink-quiet" aria-hidden="true" />
                <span className="flex-1">Install the app</span>
              </button>
            )}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-line-soft pt-4">
            <span className="text-sm font-medium text-ink-quiet">Appearance</span>
            <AppearanceSwitch />
          </div>
          <button
            type="button"
            onClick={() => {
              close()
              void signOut()
            }}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface text-[15px] font-semibold text-brand"
          >
            <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
            Sign out
          </button>
        </SheetContent>
      </Sheet>
      {help}
    </>
  )
}
