import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

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
  id?: string
  className?: string
  disabled?: boolean
}

/**
 * Searchable single-select (shadcn combobox pattern: Popover + Command).
 *
 * Items carry the option's id as their cmdk value, so the filter below matches
 * on the label instead — otherwise typing would be matched against ids.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search...',
  emptyText = 'No results found.',
  id,
  className,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
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
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command
          filter={(_value, search, keywords) => {
            const haystack = (keywords ?? []).join(' ').toLowerCase()
            return haystack.includes(search.trim().toLowerCase()) ? 1 : 0
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  keywords={[o.label]}
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
      </PopoverContent>
    </Popover>
  )
}
