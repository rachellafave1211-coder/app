import { emptyState } from './seed'
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
  return { ...emptyState(), ...remote, notified: local.notified, notificationsOn: local.notificationsOn }
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
