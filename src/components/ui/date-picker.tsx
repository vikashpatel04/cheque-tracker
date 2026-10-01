import { lazy, Suspense, useEffect, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { CalendarIcon } from 'lucide-react'
import { isValid, parse, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatDate, toISODate } from '@/lib/formatters'
import { getActiveRegion } from '@/lib/region'

// The calendar grid loads the first time one opens, not with the app (plan item 69).
const Calendar = lazy(() => import('@/components/ui/calendar').then((m) => ({ default: m.Calendar })))

/** Holds the calendar's place while it loads. */
const calendarLoading = <div className="h-[308px] w-[276px]" aria-busy="true" />

function toDate(iso?: string | null): Date | undefined {
  if (!iso) return undefined
  const d = parseISO(iso)
  return isNaN(d.getTime()) ? undefined : d
}

interface DatePickerProps {
  value?: string | null
  onChange: (iso: string) => void
  placeholder?: string
  id?: string
  className?: string
  disabled?: boolean
}

/** Single-date picker. Works with ISO (yyyy-MM-dd) strings, displays the user's date format. */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  id,
  className,
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = toDate(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? formatDate(selected) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Suspense fallback={calendarLoading}>
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            weekStartsOn={getActiveRegion().weekStartsOn}
            onSelect={(d) => {
              if (d) onChange(toISODate(d))
              setOpen(false)
            }}
            autoFocus
          />
        </Suspense>
      </PopoverContent>
    </Popover>
  )
}

interface DateRangePickerProps {
  from?: string | null
  to?: string | null
  onChange: (range: { from: string; to: string }) => void
  placeholder?: string
  id?: string
  className?: string
  disabled?: boolean
  /** Show two months side by side. Defaults to true. */
  numberOfMonths?: number
}

/**
 * From–to date range picker. Works with ISO (yyyy-MM-dd) strings, displays
 * both dates in the user's date format.
 */
export function DateRangePicker({
  from,
  to,
  onChange,
  placeholder = 'Pick a date range',
  id,
  className,
  disabled,
  numberOfMonths = 2,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const range: DateRange | undefined = from
    ? { from: toDate(from), to: toDate(to) }
    : undefined

  const label = range?.from
    ? range.to
      ? `${formatDate(range.from)} – ${formatDate(range.to)}`
      : formatDate(range.from)
    : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !label && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {label ?? <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Suspense fallback={calendarLoading}>
          <Calendar
            mode="range"
            selected={range}
            defaultMonth={range?.from}
            numberOfMonths={numberOfMonths}
            weekStartsOn={getActiveRegion().weekStartsOn}
            onSelect={(r) => {
              onChange({
                from: r?.from ? toISODate(r.from) : '',
                to: r?.to ? toISODate(r.to) : '',
              })
              if (r?.from && r?.to) setOpen(false)
            }}
            autoFocus
          />
        </Suspense>
      </PopoverContent>
    </Popover>
  )
}

/** Segment lengths and separator of a date format: dd/MM/yyyy -> [2, 2, 4] and "/". */
function formatShape(pattern: string) {
  const separator = pattern.match(/[^dMy]/)?.[0] ?? '/'
  const lengths = pattern.split(separator).map((s) => s.length)
  return { separator, lengths, digits: lengths.reduce((a, b) => a + b, 0) }
}

/**
 * Insert separators as the user types digits, following the date format:
 * with dd/MM/yyyy, "2309" -> "23/09" and "23092026" -> "23/09/2026".
 */
function maskDate(raw: string, pattern: string): string {
  const { separator, lengths, digits: maxDigits } = formatShape(pattern)
  const digits = raw.replace(/\D/g, '').slice(0, maxDigits)
  const pieces: string[] = []
  let start = 0
  for (const len of lengths) {
    if (start >= digits.length) break
    pieces.push(digits.slice(start, start + len))
    start += len
  }
  return pieces.join(separator)
}

/** Parse a complete date in the given format, rejecting impossible dates like 31/02/2026. */
function parseDisplayDate(text: string, pattern: string): Date | null {
  if (text.length !== pattern.length) return null
  const d = parse(text, pattern, new Date())
  return isValid(d) && d.getFullYear() >= 1900 ? d : null
}

interface DateInputProps {
  value?: string | null
  onChange: (iso: string) => void
  id?: string
  className?: string
  disabled?: boolean
  'aria-invalid'?: boolean
}

/**
 * Typeable date field that always shows the user's date format (from their
 * region settings) regardless of the browser/OS locale, unlike
 * <input type="date">. Separators are inserted automatically; a calendar
 * button offers point-and-click selection. Works with ISO (yyyy-MM-dd)
 * strings like the other pickers.
 */
export function DateInput({ value, onChange, id, className, disabled, ...rest }: DateInputProps) {
  const { dateFormat, weekStartsOn } = getActiveRegion()
  const [text, setText] = useState(() => (toDate(value) ? formatDate(toDate(value)!) : ''))
  const [open, setOpen] = useState(false)
  const selected = toDate(value)

  // Keep the text in sync when the value changes from outside (form reset, calendar pick).
  useEffect(() => {
    const d = toDate(value)
    setText(d ? formatDate(d) : '')
  }, [value])

  const handleChange = (raw: string) => {
    const masked = maskDate(raw, dateFormat)
    setText(masked)
    const d = parseDisplayDate(masked, dateFormat)
    if (d) onChange(toISODate(d))
  }

  // Leaving the field with an incomplete/invalid date restores the last valid one.
  const handleBlur = () => {
    if (!parseDisplayDate(text, dateFormat)) setText(selected ? formatDate(selected) : '')
  }

  return (
    <div className={cn('relative', className)}>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={dateFormat.toUpperCase()}
        maxLength={dateFormat.length}
        value={text}
        disabled={disabled}
        aria-invalid={rest['aria-invalid']}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        className="pr-10"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground"
            aria-label="Open calendar"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Suspense fallback={calendarLoading}>
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected}
              weekStartsOn={weekStartsOn}
              onSelect={(d) => {
                if (d) onChange(toISODate(d))
                setOpen(false)
              }}
              autoFocus
            />
          </Suspense>
        </PopoverContent>
      </Popover>
    </div>
  )
}
