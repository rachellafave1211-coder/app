import { addMonths, dateInMonth } from './dates'
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
  shift: number
}

export interface PaycheckPlan {
  pay: PayInstance
  bills: BillOccurrence[]
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

export function sortedPaychecks(paychecks: Paycheck[]): Paycheck[] {
  return [...paychecks].sort((a, b) => a.day - b.day || a.id.localeCompare(b.id))
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

/**
 * Which pay instance covers a bill occurrence:
 * pinned → that paycheck in the due month; otherwise the last payday on or before the due date.
 * A shift then moves it N paychecks later.
 */
function assignIndex(instances: PayInstance[], bill: Bill, due: DateStr, month: MonthKey, shift: number): number {
  let idx = -1
  if (bill.pinnedPaycheckId) {
    idx = instances.findIndex((i) => i.month === month && i.paycheck.id === bill.pinnedPaycheckId)
  }
  if (idx < 0) {
    for (let i = 0; i < instances.length; i++) {
      if (instances[i].date <= due) idx = i
      else break
    }
  }
  if (idx < 0) return -1
  const target = idx + shift
  return target < instances.length ? target : -1
}

export function inWindow(date: DateStr, pay: PayInstance): boolean {
  return date >= pay.date && date < pay.end
}

export function planMonth(state: Pick<AppState, 'paychecks' | 'bills' | 'categories' | 'expenses' | 'paid' | 'shifts'>, month: MonthKey): MonthPlan {
  // Look a few months around so early/late bills and shifts land correctly.
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
  const byDate = new Map(plans.map((p) => [p.pay.date + p.pay.paycheck.id, p]))

  for (const bill of state.bills) {
    for (let m = addMonths(month, -2); m <= addMonths(month, 2); m = addMonths(m, 1)) {
      const key = occurrenceKey(bill.id, m)
      const due = dateInMonth(m, bill.day)
      const shift = state.shifts[key] ?? 0
      const idx = assignIndex(instances, bill, due, m, shift)
      if (idx < 0) continue
      const inst = instances[idx]
      const plan = byDate.get(inst.date + inst.paycheck.id)
      if (plan) plan.bills.push({ bill, due, key, paid: !!state.paid[key], shift })
    }
  }

  for (const plan of plans) {
    plan.bills.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.bill.name.localeCompare(b.bill.name)))
    plan.billsTotal = sum(plan.bills.map((b) => b.bill.amount))
    plan.left = plan.pay.paycheck.amount - plan.billsTotal - plan.categoryTotal
    plan.expenses = state.expenses.filter((e) => inWindow(e.date, plan.pay))
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

/** Every bill occurrence due between two dates (inclusive), in due order. */
export function billsDueBetween(state: Pick<AppState, 'bills' | 'paid'>, from: DateStr, to: DateStr): BillOccurrence[] {
  const out: BillOccurrence[] = []
  for (let m = addMonths(from.slice(0, 7), -1); m <= to.slice(0, 7); m = addMonths(m, 1)) {
    for (const bill of state.bills) {
      const due = dateInMonth(m, bill.day)
      if (due < from || due > to) continue
      const key = occurrenceKey(bill.id, m)
      out.push({ bill, due, key, paid: !!state.paid[key], shift: 0 })
    }
  }
  return out.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0))
}

export function sum(ns: number[]): number {
  return Math.round(ns.reduce((a, b) => a + b, 0) * 100) / 100
}

export function categoryById(categories: Category[], id: string): Category | undefined {
  return categories.find((c) => c.id === id)
}
