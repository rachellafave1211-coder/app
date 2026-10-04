import { nearestOccurrence } from './budget'
import { toDateStr } from './dates'
import type { AppState, Category, Expense } from './types'

/**
 * A merchant name with store numbers, card-processor prefixes and punctuation removed, so
 * "SQ *BLUE BOTTLE #1234" and "Blue Bottle" match.
 */
export function merchantKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(sq|tst|pp|paypal|sp)\s*\*\s*/, '')
    .replace(/[^a-z& ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const hasCategory = (e: Expense, categories: Category[]) => !!e.categoryId && categories.some((c) => c.id === e.categoryId)

/** The category the person last chose for this merchant, or '' if they never categorized it. */
export function learnedCategory(name: string, expenses: Expense[], categories: Category[]): string {
  const key = merchantKey(name)
  if (!key) return ''
  let best: Expense | null = null
  for (const e of expenses) {
    if (merchantKey(e.note) !== key || !hasCategory(e, categories)) continue
    if (!best || (e.addedAt ?? 0) > (best.addedAt ?? 0) || ((e.addedAt ?? 0) === (best.addedAt ?? 0) && e.date > best.date)) best = e
  }
  return best?.categoryId ?? ''
}

/** Other uncategorized expenses from the same merchant as `expense`. */
export function sameMerchantUncategorized(expense: Pick<Expense, 'id' | 'note'>, expenses: Expense[], categories: Category[]): Expense[] {
  const key = merchantKey(expense.note)
  if (!key) return []
  return expenses.filter((e) => e.id !== expense.id && merchantKey(e.note) === key && !hasCategory(e, categories))
}

export const isUncategorized = (e: Expense, categories: Category[]) => !hasCategory(e, categories)

/**
 * Turns an expense into a payment of `billId`: the bill's nearest occurrence is checked off,
 * the expense is removed so it isn't counted twice, and the merchant is remembered so later
 * imports check the bill off on their own.
 */
export function payBillWithExpense(state: AppState, expenseId: string, billId: string, now = Date.now()): { state: AppState; key: string } | null {
  const expense = state.expenses.find((e) => e.id === expenseId)
  const bill = state.bills.find((b) => b.id === billId)
  if (!expense || !bill) return null
  const key = nearestOccurrence(bill, expense.date, state.paid)
  // Keep the balance effect the expense had: counted only if it was logged after Checking was set.
  const since = state.accounts.checking.since
  const counted = expense.addedAt !== undefined && expense.addedAt > since && expense.date >= toDateStr(new Date(since))
  const stamp: number | true = counted ? Math.min(now, expense.addedAt!) : true
  const merchant = merchantKey(expense.note)
  const merchants = merchant && !bill.merchants?.includes(merchant) ? [...(bill.merchants ?? []), merchant] : bill.merchants
  return {
    key,
    state: {
      ...state,
      expenses: state.expenses.filter((e) => e.id !== expenseId),
      paid: { ...state.paid, [key]: state.paid[key] ?? stamp },
      bills: state.bills.map((b) => (b.id === billId ? { ...b, merchants } : b)),
    },
  }
}
