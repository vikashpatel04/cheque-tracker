import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TONE_CLASSES, type ChipTone } from '@/lib/statusChips'

interface ChipProps {
  tone: ChipTone
  icon?: LucideIcon
  size?: 'sm' | 'md'
  className?: string
  children: React.ReactNode
}

/** A status chip: an icon, a label and a colour, never colour alone. */
export function Chip({ tone, icon: Icon, size = 'md', className, children }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-full border font-medium',
        size === 'md' ? 'h-7 gap-1.5 pl-[9px] pr-[11px] text-[13px]' : 'h-6 gap-[5px] pl-[7px] pr-[9px] text-xs',
        !Icon && (size === 'md' ? 'pl-[11px]' : 'pl-[9px]'),
        TONE_CLASSES[tone],
        tone === 'outline' ? 'border-line-strong' : 'border-transparent',
        className
      )}
    >
      {Icon && <Icon className={size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'} strokeWidth={2.4} aria-hidden="true" />}
      {children}
    </span>
  )
}
