import type { Category, Expense } from './types'

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
