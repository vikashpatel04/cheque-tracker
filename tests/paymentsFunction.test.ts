/**
 * The payments Edge Function's checks (supabase/functions/payments/razorpay.ts):
 * signatures computed the way Razorpay documents them, with made-up secrets.
 */
import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { hmacHex, isCheckoutSigned, isWebhookSigned, paidPaymentIn, sameText } from '../supabase/functions/payments/razorpay.ts'

const sign = (secret: string, message: string) => createHmac('sha256', secret).update(message).digest('hex')

describe('payment signatures', () => {
  it('match an HMAC-SHA256 in hex', async () => {
    expect(await hmacHex('test-secret', 'hello')).toBe(sign('test-secret', 'hello'))
  })

  it("accept Checkout's signature of order|payment, and nothing else", async () => {
    const signature = sign('key-secret', 'order_A|pay_B')
    expect(await isCheckoutSigned('order_A', 'pay_B', signature, 'key-secret')).toBe(true)
    expect(await isCheckoutSigned('order_A', 'pay_C', signature, 'key-secret')).toBe(false)
    expect(await isCheckoutSigned('order_A', 'pay_B', signature, 'other-secret')).toBe(false)
    expect(await isCheckoutSigned('order_A', 'pay_B', '', 'key-secret')).toBe(false)
  })

  it("accept a webhook only when its exact body was signed", async () => {
    const body = '{"event":"order.paid"}'
    const signature = sign('hook-secret', body)
    expect(await isWebhookSigned(body, signature, 'hook-secret')).toBe(true)
    expect(await isWebhookSigned(`${body} `, signature, 'hook-secret')).toBe(false)
  })

  it('compare whole strings', () => {
    expect(sameText('abc', 'abc')).toBe(true)
    expect(sameText('abc', 'abd')).toBe(false)
    expect(sameText('abc', 'abcd')).toBe(false)
  })
})

describe('webhook events', () => {
  const payment = { id: 'pay_1', order_id: 'order_1', amount: 11800, currency: 'XTS', status: 'captured' }

  it('report captured payments from order.paid and payment.captured', () => {
    const expected = { orderId: 'order_1', paymentId: 'pay_1', amount: 11800, currency: 'XTS' }
    expect(paidPaymentIn({ event: 'order.paid', payload: { payment: { entity: payment } } })).toEqual(expected)
    expect(paidPaymentIn({ event: 'payment.captured', payload: { payment: { entity: payment } } })).toEqual(expected)
  })

  it('ignore other events and payments not taken yet', () => {
    expect(paidPaymentIn({ event: 'payment.failed', payload: { payment: { entity: payment } } })).toBeNull()
    expect(paidPaymentIn({ event: 'order.paid', payload: { payment: { entity: { ...payment, status: 'authorized' } } } })).toBeNull()
    expect(paidPaymentIn({ event: 'order.paid', payload: {} })).toBeNull()
    expect(paidPaymentIn(null)).toBeNull()
  })
})
