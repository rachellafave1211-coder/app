import { addMonths, dateInMonth, shortDate, toDateStr } from './dates'
import type { AppState, Bill, Category, DateStr, Expense, MonthKey, Paycheck } from './types'

/** One paycheck landing on a specific date. */
export interface PayInstance {
  paycheck: Paycheck
  date: DateStr
  month: MonthKey
  /** Exclusive end of this paycheck's window: the next payday. */
  end: DateStr
}

/** One monthly occurrence of a bill. */
export interface BillOccurrence {
  bill: Bill
  due: DateStr
  /** `billId@YYYY-MM` — the due month identifies the occurrence. */
  key: string
  paid: boolean
}

/** Where a bill occurrence or an expense sits: the paycheck it counts toward, and where it would normally be. */
export interface Placement {
  current: PayInstance
  /** Where it normally goes: the bill's paycheck from Settings, else the last payday on or before its date. */
  original: PayInstance | null
  /** Moved away from `original` for just this month (older one-off moves). */
  moved: boolean
  /** The bill is assigned to a paycheck in Settings. */
  pinned: boolean
}

export type PlannedBill = BillOccurrence & Placement

export interface PaycheckPlan {
  pay: PayInstance
  bills: PlannedBill[]
  billsTotal: number
  categoryTotal: number
  /** Paycheck − bills − category budgets. Negative means short. */
  left: number
  expenses: Expense[]
  spent: number
  spentByCategory: Record<string, number>
}

export interface MonthPlan {
  month: MonthKey
  plans: PaycheckPlan[]
  income: number
  billsTotal: number
  spent: number
  /** Income − bills − spending across this month's paychecks. */
  leftToSpend: number
}

export const occurrenceKey = (billId: string, month: MonthKey) => `${billId}@${month}`

/** Identifies one paycheck in one month, e.g. `p2@2026-10`. Stored when an item is assigned to it. */
export const payKey = (pay: Pick<PayInstance, 'paycheck' | 'month'>) => `${pay.paycheck.id}@${pay.month}`

export function sortedPaychecks(paychecks: Paycheck[]): Paycheck[] {
  return [...paychecks].sort((a, b) => a.day - b.day || a.id.localeCompare(b.id))
}

/** "Paycheck 2 · Oct 10" (or just "Paycheck 2"): numbered by pay day within the month. */
export function paycheckLabel(paychecks: Paycheck[], pay: PayInstance, withDate = true): string {
  const n = sortedPaychecks(paychecks).findIndex((p) => p.id === pay.paycheck.id) + 1
  return withDate ? `Paycheck ${n} · ${shortDate(pay.date)}` : `Paycheck ${n}`
}

