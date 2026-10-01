/**
 * Checking that payments really came from Razorpay. Plain TypeScript with Web
 * Crypto and no Deno APIs, so tests/paymentsFunction.test.ts can run it too.
 */

const encoder = new TextEncoder()

/** HMAC-SHA256 of a message, as lowercase hex: how Razorpay signs. */
export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Compares two strings without giving away, through timing, where they differ. */
export function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Whether Checkout's signature proves this payment was made for this order. */
export async function isCheckoutSigned(orderId: string, paymentId: string, signature: string, keySecret: string): Promise<boolean> {
  return sameText(await hmacHex(keySecret, `${orderId}|${paymentId}`), signature)
}

/** Whether a webhook's body was signed with the webhook secret. */
export async function isWebhookSigned(rawBody: string, signature: string, webhookSecret: string): Promise<boolean> {
  return sameText(await hmacHex(webhookSecret, rawBody), signature)
}

export interface PaidPayment {
  orderId: string
  paymentId: string
  amount: number
  currency: string
}

interface PaymentEntity {
  id?: unknown
  order_id?: unknown
  amount?: unknown
  currency?: unknown
  status?: unknown
}

/**
 * The captured payment a webhook event reports, from `order.paid` or
 * `payment.captured`. Null for any other event, or a payment not taken yet.
 */
export function paidPaymentIn(event: unknown): PaidPayment | null {
  const e = event as { event?: unknown; payload?: { payment?: { entity?: PaymentEntity } } } | null
  if (e?.event !== 'order.paid' && e?.event !== 'payment.captured') return null
  const p = e.payload?.payment?.entity
  if (!p || p.status !== 'captured') return null
  if (typeof p.id !== 'string' || typeof p.order_id !== 'string') return null
  if (typeof p.amount !== 'number' || typeof p.currency !== 'string') return null
  return { orderId: p.order_id, paymentId: p.id, amount: p.amount, currency: p.currency }
}
