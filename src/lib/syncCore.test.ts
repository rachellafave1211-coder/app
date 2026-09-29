import { describe, expect, it } from 'vitest'
import { sampleState } from './seed'
import { fromSynced, parseSignInLink, plan, stableStringify, syncedKey, toSynced } from './syncCore'

describe('sync data', () => {
  it('leaves device-only settings out of what syncs', () => {
    const s = { ...sampleState(), notificationsOn: true, notified: { 'bill:x': true as const } }
    const synced = toSynced(s) as Record<string, unknown>
    expect(synced.notificationsOn).toBeUndefined()
    expect(synced.notified).toBeUndefined()
    expect(synced.accounts).toEqual(s.accounts)
  })

  it('keeps this device’s alert settings when applying the account copy', () => {
    const local = { ...sampleState(), notificationsOn: true }
    const remote = toSynced({ ...sampleState(), expenses: [{ id: 'e', date: '2026-10-01', note: '', categoryId: '', amount: 5 }] })
    const merged = fromSynced(local, remote)
    expect(merged.notificationsOn).toBe(true)
    expect(merged.expenses).toHaveLength(1)
  })

  it('compares data regardless of key order', () => {
    expect(stableStringify({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(stableStringify({ a: [{ c: 3, d: 2 }], b: 1 }))
  })
})

describe('plan', () => {
  const local = sampleState()
  const localKey = syncedKey(local)
  const other = toSynced({ ...local, accounts: { ...local.accounts, checking: { start: 1, since: 0 } } })
  const base = { localKey, firstLink: false, dirty: false, lastRemoteAt: 't1' }

  it('uploads when the account has no budget yet', () => {
    expect(plan({ ...base, remote: null, firstLink: true })).toBe('upload')
  })
  it('does nothing when both copies match', () => {
    expect(plan({ ...base, remote: { data: toSynced(local), updated_at: 't9' }, firstLink: true })).toBe('none')
  })
  it('asks on a first sign-in when the copies differ', () => {
    expect(plan({ ...base, remote: { data: other, updated_at: 't1' }, firstLink: true })).toBe('conflict')
  })
  it('takes the account copy when only it changed', () => {
    expect(plan({ ...base, remote: { data: other, updated_at: 't2' } })).toBe('apply')
  })
  it('sends this device’s changes when only it changed', () => {
    expect(plan({ ...base, dirty: true, remote: { data: other, updated_at: 't1' } })).toBe('push')
  })
  it('asks when both changed', () => {
    expect(plan({ ...base, dirty: true, remote: { data: other, updated_at: 't2' } })).toBe('conflict')
  })
})

describe('parseSignInLink', () => {
  it('reads the one-time code from a Supabase email link', () => {
    const link = 'https://abcd.supabase.co/auth/v1/verify?token=0a1b2c3d4e&type=magiclink&redirect_to=https://app-bay-rho-90.vercel.app'
    expect(parseSignInLink(link)).toEqual({ kind: 'otp', token: '0a1b2c3d4e', types: ['magiclink', 'email'] })
    expect(parseSignInLink(' https://abcd.supabase.co/auth/v1/verify?token=x&type=signup ')).toEqual({ kind: 'otp', token: 'x', types: ['signup', 'email'] })
    expect(parseSignInLink('https://site.app/?token_hash=h&type=email')).toEqual({ kind: 'otp', token: 'h', types: ['email'] })
  })
  it('reads a finished session from a redirected link', () => {
    expect(parseSignInLink('https://site.app/#access_token=a&refresh_token=r&type=magiclink')).toEqual({ kind: 'session', access: 'a', refresh: 'r' })
  })
  it('explains what went wrong', () => {
    expect('error' in parseSignInLink('hello')).toBe(true)
    expect('error' in parseSignInLink('https://site.app/')).toBe(true)
  })
})
