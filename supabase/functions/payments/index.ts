import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isCheckoutSigned, isWebhookSigned, paidPaymentIn } from './razorpay.ts'

/**
 * Buying packs with Razorpay (plan item 53). See docs/payments.md.
 *
 *   POST /payments/checkout  { pack_id }                           signed-in user
 *   POST /payments/confirm   { order_id, payment_id, signature }   signed-in user
 *   POST /payments/webhook   Razorpay's order.paid / payment.captured events
 *
 * Checkout creates a Razorpay order for the pack's price and returns what the
 * browser needs to open Razorpay Checkout. After paying, the browser sends the
 * payment back to confirm; the webhook reports it too, in case the browser
 * never does. Either way record_payment() turns it into a plan, once.
 *
 * Deployed with verify_jwt off (supabase/config.toml), because Razorpay's
 * webhook has no Supabase token; the user routes check the token themselves.
 *
 * Secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET.
 */

const RAZORPAY_API = 'https://api.razorpay.com/v1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const fail = (error: string, status: number) => reply({ error }, status)

function secret(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`The ${name} secret isn't set`)
  return value
}

async function razorpay<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${RAZORPAY_API}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Basic ${btoa(`${secret('RAZORPAY_KEY_ID')}:${secret('RAZORPAY_KEY_SECRET')}`)}`,
      'Content-Type': 'application/json',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const description = (data as { error?: { description?: string } }).error?.description
    throw new Error(`Razorpay: ${description ?? response.statusText}`)
  }
  return data as T
}

interface Order {
  id: string
  user_id: string
  pack_name: string
  months: number
  currency: string
  amount: number
  status: 'created' | 'paid'
}

interface RazorpayPayment {
  id: string
  order_id: string | null
  amount: number
  currency: string
  status: string
}

/** The signed-in user, from the request's token. */
async function signedInUser(admin: SupabaseClient, req: Request) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  return error ? null : data.user
}

/** Checks the payment with Razorpay, takes the money if it's only authorised, then records the plan. */
async function recordPaid(admin: SupabaseClient, order: Order, paymentId: string) {
  let payment = await razorpay<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`)
  if (payment.order_id !== order.id || payment.amount !== Number(order.amount) || payment.currency !== order.currency) {
    throw new Error("The payment doesn't match the order")
  }
  if (payment.status === 'authorized') {
    payment = await razorpay<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}/capture`, {
      method: 'POST',
      body: { amount: payment.amount, currency: payment.currency },
    })
  }
  if (payment.status !== 'captured') throw new Error("The payment didn't go through")
  const { data, error } = await admin.rpc('record_payment', { p_order_id: order.id, p_payment_id: paymentId })
  if (error) throw new Error(error.message)
  return data
}

async function checkout(admin: SupabaseClient, req: Request): Promise<Response> {
  const user = await signedInUser(admin, req)
  if (!user) return fail('Sign in to buy a pack', 401)

  const { data: config } = await admin.from('instance_config').select('billing_enabled').maybeSingle()
  if (!config?.billing_enabled) return fail("This copy of the app doesn't sell packs", 404)

  const { pack_id } = (await req.json().catch(() => ({}))) as { pack_id?: string }
  const { data: pack } = await admin.from('packs').select('*').eq('id', pack_id ?? '').eq('active', true).maybeSingle()
  if (!pack) return fail("That pack isn't on sale", 404)

  const { data: forever } = await admin
    .from('entitlements')
    .select('id')
    .eq('user_id', user.id)
    .is('expires_at', null)
    .lte('starts_at', new Date().toISOString())
    .limit(1)
  if (forever?.length) return fail('Your plan has no end date, so there is nothing to buy', 409)

  const order = await razorpay<{ id: string; amount: number; currency: string }>('/orders', {
    method: 'POST',
    body: {
      amount: pack.total,
      currency: pack.currency,
      receipt: `${pack.id}-${Date.now()}`.slice(0, 40),
      notes: { user_id: user.id, pack_id: pack.id },
    },
  })

  const { error } = await admin.from('payment_orders').insert({
    id: order.id,
    user_id: user.id,
    pack_id: pack.id,
    pack_name: pack.name,
    months: pack.months,
    currency: pack.currency,
    amount: pack.total,
    tax_amount: pack.tax_amount,
  })
  if (error) throw new Error(error.message)

  return reply({
    key_id: secret('RAZORPAY_KEY_ID'),
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    pack_name: pack.name,
    email: user.email ?? null,
  })
}

async function confirm(admin: SupabaseClient, req: Request): Promise<Response> {
  const user = await signedInUser(admin, req)
  if (!user) return fail('Sign in again to finish', 401)

  const body = (await req.json().catch(() => ({}))) as { order_id?: string; payment_id?: string; signature?: string }
  if (!body.order_id || !body.payment_id || !body.signature) return fail('Something is missing from the payment', 400)

  const { data: order } = await admin.from('payment_orders').select('*').eq('id', body.order_id).eq('user_id', user.id).maybeSingle()
  if (!order) return fail('Unknown order', 404)

  if (!(await isCheckoutSigned(body.order_id, body.payment_id, body.signature, secret('RAZORPAY_KEY_SECRET')))) {
    return fail("The payment couldn't be verified", 400)
  }

  const entitlement = await recordPaid(admin, order as Order, body.payment_id)
  return reply({ entitlement })
}

async function webhook(admin: SupabaseClient, req: Request): Promise<Response> {
  const raw = await req.text()
  const signature = req.headers.get('X-Razorpay-Signature') ?? ''
  if (!(await isWebhookSigned(raw, signature, secret('RAZORPAY_WEBHOOK_SECRET')))) return fail('Bad signature', 400)

  let event: unknown
  try {
    event = JSON.parse(raw)
  } catch {
    return fail('Not JSON', 400)
  }
  const paid = paidPaymentIn(event)
  // Other events, and payments for orders this app didn't create, need nothing.
  if (!paid) return reply({ ignored: true })
  const { data: order } = await admin.from('payment_orders').select('*').eq('id', paid.orderId).maybeSingle()
  if (!order) return reply({ ignored: true })

  await recordPaid(admin, order as Order, paid.paymentId)
  return reply({ recorded: true })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return fail('Use POST', 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const route = new URL(req.url).pathname.split('/').pop()

  try {
    if (route === 'checkout') return await checkout(admin, req)
    if (route === 'confirm') return await confirm(admin, req)
    if (route === 'webhook') return await webhook(admin, req)
    return fail('Not found', 404)
  } catch (e) {
    console.error(e)
    // Razorpay retries a webhook that fails, which is what we want here.
    return fail(e instanceof Error ? e.message : 'Something went wrong', 500)
  }
})
