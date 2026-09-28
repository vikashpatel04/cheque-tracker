import {
  Calendar,
  ChartColumn,
  createLucideIcon,
  SlidersHorizontal,
  Sun,
  Users,
  type LucideIcon,
} from 'lucide-react'

/** A cheque, drawn like the Lucide icons (the design's Cheques icon). */
export const ChequeIcon = createLucideIcon('Cheque', [
  ['rect', { x: '2', y: '7', width: '20', height: '10', rx: '1', key: 'outline' }],
  ['path', { d: 'M6 14h6', key: 'amount' }],
  ['path', { d: 'M15 11h3', key: 'date' }],
])

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** On phones, this lives under More instead of the bottom tabs. */
  underMore?: boolean
}

/** The main sections (docs/design-brief.md, Navigation). */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Today', icon: Sun },
  { to: '/cheques', label: 'Cheques', icon: ChequeIcon },
  { to: '/calendar', label: 'Calendar', icon: Calendar, underMore: true },
  { to: '/parties', label: 'Parties', icon: Users },
  { to: '/reports', label: 'Reports', icon: ChartColumn, underMore: true },
  { to: '/settings', label: 'Settings', icon: SlidersHorizontal, underMore: true },
]

export function isActivePath(pathname: string, to: string): boolean {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`)
}
