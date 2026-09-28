import { Clock, Hourglass, Repeat, ShieldCheck, TriangleAlert, Wallet, type LucideIcon } from 'lucide-react'
import { Chip } from '@/components/shared/Chip'
import type { ListRow, RowTag, TagKind } from '@/lib/chequeList'
import { GIVEN_STATUS_CHIPS, RECEIVED_STATUS_CHIPS, type ChipTone } from '@/lib/statusChips'
import { STATUS_LABELS, type ChequeStatus } from '@/types'
import { RECEIVED_STATUS_LABELS, type ReceivedStatus } from '@/types/received'

const TAGS: Record<TagKind, { label: (tag: RowTag) => string; tone: ChipTone; icon: LucideIcon }> = {
  overdue: { label: () => 'Overdue', tone: 'problem', icon: TriangleAlert },
  due_today: { label: () => 'Due today', tone: 'attention', icon: Clock },
  needs_funds: { label: () => 'Needs funds', tone: 'attention', icon: Wallet },
  going_stale: { label: () => 'Going stale', tone: 'attention', icon: TriangleAlert },
  stale: { label: () => 'Stale', tone: 'problem', icon: TriangleAlert },
  cleared_check: { label: () => 'Cleared?', tone: 'attention', icon: Hourglass },
  security: { label: () => 'Security', tone: 'outline', icon: ShieldCheck },
  series: { label: (t) => (t.count ? `Series · no. ${t.count}` : 'Series'), tone: 'outline', icon: Repeat },
  represented: { label: (t) => `Re-presented ×${t.count ?? 1}`, tone: 'outline', icon: Repeat },
  replacement: { label: () => 'Replacement', tone: 'outline', icon: Repeat },
  old_represent: { label: () => 'Re-presented (old way)', tone: 'done', icon: Repeat },
  from_return: { label: () => 'From a returned cheque', tone: 'outline', icon: Repeat },
  old_written_off: { label: () => 'Written off (old way)', tone: 'done', icon: Repeat },
}

/** A row's status, in either direction. */
export function RowStatus({ row, size = 'sm' }: { row: ListRow; size?: 'sm' | 'md' }) {
  const chip =
    row.direction === 'out'
      ? GIVEN_STATUS_CHIPS[row.status as ChequeStatus]
      : RECEIVED_STATUS_CHIPS[row.status as ReceivedStatus]
  const label =
    row.direction === 'out'
      ? STATUS_LABELS[row.status as ChequeStatus]
      : RECEIVED_STATUS_LABELS[row.status as ReceivedStatus]
  return (
    <Chip tone={chip?.tone ?? 'done'} icon={chip?.icon} size={size}>
      {label ?? row.status}
    </Chip>
  )
}

/** What needs doing about a row: overdue, due today, needs funds, and the like. */
export function RowTags({ tags, size = 'sm', limit }: { tags: RowTag[]; size?: 'sm' | 'md'; limit?: number }) {
  return (
    <>
      {tags.slice(0, limit).map((tag) => {
        const meta = TAGS[tag.kind]
        return (
          <Chip key={tag.kind} tone={meta.tone} icon={meta.icon} size={size}>
            {meta.label(tag)}
          </Chip>
        )
      })}
    </>
  )
}
