import { describe, expect, it } from 'vitest'
import { billsDueBetween, occurrenceKey, planMonth } from './budget'
import { sampleState } from './seed'
import type { AppState } from './types'

const names = (s: AppState, month: string) => planMonth(s, month).plans.map((p) => p.bills.map((b) => b.bill.name))

describe('planMonth', () => {
  it('assigns each bill to the last paycheck on or before its due date', () => {
    const s = sampleState()
    expect(names(s, '2026-10')).toEqual([
      ['Rent', 'Gym'],
      ['Netflix', 'Credit card', 'Apple', 'Spotify'],
      ['Car insurance', 'ClassPass', 'WiFi', 'PG&E', 'Savings'],
    ])
  })

  it('computes left to budget as paycheck − bills − category budgets', () => {
    const plan = planMonth(sampleState(), '2026-10')
    // 1100 − (1210 + 118) − 500
    expect(plan.plans[0].left).toBe(-728)
    expect(plan.plans[1].left).toBeCloseTo(1100 - 533.97 - 500)
    expect(plan.income).toBe(3300)
  })

  it('assigns bills due before the first payday to the previous month’s last paycheck', () => {
    const s: AppState = { ...sampleState(), paychecks: [{ id: 'a', day: 5, amount: 2000 }, { id: 'b', day: 20, amount: 2000 }] }
    const [, second] = planMonth(s, '2026-10').plans
    // Rent (1st) and Gym (3rd) of November come out of Oct 20.
    const rent = second.bills.find((b) => b.bill.name === 'Rent')
    expect(rent?.due).toBe('2026-11-01')
    expect(planMonth(s, '2026-10').plans[0].bills.some((b) => b.bill.name === 'Rent')).toBe(false)
  })

  it('moves a shifted bill to the next paycheck, across months', () => {
    const s = sampleState()
    s.shifts = { [occurrenceKey('b-gym', '2026-10')]: 1, [occurrenceKey('b-savings', '2026-10')]: 1 }
    const oct = names(s, '2026-10')
    expect(oct[0]).toEqual(['Rent'])
    expect(oct[1]).toContain('Gym')
    expect(oct[2]).not.toContain('Savings')
    expect(names(s, '2026-11')[0]).toContain('Savings')
  })

  it('honors a pinned paycheck', () => {
    const s = sampleState()
    s.bills = s.bills.map((b) => (b.name === 'Rent' ? { ...b, pinnedPaycheckId: 'p3' } : b))
    expect(names(s, '2026-10')[2]).toContain('Rent')
    expect(names(s, '2026-10')[0]).not.toContain('Rent')
  })

  it('clamps day 31 to short months and tracks spending per window', () => {
    const s = sampleState()
    s.paychecks = [{ id: 'x', day: 31, amount: 500 }]
    s.expenses = [
      { id: 'e1', date: '2027-02-28', note: '', categoryId: 'c-gas', amount: 40 },
      { id: 'e2', date: '2027-03-30', note: '', categoryId: 'c-gas', amount: 10 },
    ]
    const feb = planMonth(s, '2027-02').plans[0]
    expect(feb.pay.date).toBe('2027-02-28')
    expect(feb.pay.end).toBe('2027-03-31')
    expect(feb.spentByCategory['c-gas']).toBe(50)
  })

  it('returns an empty plan with no paychecks', () => {
    const s = { ...sampleState(), paychecks: [] }
    expect(planMonth(s, '2026-10').plans).toEqual([])
  })
})

describe('billsDueBetween', () => {
  it('spans month boundaries', () => {
    const due = billsDueBetween(sampleState(), '2026-09-27', '2026-10-03')
    expect(due.map((b) => b.bill.name)).toEqual(['PG&E', 'Savings', 'Rent', 'Gym'])
    expect(due.find((b) => b.bill.name === 'Rent')?.key).toBe('b-rent@2026-10')
  })
})
