import { cn } from '@/lib/utils'
import { brand } from '@/config/brand'

/**
 * Link to this deployment's source code, shown on the sign-in page and in the
 * sidebar only when VITE_SOURCE_URL is set. Anyone who changes the code and
 * lets others use their copy sets it to meet AGPL section 13; everyone else
 * sees nothing.
 */
export function SourceLink({ className }: { className?: string }) {
  if (!brand.sourceUrl) return null
  return (
    <a
      href={brand.sourceUrl}
      target="_blank"
      rel="noreferrer"
      className={cn('text-xs text-muted-foreground hover:text-foreground hover:underline', className)}
    >
      Source code
    </a>
  )
}
