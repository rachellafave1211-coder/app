import { describe, expect, it } from 'vitest'
import { isUncategorized, learnedCategory, merchantKey, sameMerchantUncategorized } from './expenses'
import type { Category, Expense } from './types'

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
