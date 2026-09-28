import { cn } from '@/lib/utils'
import { brand } from '@/config/brand'

const markSizes = {
  sm: 'h-7',
  md: 'h-10',
  lg: 'h-16',
} as const

const wordSizes = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
} as const

/** The logo image (public/logo.webp, or VITE_APP_LOGO). */
export function LogoMark({ className }: { className?: string }) {
  return <img src={brand.logoUrl} alt="" aria-hidden="true" className={cn('w-auto shrink-0 object-contain', className)} />
}

interface AppLogoProps {
  size?: keyof typeof markSizes
  showText?: boolean
  className?: string
}

export function AppLogo({ size = 'md', showText = true, className }: AppLogoProps) {
  return (
    <div
      className={cn('flex items-center gap-2.5', className)}
      role={showText ? undefined : 'img'}
      aria-label={showText ? undefined : brand.name}
    >
      <LogoMark className={markSizes[size]} />
      {showText && <span className={cn('font-title whitespace-nowrap leading-tight text-brand', wordSizes[size])}>{brand.name}</span>}
    </div>
  )
}
