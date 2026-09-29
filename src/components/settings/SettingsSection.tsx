import { cn } from '@/lib/utils'

/**
 * One Settings section (design board Settings-desktop): a card with a title,
 * a line about it, an optional button on the right, and its controls. The id
 * is its address (/settings#region) and the section list's target.
 */
export function SettingsSection({
  id,
  title,
  description,
  action,
  children,
  className,
}: {
  id: string
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn('flex scroll-mt-4 flex-col gap-3.5 rounded-xl border bg-surface p-4 sm:p-[22px] lg:scroll-mt-[92px]', className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id={`${id}-title`} className="text-lg font-semibold">
            {title}
          </h2>
          {description && <p className="text-sm leading-5 text-ink-quiet">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/** A setting inside a section: its name and what it does on the left, the control on the right. */
export function SettingRow({
  label,
  labelId,
  hint,
  children,
}: {
  label: string
  labelId?: string
  hint?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span id={labelId} className="text-[15px] font-semibold">
          {label}
        </span>
        {hint && <span className="text-sm leading-5 text-ink-quiet">{hint}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-2.5">{children}</div>
    </div>
  )
}
