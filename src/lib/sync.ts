import { createClient, type RealtimeChannel, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { getState, replaceState, subscribeStore } from './store'
import { fromSynced, plan, stableStringify, syncedKey, toSynced, type SyncedData } from './syncCore'

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Sync is available only when the site was built with Supabase settings. */
export const syncConfigured = !!(URL && KEY)
const supabase: SupabaseClient | null = syncConfigured ? createClient(URL!, KEY!) : null

interface Row {
  data: SyncedData
  updated_at: string
  client_id: string | null
}

export type SyncStatus = 'off' | 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error'

export interface SyncView {
  status: SyncStatus
  email: string | null
  lastSynced: number | null
  error: string | null
  /** The account and this device both have different data; the person picks one. */
  conflict: { remote: Row; firstLink: boolean } | null
}

// ---- persisted per-device sync bookkeeping ----

interface Meta {
  clientId: string
  userId: string | null
  /** `updated_at` of the account copy this device last matched. */
  lastRemoteAt: string | null
  /** This device has changes the account hasn't received. */
  dirty: boolean
}

const META_KEY = 'payday:sync'

function loadMeta(): Meta {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) ?? '')
    if (m && typeof m.clientId === 'string') return m
  } catch {
    // Start fresh.
  }
  return { clientId: Math.random().toString(36).slice(2) + Date.now().toString(36), userId: null, lastRemoteAt: null, dirty: false }
}

let meta = loadMeta()
function saveMeta(patch: Partial<Meta>) {
  meta = { ...meta, ...patch }
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    // Storage blocked; bookkeeping stays in memory.
  }
}

// ---- observable status for the UI ----

let view: SyncView = { status: syncConfigured ? 'signed-out' : 'off', email: null, lastSynced: null, error: null, conflict: null }
const listeners = new Set<() => void>()
function setView(patch: Partial<SyncView>) {
  view = { ...view, ...patch }
  listeners.forEach((l) => l())
}

export function useSync(): SyncView {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => view,
  )
}

// ---- the sync loop ----

let userId: string | null = null
let channel: RealtimeChannel | null = null
let pushTimer: ReturnType<typeof setTimeout> | undefined
let applying = false
let lastKey = syncedKey(getState())

function applyRemote(row: Row) {
  applying = true
  try {
    replaceState(fromSynced(getState(), row.data))
  } finally {
    applying = false
  }
  lastKey = syncedKey(getState())
  saveMeta({ lastRemoteAt: row.updated_at, dirty: false })
  setView({ status: 'synced', lastSynced: Date.now(), error: null })
}

/**
 * Send this device's budget to the account. A save only succeeds if the account still
 * holds the version this device last synced with; otherwise another device changed it
 * first, and we reconcile (which asks the person) instead of overwriting.
 */
async function push(): Promise<void> {
  if (!supabase || !userId || view.conflict) return
  if (!navigator.onLine) return setView({ status: 'offline' })
  clearTimeout(pushTimer)
  const state = getState()
  const sentKey = syncedKey(state)
  const fields = { data: toSynced(state), client_id: meta.clientId }
  setView({ status: 'syncing' })

  const res = meta.lastRemoteAt
    ? await supabase.from('budgets').update(fields).eq('user_id', userId).eq('updated_at', meta.lastRemoteAt).select('updated_at')
    : await supabase.from('budgets').insert({ user_id: userId, ...fields }).select('updated_at')

  if (res.error) {
    // 23505: another device created the account's budget first.
    if (res.error.code === '23505') return reconcile()
    setView({ status: navigator.onLine ? 'error' : 'offline', error: res.error.message })
    return
  }
  const saved = res.data?.[0]
  if (!saved) return reconcile() // The account changed since we last synced.

  // Anything changed while the request was in flight still needs sending.
  const stillDirty = syncedKey(getState()) !== sentKey
  saveMeta({ lastRemoteAt: saved.updated_at, dirty: stillDirty })
  setView({ status: 'synced', lastSynced: Date.now(), error: null })
  if (stillDirty) schedulePush()
}