/** Paydays from `from` through `to` (inclusive months), in date order, each with its window end. */
export function payInstances(paychecks: Paycheck[], from: MonthKey, to: MonthKey): PayInstance[] {
  const sorted = sortedPaychecks(paychecks)
  if (!sorted.length) return []
  const out: Omit<PayInstance, 'end'>[] = []
  // One extra month so the last instance knows where its window ends.
  for (let m = from; m <= addMonths(to, 1); m = addMonths(m, 1)) {
    for (const p of sorted) out.push({ paycheck: p, date: dateInMonth(m, p.day), month: m })
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return out
    .map((inst, i) => ({ ...inst, end: out[i + 1]?.date ?? '9999-12-31' }))
    .filter((inst) => inst.month <= to)
}

/** The last payday on or before `date`: the paycheck an item belongs to by its date. */
function autoIndex(instances: PayInstance[], date: DateStr): number {
  let idx = -1
  for (let i = 0; i < instances.length; i++) {
    if (instances[i].date <= date) idx = i
    else break
  }
  return idx
}

/** The last payday of one particular paycheck on or before `date`. */
function paycheckIndex(instances: PayInstance[], date: DateStr, paycheckId: string): number {
  let idx = -1
  for (let i = 0; i < instances.length && instances[i].date <= date; i++) if (instances[i].paycheck.id === paycheckId) idx = i
  return idx
}

/**
 * Where an item with this date counts: a one-month move first, then the bill's paycheck from
 * Settings, then the last payday on or before the date. A choice whose paycheck no longer exists
 * is skipped, so an item always lands on exactly one paycheck.
 */
function place(instances: PayInstance[], date: DateStr, assigned: string | undefined, pinnedTo?: string): Placement | null {
  const pin = pinnedTo ? paycheckIndex(instances, date, pinnedTo) : -1
  const base = pin >= 0 ? pin : autoIndex(instances, date)
  const chosen = assigned ? instances.findIndex((i) => payKey(i) === assigned) : -1
  const idx = chosen >= 0 ? chosen : base
  if (idx < 0) return null
  const original = base >= 0 ? instances[base] : null
  return { current: instances[idx], original, moved: !original || idx !== base, pinned: pin >= 0 }
}

/** Where an expense counts, and where its date put it. */
export function placeExpense(paychecks: Paycheck[], e: Expense): Placement | null {
  const m = e.date.slice(0, 7)
  return place(payInstances(paychecks, addMonths(m, -2), addMonths(m, 2)), e.date, e.paycheck)
}

export function inWindow(date: DateStr, pay: PayInstance): boolean {
  return date >= pay.date && date < pay.end
}

type PlanInput = Pick<AppState, 'paychecks' | 'bills' | 'categories' | 'expenses' | 'paid' | 'assign'>

export function planMonth(state: PlanInput, month: MonthKey): MonthPlan {
  // Look a few months around: bills due early next month, and items assigned across a month boundary.
  const instances = payInstances(state.paychecks, addMonths(month, -3), addMonths(month, 3))
  const categoryTotal = sum(state.categories.map((c) => c.budget))

  const plans: PaycheckPlan[] = instances
    .filter((i) => i.month === month)
    .map((pay) => ({
      pay,
      bills: [],
      billsTotal: 0,
      categoryTotal,
      left: 0,
      expenses: [],
      spent: 0,
      spentByCategory: {},
    }))
  const byKey = new Map(plans.map((p) => [payKey(p.pay), p]))

  for (const bill of state.bills) {
    for (let m = addMonths(month, -2); m <= addMonths(month, 2); m = addMonths(m, 1)) {
      const key = occurrenceKey(bill.id, m)
      const due = dateInMonth(m, bill.day)
      const where = place(instances, due, state.assign[key], bill.paycheckId)
      const plan = where && byKey.get(payKey(where.current))
      if (plan) plan.bills.push({ bill, due, key, paid: !!state.paid[key], ...where! })
    }
  }

  const from = dateInMonth(addMonths(month, -2), 1)
  const to = dateInMonth(addMonths(month, 2), 31)
  for (const e of state.expenses) {
    if (e.date < from || e.date > to) continue
    const where = place(instances, e.date, e.paycheck)
    const plan = where && byKey.get(payKey(where.current))
    if (plan) plan.expenses.push(e)
  }

  for (const plan of plans) {
    plan.bills.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.bill.name.localeCompare(b.bill.name)))
    plan.billsTotal = sum(plan.bills.map((b) => b.bill.amount))
    plan.left = plan.pay.paycheck.amount - plan.billsTotal - plan.categoryTotal
    plan.spent = sum(plan.expenses.map((e) => e.amount))
    for (const e of plan.expenses) {
      plan.spentByCategory[e.categoryId] = (plan.spentByCategory[e.categoryId] ?? 0) + e.amount
    }
  }

  const income = sum(plans.map((p) => p.pay.paycheck.amount))
  const billsTotal = sum(plans.map((p) => p.billsTotal))
  const spent = sum(plans.map((p) => p.spent))
  return { month, plans, income, billsTotal, spent, leftToSpend: income - billsTotal - spent }
}

/** Assign a bill occurrence to a paycheck. Choosing its automatic paycheck clears the assignment. */
export function assignBill(state: AppState, key: string, to: PayInstance, original: PayInstance | null): AppState {
  const assign = { ...state.assign }
  if (original && payKey(original) === payKey(to)) delete assign[key]
  else assign[key] = payKey(to)
  return { ...state, assign }
}

