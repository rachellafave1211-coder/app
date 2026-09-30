import { useSyncExternalStore } from 'react'
import type { BankAccount, BankTransaction } from './bankData'
import { supabaseClient } from './sync'

export interface BankItem {
  item_id: string
  institution_name: string
}

export interface SyncResult {
  transactions: BankTransaction[]
  accounts: BankAccount[]
  next_cursor: string | null
}

/** Why the bank connection can't be used right now, in words the person can act on. */
export class BankError extends Error {}

/** Call the `plaid` Edge Function on the signed-in account. */
async function request<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const supabase = supabaseClient()
  if (!supabase) throw new BankError('Set up sync first: the bank connection uses your Payday account.')
  const { data: session } = await supabase.auth.getSession()
  if (!session.session) throw new BankError('Sign in under Sync across devices first.')
  const { data, error } = await supabase.functions.invoke('plaid', { body: { action, ...body } })
  if (error) {
    // The function's own message (e.g. "Your bank needs you to sign in again") when it sent one.
    const ctx = (error as { context?: Response }).context
    const status = ctx?.status
    const payload = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null
    if (payload?.error) throw new BankError(payload.error)
    if (status === 404 || /FunctionsFetchError|Failed to send/.test(String(error.name ?? error.message)))
      throw new BankError('The bank connection isn’t set up on your Supabase project yet. See “Connect your bank” in the README.')
    throw new BankError('Couldn’t reach the bank connection. Check your internet and try again.')
  }
  return data as T
}

export const bankApi = {
  linkToken: () => request<{ link_token: string }>('link_token'),
  exchange: (public_token: string, institution_name: string) => request<{ item: BankItem }>('exchange', { public_token, institution_name }),
  list: () => request<{ items: BankItem[] }>('list'),
  sync: (item_id: string) => request<SyncResult>('sync', { item_id }),
  commit: (item_id: string, cursor: string | null) => request<{ ok: true }>('commit', { item_id, cursor }),
  remove: (item_id: string) => request<{ ok: true }>('remove', { item_id }),
}

// ---- connected banks, shared by every screen ----

interface BankView {
  items: BankItem[] | null
  loading: boolean
  error: string | null
}

let view: BankView = { items: null, loading: false, error: null }
const listeners = new Set<() => void>()
const setView = (patch: Partial<BankView>) => {
  view = { ...view, ...patch }
  listeners.forEach((l) => l())
}

export function useBank(): BankView {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => view,
  )
}

export async function refreshBanks() {
  setView({ loading: true, error: null })
  try {
    const { items } = await bankApi.list()
    setView({ items, loading: false })
  } catch (e) {
    setView({ loading: false, error: (e as Error).message })
  }
}

export async function disconnectBank(itemId: string) {
  await bankApi.remove(itemId)
  setView({ items: (view.items ?? []).filter((i) => i.item_id !== itemId) })
}

// ---- Plaid Link ----

interface PlaidHandler {
  open: () => void
  destroy: () => void
}
interface PlaidGlobal {
  create: (config: {
    token: string
    receivedRedirectUri?: string
    onSuccess: (publicToken: string, metadata: { institution?: { name?: string } | null }) => void
    onExit: (err: { display_message?: string | null; error_message?: string } | null) => void
  }) => PlaidHandler
}

const LINK_SCRIPT = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'
const PENDING_TOKEN = 'payday:plaid-link-token'

let plaidLoading: Promise<PlaidGlobal> | null = null
function loadPlaid(): Promise<PlaidGlobal> {
  const existing = (window as unknown as { Plaid?: PlaidGlobal }).Plaid
  if (existing) return Promise.resolve(existing)
  plaidLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = LINK_SCRIPT
    s.async = true
    s.onload = () => resolve((window as unknown as { Plaid: PlaidGlobal }).Plaid)
    s.onerror = () => {
      plaidLoading = null
      reject(new BankError('Couldn’t load the bank sign-in window. Check your internet and try again.'))
    }
    document.head.appendChild(s)
  })
  return plaidLoading
}

/** Opens Plaid's bank sign-in, then saves the connection. Resolves with the new bank, or null if closed. */
function runLink(token: string, receivedRedirectUri?: string): Promise<BankItem | null> {
  return loadPlaid().then(
    (Plaid) =>
      new Promise((resolve, reject) => {
        const handler = Plaid.create({
          token,
          receivedRedirectUri,
          onSuccess: (publicToken, metadata) => {
            handler.destroy()
            clearPendingToken()
            bankApi
              .exchange(publicToken, metadata.institution?.name ?? 'Bank')
              .then(({ item }) => {
                setView({ items: [...(view.items ?? []).filter((i) => i.item_id !== item.item_id), item] })
                resolve(item)
              }, reject)
          },
          onExit: (err) => {
            handler.destroy()
            clearPendingToken()
            if (err) reject(new BankError(err.display_message || err.error_message || 'The bank sign-in was closed.'))
            else resolve(null)
          },
        })
        handler.open()
      }),
  )
}

const clearPendingToken = () => {
  try {
    localStorage.removeItem(PENDING_TOKEN)
  } catch {
    // Nothing saved.
  }
}

/** Connect a new bank through Plaid Link. */
export async function connectBank(): Promise<BankItem | null> {
  const { link_token } = await bankApi.linkToken()
  // Some banks sign in on their own website and send the person back to Payday; the same
  // link token is needed to finish, so keep it until then.
  try {
    localStorage.setItem(PENDING_TOKEN, link_token)
  } catch {
    // Those banks can't finish without it, but others still work.
  }
  return runLink(link_token)
}

/**
 * Finish a bank sign-in that went through the bank's own website: Plaid sends the person back
 * to Payday with `?oauth_state_id=…`, and Link is reopened with the saved token.
 */
export async function resumeBankSignIn(): Promise<BankItem | null> {
  if (!new URLSearchParams(location.search).has('oauth_state_id')) return null
  let token: string | null = null
  try {
    token = localStorage.getItem(PENDING_TOKEN)
  } catch {
    token = null
  }
  const redirect = location.href
  history.replaceState(null, '', location.pathname + location.hash)
  if (!token) throw new BankError('The bank sign-in couldn’t be finished. Try connecting again.')
  return runLink(token, redirect)
}