function schedulePush() {
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => void push(), 800)
}

/** Compare this device with the account copy and bring them together. */
async function reconcile(firstLink = false): Promise<void> {
  if (!supabase || !userId || view.conflict) return
  if (!navigator.onLine) return setView({ status: 'offline' })
  setView({ status: 'syncing' })
  const { data: remote, error } = await supabase.from('budgets').select('data, updated_at, client_id').eq('user_id', userId).maybeSingle<Row>()
  if (error) return setView({ status: 'error', error: error.message })

  const next = plan({ remote, localKey: syncedKey(getState()), firstLink, dirty: meta.dirty, lastRemoteAt: meta.lastRemoteAt })
  if (next === 'upload') {
    saveMeta({ lastRemoteAt: null })
    return push()
  }
  if (next === 'push') return push()
  if (next === 'apply') return applyRemote(remote!)
  if (next === 'conflict') return setView({ status: 'synced', conflict: { remote: remote!, firstLink } })
  saveMeta({ lastRemoteAt: remote!.updated_at, dirty: false })
  setView({ status: 'synced', lastSynced: Date.now(), error: null })
}

function listen(uid: string) {
  if (!supabase) return
  channel = supabase
    .channel(`budget-${uid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets', filter: `user_id=eq.${uid}` }, (payload) => {
      const row = payload.new as Row | undefined
      if (!row?.data || row.client_id === meta.clientId || view.conflict) return
      if (stableStringify(row.data) === syncedKey(getState())) {
        saveMeta({ lastRemoteAt: row.updated_at })
        return
      }
      if (meta.dirty) setView({ conflict: { remote: row, firstLink: false } })
      else applyRemote(row)
    })
    .subscribe()
}

async function onSession(session: Session | null) {
  const uid = session?.user.id ?? null
  if (uid === userId) return
  if (channel) await supabase?.removeChannel(channel)
  channel = null
  userId = uid
  if (!uid) return setView({ status: 'signed-out', email: null, conflict: null })

  setView({ email: session!.user.email ?? null })
  const firstLink = meta.userId !== uid
  if (firstLink) saveMeta({ userId: uid, lastRemoteAt: null })
  listen(uid)
  await reconcile(firstLink)
}

let started = false

/** Start syncing if this site has Supabase settings. Safe to call more than once. */
export function startSync() {
  if (!supabase || started) return
  started = true

  subscribeStore(() => {
    if (applying) return
    const key = syncedKey(getState())
    if (key === lastKey) return
    lastKey = key
    saveMeta({ dirty: true })
    if (userId) schedulePush()
  })

  supabase.auth.getSession().then(({ data }) => onSession(data.session))
  supabase.auth.onAuthStateChange((_event, session) => void onSession(session))

  addEventListener('online', () => void reconcile())
  addEventListener('offline', () => userId && setView({ status: 'offline' }))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void reconcile()
  })
}

export async function sendSignInLink(email: string): Promise<string | null> {
  if (!supabase) return 'Sync isn’t set up for this site.'
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } })
  return error ? error.message : null
}

/** Sign in with the 6-digit code from the email; works inside an installed home-screen app. */
export async function verifyCode(email: string, code: string): Promise<string | null> {
  if (!supabase) return 'Sync isn’t set up for this site.'
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
  return error ? error.message : null
}

export async function signOut() {
  await supabase?.auth.signOut()
}

export function syncNow() {
  return reconcile()
}

/** Settle a conflict by keeping the account's copy or this device's. */
export function resolveConflict(keep: 'account' | 'device') {
  const c = view.conflict
  if (!c) return
  setView({ conflict: null })
  if (keep === 'account') applyRemote(c.remote)
  else {
    // Overwrite exactly the version the person was shown; if it changed again since, they're asked again.
    saveMeta({ dirty: true, lastRemoteAt: c.remote.updated_at })
    void push()
  }
}
