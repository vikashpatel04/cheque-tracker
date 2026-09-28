import { formatCurrencyCompact } from './formatters'

export { formatMonthLabel } from './formatters'

/** Status colours from the Passbook tokens (src/index.css), so charts follow light and dark. */
export const STATUS_COLORS: Record<string, string> = {
  PENDING: 'var(--status-waiting)',
  DEPOSITED: 'var(--status-progress)',
  PASSED: 'var(--status-done)',
  RETURNED: 'var(--status-problem)',
  CANCELLED: 'var(--ink-faint)',
  WRITTEN_OFF: 'var(--line-strong)',
}

/** Soft backgrounds for the same statuses, for filled labels such as calendar entries. */
export const STATUS_SOFT_COLORS: Record<string, string> = {
  PENDING: 'var(--status-waiting-bg)',
  DEPOSITED: 'var(--status-progress-bg)',
  PASSED: 'var(--status-done-bg)',
  RETURNED: 'var(--status-problem-bg)',
  CANCELLED: 'var(--status-done-bg)',
  WRITTEN_OFF: 'var(--status-done-bg)',
}

export const CHART_COLORS = [
  'var(--brand)',
  'var(--money-in)',
  'var(--status-attention-strong)',
  'var(--status-problem)',
  'var(--status-progress)',
  'var(--status-waiting)',
  'var(--ink-faint)',
]

export const chartGridStyle = { strokeDasharray: '3 3', stroke: 'hsl(var(--border))' }

/** Axis and tile amounts in the user's currency, shortened (₹1.2L, $1.2M). */
export function formatChartCurrency(value: number): string {
  return formatCurrencyCompact(value)
}
