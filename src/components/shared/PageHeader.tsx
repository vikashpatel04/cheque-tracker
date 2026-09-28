import { ArrowLeft, Search } from 'lucide-react'
import { ActivityBell } from '@/components/shared/ActivityBell'
import { useAppActions } from '@/hooks/useAppActions'

interface PageHeaderProps {
  title: string
  subtitle?: React.ReactNode
  /** Controls beside the title on desktop, under it on phones. */
  actions?: React.ReactNode
  /** For pages inside a section: a back button before the title. */
  back?: () => void
}

/**
 * A page's title. On phones, top-level pages also carry search and the bell,
 * which sit in the top bar on desktop.
 */
export function PageHeader({ title, subtitle, actions, back }: PageHeaderProps) {
  const { openSearch } = useAppActions()
  return (
    <div className="mb-5 flex flex-col gap-4 lg:mb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {back && (
            <button
              type="button"
              aria-label="Back"
              onClick={back}
              className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink transition-colors hover:bg-hover lg:mt-[-2px]"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="font-title text-[30px] leading-9 break-words lg:text-[34px] lg:leading-10">{title}</h1>
            {subtitle && <div className="mt-0.5 text-[15px] text-ink-quiet lg:text-base">{subtitle}</div>}
          </div>
        </div>
        {!back && (
          <div className="flex shrink-0 gap-2 lg:hidden">
            <button
              type="button"
              aria-label="Search"
              onClick={openSearch}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-line-field bg-surface text-ink transition-colors hover:bg-hover"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </button>
            <ActivityBell />
          </div>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