/** Assign an expense to a paycheck. Choosing its automatic paycheck clears the assignment. */
export function assignExpense(state: AppState, id: string, to: PayInstance, original: PayInstance | null): AppState {
  const back = original && payKey(original) === payKey(to)
  return {
    ...state,
    expenses: state.expenses.map((e) => {
      if (e.id !== id) return e
      const next = { ...e }
      if (back) delete next.paycheck
      else next.paycheck = payKey(to)
      return next
    }),
  }
}

/**
 * Bring older saved data up to date. Earlier versions moved bills with "N paychecks later"
 * shifts; each becomes an assignment to the paycheck it had landed on.
 */
export function normalizeState(state: AppState): AppState {
  const { shifts, ...rest } = state as AppState & { shifts?: Record<string, number> }
  if (!shifts) return state
  const assign = { ...(rest.assign ?? {}) }
  const bills = new Map(rest.bills.map((b) => [b.id, b]))
  for (const [key, n] of Object.entries(shifts)) {
    const [billId, month] = key.split('@')
    const bill = bills.get(billId)
    if (!bill || !month || !n || assign[key]) continue
    const instances = payInstances(rest.paychecks, addMonths(month, -2), addMonths(month, 3))
    const auto = autoIndex(instances, dateInMonth(month, bill.day))
    const target = instances[auto + n]
    if (auto >= 0 && target) assign[key] = payKey(target)
  }
  return { ...rest, assign }
}

/** Every bill occurrence due between two dates (inclusive), in due order. */
export function billsDueBetween(state: Pick<AppState, 'bills' | 'paid'>, from: DateStr, to: DateStr): BillOccurrence[] {
  const out: BillOccurrence[] = []
  for (let m = addMonths(from.slice(0, 7), -1); m <= to.slice(0, 7); m = addMonths(m, 1)) {
    for (const bill of state.bills) {
      const due = dateInMonth(m, bill.day)
      if (due < from || due > to) continue
      const key = occurrenceKey(bill.id, m)
      out.push({ bill, due, key, paid: !!state.paid[key] })
    }
  }
  return out.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0))
}

export interface Balances {
  checking: number
  savings: number
  total: number
}

/**
 * Running balances from the amounts you entered. Checking gains each payday after the
 * day it was set and loses expenses and paid bills logged after it was set. Paid savings
 * items move from Checking to Savings.
 */
export function balances(state: Pick<AppState, 'accounts' | 'paychecks' | 'bills' | 'expenses' | 'paid'>, now = Date.now()): Balances {
  const { checking: ck, savings: sv } = state.accounts
  const todayStr = toDateStr(new Date(now))
  const ckDay = toDateStr(new Date(ck.since))

  const pay = payInstances(state.paychecks, ckDay.slice(0, 7), todayStr.slice(0, 7))
    .filter((p) => p.date > ckDay && p.date <= todayStr)
    .map((p) => p.paycheck.amount)

  const spent = state.expenses
    .filter((e) => e.addedAt !== undefined && e.addedAt > ck.since && e.date >= ckDay && e.date <= todayStr)
    .map((e) => e.amount)

  const billById = new Map(state.bills.map((b) => [b.id, b]))
  const paidBills: number[] = []
  const toSavings: number[] = []
  for (const [key, at] of Object.entries(state.paid)) {
    const bill = billById.get(key.split('@')[0])
    if (!bill || typeof at !== 'number') continue
    if (at > ck.since) paidBills.push(bill.amount)
    if (bill.type === 'savings' && at > sv.since) toSavings.push(bill.amount)
  }

  const checking = sum([ck.start, ...pay]) - sum(spent) - sum(paidBills)
  const savings = sum([sv.start, ...toSavings])
  return { checking: round2(checking), savings, total: round2(checking + savings) }
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function sum(ns: number[]): number {
  return Math.round(ns.reduce((a, b) => a + b, 0) * 100) / 100
}

export function categoryById(categories: Category[], id: string): Category | undefined {
  return categories.find((c) => c.id === id)
}
