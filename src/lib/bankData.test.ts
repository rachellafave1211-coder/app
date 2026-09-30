import { describe, expect, it } from 'vitest'
import { balancesFromAccounts, categoryLabel, transactionsToRows, type BankAccount, type BankTransaction } from './bankData'
import { autoCategory } from './importer'
import { sampleState } from './seed'

const t = (id: string, amount: number, category: string, extra: Partial<BankTransaction> = {}): BankTransaction => ({
  id, date: '2026-10-02', name: id, amount, pending: false, category, account_id: 'a', ...extra,
})

describe('bank data', () => {
  it('names Plaid categories the way Payday categories are named', () => {
    const cats = sampleState().categories
    expect(autoCategory('Trader Joe’s', categoryLabel('FOOD_AND_DRINK_GROCERIES'), cats)).toBe('c-groceries')
    expect(autoCategory('Blue Bottle', categoryLabel('FOOD_AND_DRINK_COFFEE'), cats)).toBe('c-dining')
    expect(autoCategory('Chevron', categoryLabel('TRANSPORTATION_GAS'), cats)).toBe('c-gas')
    expect(autoCategory('AMC', categoryLabel('ENTERTAINMENT_TV_AND_MOVIES'), cats)).toBe('c-fun')
    expect(categoryLabel('RENT_AND_UTILITIES_RENT')).toBe('Rent and utilities')
    expect(categoryLabel('')).toBe('')
  })

  it('imports posted spending only', () => {
    const { rows, skipped } = transactionsToRows([
      t('Groceries', 54.2, 'FOOD_AND_DRINK_GROCERIES', { date: '2026-10-01' }),
      t('Paycheck', -1100, 'INCOME_WAGES'),
      t('Pending coffee', 5, 'FOOD_AND_DRINK_COFFEE', { pending: true }),
      t('Netflix', 10, 'ENTERTAINMENT_TV_AND_MOVIES', { date: '2026-10-03' }),
    ])
    expect(rows).toEqual([
      { date: '2026-10-03', name: 'Netflix', category: 'Entertainment', amount: 10 },
      { date: '2026-10-01', name: 'Groceries', category: 'Groceries', amount: 54.2 },
    ])
    expect(skipped).toBe(2)
  })

  it('adds up checking and savings from deposit accounts', () => {
    const acct = (subtype: string, current: number | null, type = 'depository'): BankAccount => ({ id: subtype, name: subtype, mask: null, type, subtype, current, available: null })
    expect(balancesFromAccounts([acct('checking', 1320.5), acct('savings', 3000), acct('money market', 200.25), acct('credit card', -500, 'credit')])).toEqual({ checking: 1320.5, savings: 3200.25 })
    expect(balancesFromAccounts([acct('credit card', 100, 'credit')])).toEqual({ checking: null, savings: null })
  })
})
