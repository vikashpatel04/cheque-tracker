import { cn } from '@/lib/utils'
import { brand } from '@/config/brand'

const markSizes = {
  sm: 'h-[30px] w-[30px]',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
} as const

const wordSizes = {
  sm: 'text-[19px]',
  md: 'text-2xl',
  lg: 'text-3xl',
} as const

/** The mark: a cheque outline with a green tick. Its colours follow light and dark. */
export function LogoMark({ className }: { className?: string }) {
  if (brand.logoUrl) {
    return <img src={brand.logoUrl} alt="" aria-hidden="true" className={cn('shrink-0 object-contain', className)} />
  }
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn('shrink-0', className)}>
      <rect x="3" y="8" width="26" height="17" rx="3" stroke="var(--brand)" strokeWidth="2" />
      <path d="M8 20h8" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M19 18.5l2.5 2.5 4.5-5"
        stroke="var(--money-in)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface AppLogoProps {
  size?: keyof typeof markSizes
  showText?: boolean
  className?: string
}

export function AppLogo({ size = 'md', showText = true, className }: AppLogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)} role={showText ? undefined : 'img'} aria-label={showText ? undefined : brand.name}>
      <LogoMark className={markSizes[size]} />
      {showText && <span className={cn('font-title leading-tight text-brand', wordSizes[size])}>{brand.name}</span>}
    </div>
  )
}
