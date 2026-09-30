import { useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { useIsPhone } from '@/hooks/useMediaQuery'

export interface ComboboxOption {
  value: string
  label: string
  /** Optional secondary line shown under the label (not searched). */
  hint?: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  /** The sheet's title on phones, e.g. the field's label. */
  title?: string
  id?: string
  className?: string
  disabled?: boolean
}

/** On phones, lists this long get a search box; shorter ones are quicker to tap. */
const SEARCH_FROM = 8

/**
 * Searchable single-select (shadcn combobox pattern: Popover + Command).
 *
 * Items carry the option's id as their cmdk value, so the filter below matches
 * on the label instead — otherwise typing would be matched against ids.
 *
 * On phones it opens as a sheet from the bottom instead (plan item 80): a
 * popover jumped above its field when the keyboard opened, taking its search
 * box off-screen. Long lists get a tall sheet with the search at the top, so
 * the keyboard never covers it; it opens only when you tap the search.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search...',
  emptyText = 'No results found.',
  title,
  id,
  className,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const phone = useIsPhone()
  const listRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)
  const searchable = !phone || options.length >= SEARCH_FROM

  // Open with the chosen option in view, e.g. your time zone in a long list.
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      const list = listRef.current
      const item = list?.querySelector<HTMLElement>('[data-chosen]')
      if (!list || !item) return
      const offset = item.getBoundingClientRect().top - list.getBoundingClientRect().top
      list.scrollTop += offset - (list.clientHeight - item.offsetHeight) / 2
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  const trigger = (
    <Button
      id={id}
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      disabled={disabled}
      className={cn(
        'h-12 w-full justify-between border-input px-3.5 text-base font-normal text-ink hover:bg-surface',
        !selected && 'text-ink-faint',
        className
      )}
    >
      <span className="truncate">{selected ? selected.label : placeholder}</span>
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  )

  const list = (
    <Command
      defaultValue={value}
      filter={(_value, search, keywords) => {
        const haystack = (keywords ?? []).join(' ').toLowerCase()
        return haystack.includes(search.trim().toLowerCase()) ? 1 : 0
      }}
      className={cn(phone && 'min-h-0 flex-1 rounded-none bg-transparent')}
    >
      {searchable && <CommandInput placeholder={searchPlaceholder} />}
      <CommandList ref={listRef} className={cn(phone && 'max-h-none flex-1 overscroll-contain px-2')}>
        <CommandEmpty>{emptyText}</CommandEmpty>
        <CommandGroup>
          {options.map((o) => (
            <CommandItem
              key={o.value}
              value={o.value}
              keywords={[o.label]}
              data-chosen={o.value === value || undefined}
              // No keyboard to move a highlight on phones: only the chosen one stands out.
              className={cn(
                phone && 'min-h-12 active:bg-hover',
                phone && o.value !== value && 'data-[selected=true]:bg-transparent'
              )}
              onSelect={() => {
                onChange(o.value)
                setOpen(false)
              }}
            >
              <Check
                className={cn('h-4 w-4', o.value === value ? 'opacity-100' : 'opacity-0')}
              />
              <div className="min-w-0">
                <p className="truncate">{o.label}</p>
                {o.hint && (
                  <p className="truncate text-xs text-muted-foreground">{o.hint}</p>
                )}
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  )

  if (phone) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          ref={sheetRef}
          side="bottom"
          aria-describedby={undefined}
          // Show the list first; the keyboard opens when you tap the search.
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            sheetRef.current?.focus()
          }}
          className={cn('flex max-h-[85dvh] flex-col gap-0 px-0 pt-5 outline-none', searchable && 'h-[85dvh]')}
        >
          <SheetHeader className="px-5 pb-3 pr-16 text-left">
            <SheetTitle className="font-title text-2xl">{title ?? placeholder}</SheetTitle>
          </SheetHeader>
          {list}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="w-[max(var(--radix-popover-trigger-width),18rem)] max-w-[calc(100vw-2rem)] p-0"
        align="start"
      >
        {list}
      </PopoverContent>
    </Popover>
  )
}
