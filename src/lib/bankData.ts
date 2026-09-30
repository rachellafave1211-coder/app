import type { ImportRow } from './importer'

/** A transaction as the bank connection returns it (see supabase/functions/plaid). */
export interface BankTransaction {
  id: string
  date: string
  name: string
  /** Positive = money out. */
  amount: number
  pending: boolean
  /** Plaid's detailed category, e.g. FOOD_AND_DRINK_GROCERIES. */
  category: string
  account_id: string
}

export interface BankAccount {
  id: string
  name: string
  mask: string | null
  type: string
  subtype: string | null
  current: number | null
  available: number | null
}

/** Plaid categories → the names Payday's categories and keyword matching understand. */
const LABELS: [RegExp, string][] = [
  [/^FOOD_AND_DRINK_GROCERIES/, 'Groceries'],
  [/^FOOD_AND_DRINK/, 'Dining out'],
  [/^TRANSPORTATION_GAS/, 'Gas'],
  [/^ENTERTAINMENT/, 'Entertainment'],
]

export function categoryLabel(plaidCategory: string): string {
  const hit = LABELS.find(([re]) => re.test(plaidCategory))
  if (hit) return hit[1]
  // RENT_AND_UTILITIES_RENT → "Rent and utilities"
  const primary = plaidCategory.split('_').slice(0, 3).join(' ').toLowerCase()
  return primary ? primary[0].toUpperCase() + primary.slice(1) : ''
}

/**
 * Bank transactions ready for the import review: posted spending only. Pending charges come
 * in once they post; money coming in (paychecks, refunds) isn't spending.
 */
export function transactionsToRows(txns: BankTransaction[]): { rows: ImportRow[]; skipped: number } {
  const rows: ImportRow[] = []
  let skipped = 0
  for (const t of txns) {
    if (t.pending || !(t.amount > 0)) {
      skipped++
      continue
    }
    rows.push({ date: t.date, name: t.name, category: categoryLabel(t.category), amount: Math.round(t.amount * 100) / 100 })
  }
  rows.sort((a, b) => (a.date < b.date ? 1 : -1))
  return { rows, skipped }
}

/** Checking and savings totals from the bank's deposit accounts; null when there are none. */
export function balancesFromAccounts(accounts: BankAccount[]): { checking: number | null; savings: number | null } {
  const sumOf = (pick: (a: BankAccount) => boolean) => {
    const list = accounts.filter((a) => a.type === 'depository' && pick(a) && a.current !== null)
    return list.length ? Math.round(list.reduce((n, a) => n + a.current!, 0) * 100) / 100 : null
  }
  const isSavings = (a: BankAccount) => /savings|money market|cd|hsa/i.test(a.subtype ?? '')
  return { checking: sumOf((a) => !isSavings(a)), savings: sumOf(isSavings) }
}
