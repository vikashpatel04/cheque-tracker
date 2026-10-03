import { describe, expect, it } from 'vitest'
import { signedInCookie } from '@/lib/siteCookie'

describe('the signed-in flag for the website', () => {
  it('is only a flag, on the shared domain, sent over HTTPS only', () => {
    expect(signedInCookie(true, '.example.com')).toBe('ct_signed_in=1; Max-Age=31536000; Domain=.example.com; Path=/; Secure; SameSite=Lax')
  })

  it('is cleared when signed out', () => {
    expect(signedInCookie(false, '.example.com')).toBe('ct_signed_in=; Max-Age=0; Domain=.example.com; Path=/; Secure; SameSite=Lax')
  })

  it('is never set without a domain, or with one that could smuggle in more', () => {
    expect(signedInCookie(true, undefined)).toBeNull()
    expect(signedInCookie(true, '')).toBeNull()
    expect(signedInCookie(true, 'localhost')).toBeNull()
    expect(signedInCookie(true, '.example.com; Domain=.evil.test')).toBeNull()
  })
})
