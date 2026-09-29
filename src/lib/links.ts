import { uid } from './format'
import type { AppState, Bill, BillType, Category, Household, Paycheck } from './types'

/** Shareable links carry their payload in the URL hash, so nothing leaves the device until shared. */
export type LinkPayload =
  | { kind: 'template'; name: string; paychecks: Omit<Paycheck, 'id'>[]; categories: Omit<Category, 'id'>[]; bills: Omit<Bill, 'id' | 'splitWith'>[] }
  | { kind: 'household'; household: Household; from: string; splits: { name: string; day: number; amount: number }[] }

function encode(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj))
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decode(s: string): unknown {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))))
}

export function makeLink(payload: LinkPayload): string {
  return `${location.origin}${location.pathname}#${payload.kind}=${encode(payload)}`
}

export function templateLink(state: AppState, includeAmounts: boolean): string {
  const amt = (n: number) => (includeAmounts ? n : 0)
  return makeLink({
    kind: 'template',
    name: 'Payday budget template',
    paychecks: state.paychecks.map((p) => ({ day: p.day, amount: amt(p.amount) })),
    categories: state.categories.map((c) => ({ name: c.name, emoji: c.emoji, budget: amt(c.budget) })),
    bills: state.bills.map((b) => ({ name: b.name, day: b.day, amount: amt(b.amount), type: b.type })),
  })
}

export function householdLink(state: AppState, from: string): string {
  return makeLink({
    kind: 'household',
    household: state.household,
    from,
    splits: state.bills.filter((b) => b.splitWith?.length).map((b) => ({ name: b.name, day: b.day, amount: b.amount })),
  })
}

const TYPES: BillType[] = ['bill', 'subscription', 'savings', 'debt']
const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo)
const str = (v: unknown, max = 60) => (typeof v === 'string' ? v.slice(0, max) : '')
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.slice(0, 100).filter((x) => x && typeof x === 'object') : [])

/** Read and validate a payload from the current URL hash. Untrusted input: every field is sanitized. */
export function readLink(hash: string): LinkPayload | null {
  const m = hash.match(/^#(template|household)=([A-Za-z0-9_-]+)$/)
  if (!m) return null
  try {
    const raw = decode(m[2]) as Record<string, unknown>
    if (m[1] === 'template') {
      return {
        kind: 'template',
        name: str(raw.name) || 'Budget template',
        paychecks: arr(raw.paychecks).map((p) => ({ day: num(p.day, 1, 31), amount: num(p.amount, 0, 1e7) })),
        categories: arr(raw.categories).map((c) => ({ name: str(c.name) || 'Category', emoji: str(c.emoji, 8) || '•', budget: num(c.budget, 0, 1e7) })),
        bills: arr(raw.bills).map((b) => ({
          name: str(b.name) || 'Bill',
          day: num(b.day, 1, 31),
          amount: num(b.amount, 0, 1e7),
          type: TYPES.includes(b.type as BillType) ? (b.type as BillType) : 'bill',
        })),
      }
    }
    const h = (raw.household ?? {}) as Record<string, unknown>
    return {
      kind: 'household',
      from: str(raw.from) || 'A friend',
      household: { name: str(h.name) || 'Household', members: arr(h.members).map((mm) => ({ id: str(mm.id, 20) || uid(), name: str(mm.name) || 'Roommate' })) },
      splits: arr(raw.splits).map((b) => ({ name: str(b.name) || 'Bill', day: num(b.day, 1, 31), amount: num(b.amount, 0, 1e7) })),
    }
  } catch {
    return null
  }
}

export function applyTemplate(state: AppState, t: Extract<LinkPayload, { kind: 'template' }>): AppState {
  return {
    ...state,
    paychecks: t.paychecks.map((p) => ({ ...p, id: uid() })),
    categories: t.categories.map((c) => ({ ...c, id: uid() })),
    bills: t.bills.map((b) => ({ ...b, id: uid() })),
    paid: {},
    assign: {},
  }
}
