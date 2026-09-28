import { Ban, Check, CircleCheck, CircleDot, CircleX, Clock, Hourglass, Repeat, Undo2, Wallet, X, type LucideIcon } from 'lucide-react'
import type { ChequeStatus } from '@/types'
import type { ReceivedStatus } from '@/types/received'

/**
 * The status chip families from the design (docs/design-brief.md): waiting,
 * on its way (progress), cleared, done, attention and problem.
 */
export type ChipTone = 'waiting' | 'progress' | 'cleared' | 'done' | 'attention' | 'problem' | 'outline'

/** Given cheques. */
export const GIVEN_STATUS_CHIPS: Record<ChequeStatus, { tone: ChipTone; icon: LucideIcon }> = {
  PENDING: { tone: 'waiting', icon: Clock },
  DEPOSITED: { tone: 'progress', icon: Wallet },
  PASSED: { tone: 'done', icon: Check },
  RETURNED: { tone: 'problem', icon: CircleX },
  CANCELLED: { tone: 'done', icon: X },
  WRITTEN_OFF: { tone: 'done', icon: Ban },
}

/** Received cheques. */
export const RECEIVED_STATUS_CHIPS: Record<ReceivedStatus, { tone: ChipTone; icon: LucideIcon }> = {
  IN_HAND: { tone: 'waiting', icon: CircleDot },
  DEPOSITED: { tone: 'progress', icon: Hourglass },
  CLEARED: { tone: 'cleared', icon: CircleCheck },
  BOUNCED: { tone: 'problem', icon: CircleX },
  SETTLED: { tone: 'done', icon: Check },
  HANDED_BACK: { tone: 'done', icon: Undo2 },
  WRITTEN_OFF: { tone: 'done', icon: Ban },
  REPLACED: { tone: 'done', icon: Repeat },
}

/** Soft background and text colour for each family, as Tailwind classes. */
export const TONE_CLASSES: Record<ChipTone, string> = {
  waiting: 'bg-waiting-soft text-waiting',
  progress: 'bg-progress-soft text-progress',
  cleared: 'bg-cleared-soft text-cleared',
  done: 'bg-done-soft text-done',
  attention: 'bg-attention-soft text-attention',
  problem: 'bg-problem-soft text-problem',
  outline: 'bg-surface text-ink-quiet',
}
