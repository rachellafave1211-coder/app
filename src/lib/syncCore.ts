import { normalizeState } from './budget'
import { emptyState } from './seed'
import type { EmailOtpType } from '@supabase/supabase-js'
import type { AppState } from './types'

/** Fields that describe this device, not the budget. They never sync. */
const DEVICE_ONLY = ['notified', 'notificationsOn'] as const
type DeviceOnly = (typeof DEVICE_ONLY)[number]

export type SyncedData = Omit<AppState, DeviceOnly>

export function toSynced(s: AppState): SyncedData {
  const copy: Partial<AppState> = { ...s }
  for (const k of DEVICE_ONLY) delete copy[k]
  return copy as SyncedData
}

/** Remote budget applied on top of this device's own settings. */
export function fromSynced(local: AppState, remote: Partial<SyncedData>): AppState {
  return normalizeState({ ...emptyState(), ...remote, notified: local.notified, notificationsOn: local.notificationsOn })
}

/** JSON with sorted keys; Postgres jsonb doesn't keep key order, so plain JSON.stringify can't compare. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v)
}

export const syncedKey = (s: AppState) => stableStringify(toSynced(s))

export type Plan = 'upload' | 'apply' | 'push' | 'conflict' | 'none'

/**
 * What to do when this device looks at the account's copy.
 * - firstLink: this device hasn't synced with this account before.
 * - dirty: this device has changes the account hasn't seen.
 * - lastRemoteAt: the account version this device last synced with.
 */
export function plan(opts: {
  remote: { data: unknown; updated_at: string } | null
  localKey: string
  firstLink: boolean
  dirty: boolean
  lastRemoteAt: string | null
}): Plan {
  const { remote, localKey, firstLink, dirty, lastRemoteAt } = opts
  if (!remote) return 'upload'
  const same = stableStringify(remote.data) === localKey
  if (same) return 'none'
  if (firstLink) return 'conflict'
  const remoteChanged = remote.updated_at !== lastRemoteAt
  if (remoteChanged && dirty) return 'conflict'
  if (remoteChanged) return 'apply'
  return dirty ? 'push' : 'none'
}

export type ParsedLink =
  | { kind: 'session'; access: string; refresh: string }
  | { kind: 'otp'; token: string; types: EmailOtpType[] }
  | { error: string }

/** Read a sign-in link copied from the email: its one-time code, or a finished session. */
export function parseSignInLink(raw: string): ParsedLink {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return { error: 'That doesn’t look like a link. In the email, press and hold the sign-in link, tap Copy, and paste it here.' }
  }
  // A link that already went through sign-in carries a session in its hash.
  const hash = new URLSearchParams(url.hash.slice(1))
  const access = hash.get('access_token')
  const refresh = hash.get('refresh_token')
  if (access && refresh) return { kind: 'session', access, refresh }
  const token = url.searchParams.get('token_hash') ?? url.searchParams.get('token')
  if (!token) return { error: 'That link has no sign-in code. Copy the link from the Payday sign-in email.' }
  const type = url.searchParams.get('type')
  const types: EmailOtpType[] = type === 'signup' ? ['signup', 'email'] : type === 'magiclink' ? ['magiclink', 'email'] : ['email']
  return { kind: 'otp', token, types }
}
