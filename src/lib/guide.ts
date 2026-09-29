/**
 * The in-app guide, "Learn how cheques work" (plan item 75): its topics,
 * each asked as the question someone would have, in the order the guide
 * shows them. The answers are in src/components/guide/GuideTopics.tsx.
 * `HelpLink` opens an answer from anywhere in the app, and /learn#<id>
 * goes to it in the guide.
 */

export type GuideTopicId =
  | 'given'
  | 'received'
  | 'bounce'
  | 'add-funds'
  | 'auto-pass'
  | 'security'
  | 'stale'
  | 'clearing'
  | 'undo'
  | 'totals'
  | 'tracks'

export type GuideSection = 'The life of a cheque' | 'Cheques you give' | 'Cheques you receive' | 'Everywhere in the app'

export interface GuideTopic {
  id: GuideTopicId
  question: string
  /** For the guide's list of topics. */
  short: string
  section: GuideSection
}

export const GUIDE_TOPICS: GuideTopic[] = [
  { id: 'given', question: 'How does a cheque you give move along?', short: 'Cheques you give', section: 'The life of a cheque' },
  { id: 'received', question: 'How does a cheque you receive move along?', short: 'Cheques you receive', section: 'The life of a cheque' },
  { id: 'bounce', question: 'What happens when a cheque comes back unpaid?', short: 'When one comes back', section: 'The life of a cheque' },
  { id: 'add-funds', question: 'What is Add funds, and why does it start at zero each day?', short: 'Add funds', section: 'Cheques you give' },
  { id: 'auto-pass', question: 'How does auto-pass work?', short: 'Auto-pass', section: 'Cheques you give' },
  { id: 'security', question: 'What is a security cheque?', short: 'Security cheques', section: 'Cheques you receive' },
  { id: 'stale', question: 'When does a cheque go stale?', short: 'Stale cheques', section: 'Cheques you receive' },
  { id: 'clearing', question: 'How long does a deposit take to clear?', short: 'Clearing', section: 'Cheques you receive' },
  { id: 'undo', question: 'I marked something by mistake. Can I undo it?', short: 'Undo', section: 'Everywhere in the app' },
  { id: 'totals', question: 'What do the totals count?', short: 'Totals', section: 'Everywhere in the app' },
  { id: 'tracks', question: 'I only give cheques, or only receive them. Can I hide the other side?', short: 'Given, received or both', section: 'Everywhere in the app' },
]

export const GUIDE_SECTIONS: GuideSection[] = ['The life of a cheque', 'Cheques you give', 'Cheques you receive', 'Everywhere in the app']

export function guideTopic(id: GuideTopicId): GuideTopic {
  return GUIDE_TOPICS.find((t) => t.id === id)!
}
