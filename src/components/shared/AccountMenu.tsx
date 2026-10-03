import { useNavigate } from 'react-router-dom'
import { Download, LogOut, Monitor, Moon, SlidersHorizontal, Sun } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useInstallApp } from '@/components/shared/InstallApp'
import { useAuth } from '@/hooks/useAuth'
import { useSignOut } from '@/hooks/useSignOut'
import { setThemeChoice, useThemeChoice, type ThemeChoice } from '@/lib/theme'

/** Two letters for the account button, from the email address. */
function initials(email: string | undefined): string {
  const name = (email ?? '').split('@')[0]
  const parts = name.split(/[._\-+]+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)
  return letters.toUpperCase() || '?'
}

/** The round account button in the desktop top bar. */
export function AccountMenu() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const signOut = useSignOut()
  const theme = useThemeChoice()
  const { canInstall, install, help } = useInstallApp()

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Your account"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-hover"
          >
            {user?.is_anonymous ? 'D' : initials(user?.email)}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-72">
          <DropdownMenuLabel className="flex flex-col gap-0.5 px-2.5 py-2 font-normal">
            {user?.is_anonymous ? (
              <span className="text-[15px] font-semibold">You&apos;re trying the demo</span>
            ) : (
              <>
                <span className="text-[13px] text-ink-quiet">Signed in as</span>
                <span className="truncate text-[15px] font-semibold">{user?.email}</span>
              </>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate('/settings')}>
            <SlidersHorizontal className="text-ink-quiet" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="min-h-10 gap-2.5 rounded-lg px-2.5 text-[15px]">
              {theme === 'dark' ? <Moon className="h-4 w-4 text-ink-quiet" /> : theme === 'light' ? <Sun className="h-4 w-4 text-ink-quiet" /> : <Monitor className="h-4 w-4 text-ink-quiet" />}
              Appearance
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="rounded-xl p-1.5 shadow-pop">
              <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setThemeChoice(value as ThemeChoice)}>
                <DropdownMenuRadioItem value="system" className="min-h-10 rounded-lg text-[15px]">
                  As the device
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="light" className="min-h-10 rounded-lg text-[15px]">
                  Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark" className="min-h-10 rounded-lg text-[15px]">
                  Dark
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {canInstall && (
            <DropdownMenuItem onSelect={install}>
              <Download className="text-ink-quiet" />
              Install the app
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void signOut()}>
            <LogOut className="text-ink-quiet" />
            {user?.is_anonymous ? 'End the demo' : 'Sign out'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {help}
    </>
  )
}
