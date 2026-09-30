import { useSyncExternalStore } from 'react'
import { normalizeState } from './budget'
import { emptyState } from './seed'
import type { AppState } from './types'

const KEY = 'payday:v1'

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return normalizeState({ ...emptyState(), ...JSON.parse(raw) })
  } catch {
    // Fall through to the sample budget.
  }
  // A device that has never used Payday starts with an empty budget; the sample is one tap away.
  return emptyState()
}

let state: AppState = load()
const listeners = new Set<() => void>()

export function getState(): AppState {
  return state
}

/** Replace state immutably: `update(s => ({ ...s, bills: [...] }))`. */
export function update(fn: (s: AppState) => AppState): void {
  state = fn(state)
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Storage full or blocked; keep working in memory.
  }
  listeners.forEach((l) => l())
}

export function replaceState(next: AppState): void {
  update(() => next)
}

/** Run `l` after every state change. Returns an unsubscribe function. */
export function subscribeStore(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function useStore(): AppState {
  return useSyncExternalStore(subscribeStore, getState)
}

/** Set an account to the amount you have now; later activity moves it from here. */
export function setBalance(account: keyof AppState['accounts'], amount: number): void {
  update((s) => ({ ...s, accounts: { ...s.accounts, [account]: { start: amount, since: Date.now() } } }))
}

/** Check a bill occurrence off (stamped with when it was paid), or un-check it. */
export function togglePaid(paid: AppState['paid'], key: string, at = Date.now()): AppState['paid'] {
  const next = { ...paid }
  if (next[key]) delete next[key]
  else next[key] = at
  return next
}

/** Toggle a key in one of the `Record<string, true>` maps. */
export function toggleFlag(map: Record<string, true>, key: string): Record<string, true> {
  const next = { ...map }
  if (next[key]) delete next[key]
  else next[key] = true
  return next
}
