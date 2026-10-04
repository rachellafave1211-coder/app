import { describe, expect, it } from 'vitest'
import { balances } from './budget'
import { isUncategorized, learnedCategory, merchantKey, payBillWithExpense, sameMerchantUncategorized } from './expenses'
import { matchBill } from './importer'
import { sampleState } from './seed'
import type { AppState, Category, Expense } from './types'

const cats: Category[] = [
  { id: 'c-dining', name: 'Dining out', emoji: '🍜', budget: 100 },
  { id: 'c-groceries', name: 'Groceries', emoji: '🛒', budget: 200 },
]
const exp = (id: string, note: string, categoryId = '', addedAt = 0, date = '2026-10-01'): Expense => ({ id, note, categoryId, amount: 5, date, addedAt })

describe('merchantKey', () => {
  it('ignores store numbers, card prefixes, case and punctuation', () => {
    expect(merchantKey('SQ *BLUE BOTTLE #1234')).toBe('blue bottle')
    expect(merchantKey('Blue Bottle')).toBe('blue bottle')
    expect(merchantKey('TRADER JOE’S 552')).toBe('trader joe s')
    expect(merchantKey('1234')).toBe('')
  })
})

describe('learnedCategory', () => {
  it('uses the category last chosen for the same merchant', () => {
    const expenses = [exp('1', 'BLUE BOTTLE 1', 'c-groceries', 1), exp('2', 'Blue Bottle', 'c-dining', 2), exp('3', 'Blue bottle #9', '', 3)]
    expect(learnedCategory('SQ *BLUE BOTTLE #77', expenses, cats)).toBe('c-dining')
  })
  it('skips deleted categories and unknown merchants', () => {
    expect(learnedCategory('Blue Bottle', [exp('1', 'Blue Bottle', 'c-gone', 5)], cats)).toBe('')
    expect(learnedCategory('Mystery', [exp('1', 'Blue Bottle', 'c-dining', 5)], cats)).toBe('')
    expect(learnedCategory('', [exp('1', '', 'c-dining', 5)], cats)).toBe('')
  })
})

describe('sameMerchantUncategorized', () => {
  it('finds the other uncategorized charges from the same merchant', () => {
    const expenses = [exp('1', 'Blue Bottle'), exp('2', 'BLUE BOTTLE #2'), exp('3', 'Blue Bottle', 'c-dining'), exp('4', 'Blue Bottle', 'c-gone'), exp('5', 'Chevron')]
    expect(sameMerchantUncategorized(expenses[0], expenses, cats).map((e) => e.id)).toEqual(['2', '4'])
    expect(isUncategorized(expenses[3], cats)).toBe(true)
    expect(isUncategorized(expenses[2], cats)).toBe(false)
  })
})

describe('payBillWithExpense', () => {
  const base = (): AppState => {
    const s = sampleState()
    return {
      ...s,
      accounts: { checking: { start: 1000, since: Date.parse('2026-10-01T12:00:00') }, savings: { start: 0, since: Date.parse('2026-10-01T12:00:00') } },
      bills: [{ id: 'b-phone', name: 'Phone', day: 15, amount: 60, type: 'bill' }],
      paid: {},
      expenses: [{ id: 'x', date: '2026-10-14', note: 'VZW WIRELESS #88', categoryId: '', amount: 60, source: 'bank', addedAt: Date.parse('2026-10-14T09:00:00') }],
    }
  }
  const now = Date.parse('2026-10-20T12:00:00')

  it('checks off the nearest occurrence, removes the expense and keeps the balance the same', () => {
    const before = base()
    const res = payBillWithExpense(before, 'x', 'b-phone', now)!
    expect(res.key).toBe('b-phone@2026-10')
    expect(res.state.expenses).toHaveLength(0)
    expect(res.state.paid['b-phone@2026-10']).toBe(Date.parse('2026-10-14T09:00:00'))
    expect(res.state.bills[0].merchants).toEqual(['vzw wireless'])
    expect(balances(res.state, now).checking).toBe(balances(before, now).checking)
  })

  it('does not move the balance for a charge from before Checking was set', () => {
    const before = base()
    before.expenses[0] = { ...before.expenses[0], date: '2026-09-30', addedAt: Date.parse('2026-09-30T09:00:00') }
    const res = payBillWithExpense(before, 'x', 'b-phone', now)!
    expect(res.key).toBe('b-phone@2026-09')
    expect(res.state.paid['b-phone@2026-09']).toBe(true)
    expect(balances(res.state, now).checking).toBe(balances(before, now).checking)
  })

  it('fills the nearest month that is still unpaid', () => {
    const before = { ...base(), paid: { 'b-phone@2026-10': Date.parse('2026-10-02T09:00:00') } }
    before.expenses[0] = { ...before.expenses[0], date: '2026-10-20' }
    expect(payBillWithExpense(before, 'x', 'b-phone', now)!.key).toBe('b-phone@2026-11')
  })

  it('makes later imports from that merchant pay the bill, whatever the amount', () => {
    const { state } = payBillWithExpense(base(), 'x', 'b-phone', now)!
    expect(matchBill({ date: '2026-11-14', name: 'VZW WIRELESS #91', category: '', amount: 72.4 }, state.bills)?.key).toBe('b-phone@2026-11')
    expect(matchBill({ date: '2026-11-14', name: 'Coffee', category: '', amount: 60 }, state.bills)).toBeNull()
  })
})
