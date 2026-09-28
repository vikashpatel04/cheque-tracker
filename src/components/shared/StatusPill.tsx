import { STATUS_LABELS, type ChequeStatus } from '@/types'
import { Chip } from '@/components/shared/Chip'
import { GIVEN_STATUS_CHIPS } from '@/lib/statusChips'

interface StatusPillProps {
  status: ChequeStatus
  size?: 'sm' | 'md'
  className?: string
}

/** A given cheque's status as a chip. */
export function StatusPill({ status, size = 'sm', className }: StatusPillProps) {
  const chip = GIVEN_STATUS_CHIPS[status]
  return (
    <Chip tone={chip?.tone ?? 'done'} icon={chip?.icon} size={size} className={className}>
      {STATUS_LABELS[status] ?? status}
    </Chip>
  )
}
