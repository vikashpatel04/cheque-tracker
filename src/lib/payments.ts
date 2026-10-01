import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { Entitlement } from '@/types'

/**
 * Buying packs (plan item 53): the packs on sale, your payments, and paying
 * through Razorpay Checkout. The `payments` Edge Function does the parts that
 * need secrets; see docs/payments.md.
 */

export type Pack = Database['public']['Tables']['packs']['Row']
export type PaymentOrder = Database['public']['Tables']['payment_orders']['Row']

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js'

export async function loadPacks(): Promise<Pack[]> {
  const { data } = await supabase.from('packs').select('*').eq('active', true).order('sort').order('months')
  return data ?? []
}

/** Your paid orders, newest first. */
export async function loadPayments(): Promise<PaymentOrder[]> {
  const { data } = await supabase.from('payment_orders').select('*').eq('status', 'paid').order('paid_at', { ascending: false })
  return data ?? []
}

/** What a pack costs, tax included, in the smallest unit. */
export const packTotal = (pack: Pack): number => pack.total ?? pack.amount

/**
 * How much a pack saves, in whole percent, against paying for the same months
 * at the price per month of the shortest pack in the same currency. 0 when it
 * doesn't save.
 */
export function savingPercent(pack: Pack, packs: Pack[]): number {
  const shortest = packs.filter((p) => p.currency === pack.currency).sort((a, b) => a.months - b.months)[0]
  if (!shortest || shortest.months >= pack.months) return 0
  const fullPrice = (shortest.amount / shortest.months) * pack.months
  const saving = Math.floor((1 - pack.amount / fullPrice) * 100)
  return saving > 0 ? saving : 0
}

/** The message an Edge Function sent with its error, if any. */
async function functionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null)
    if (body?.error) return body.error as string
  }
  return error instanceof Error ? error.message : 'Something went wrong'
}

let scriptLoading: Promise<void> | null = null

/** Razorpay's Checkout script, loaded the first time someone buys. */
function loadCheckout(): Promise<void> {
  scriptLoading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = CHECKOUT_SCRIPT
    script.onload = () => resolve()
    script.onerror = () => {
      scriptLoading = null
      script.remove()
      reject(new Error("Couldn't reach Razorpay. Check your connection and try again."))
    }
    document.head.appendChild(script)
  })
  return scriptLoading
}

interface CheckoutOrder {
  key_id: string
  order_id: string
  amount: number
  currency: string
  pack_name: string
  email: string | null
}

interface CheckoutSuccess {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

interface RazorpayCheckout {
  open(): void
  on(event: 'payment.failed', handler: (response: { error?: { description?: string } }) => void): void
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout
  }
}

export type BuyResult =
  | { status: 'paid'; entitlement: Entitlement }
  | { status: 'cancelled' }
  | { status: 'failed'; error: string }

/**
 * Buys a pack: creates the order, opens Razorpay Checkout, then confirms the
 * payment. If the confirmation can't get through after paying, Razorpay's
 * webhook still records it.
 */
export async function buyPack(pack: Pack, shop: { name: string; color: string }): Promise<BuyResult> {
  const created = await supabase.functions.invoke<CheckoutOrder>('payments/checkout', { body: { pack_id: pack.id } })
  if (created.error || !created.data) return { status: 'failed', error: await functionError(created.error) }
  const order = created.data

  try {
    await loadCheckout()
  } catch (e) {
    return { status: 'failed', error: (e as Error).message }
  }
  if (!window.Razorpay) return { status: 'failed', error: "Couldn't open Razorpay. Try again." }
  const Razorpay = window.Razorpay

  const paid = await new Promise<CheckoutSuccess | { failed: string } | null>((resolve) => {
    // Checkout shows a failed attempt itself and offers to try again; the
    // reason is kept in case it's then closed.
    let failure = ''
    const checkout = new Razorpay({
      key: order.key_id,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      name: shop.name,
      description: order.pack_name,
      prefill: order.email ? { email: order.email } : {},
      theme: { color: shop.color },
      handler: (response: CheckoutSuccess) => resolve(response),
      modal: { ondismiss: () => resolve(failure ? { failed: failure } : null) },
    })
    checkout.on('payment.failed', (response) => {
      failure = response.error?.description ?? 'The payment failed'
    })
    checkout.open()
  })
  if (!paid) return { status: 'cancelled' }
  if ('failed' in paid) return { status: 'failed', error: paid.failed }

  const confirmed = await supabase.functions.invoke<{ entitlement: Entitlement }>('payments/confirm', {
    body: { order_id: paid.razorpay_order_id, payment_id: paid.razorpay_payment_id, signature: paid.razorpay_signature },
  })
  if (confirmed.error || !confirmed.data) {
    return {
      status: 'failed',
      error: `${await functionError(confirmed.error)}. If money left your account, your pack is added within a few minutes.`,
    }
  }
  return { status: 'paid', entitlement: confirmed.data.entitlement }
}
