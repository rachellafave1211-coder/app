import { describe, expect, it } from 'vitest'
import { assignBill, assignExpense, balances, billsDueBetween, normalizeState, occurrenceKey, payKey, placeExpense, planMonth } from './budget'
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

  it('assigns a bill to a chosen paycheck and moves it back', () => {
    let s = sampleState()
    const [p1, p2] = planMonth(s, '2026-10').plans
    const gym = p1.bills.find((b) => b.bill.name === 'Gym')!
    expect(gym.moved).toBe(false)

    s = assignBill(s, gym.key, p2.pay, gym.original)
    let oct = planMonth(s, '2026-10')
    expect(oct.plans[0].bills.map((b) => b.bill.name)).toEqual(['Rent'])
    const moved = oct.plans[1].bills.find((b) => b.bill.name === 'Gym')!
    expect(moved.moved).toBe(true)
    expect(payKey(moved.original!)).toBe(payKey(p1.pay))
    // Totals follow the move: Paycheck 1 frees up $118, Paycheck 2 takes it on.
    expect(oct.plans[0].left).toBe(p1.left + 118)
    expect(oct.plans[1].left).toBeCloseTo(p2.left - 118)

    s = assignBill(s, gym.key, moved.original!, moved.original)
    oct = planMonth(s, '2026-10')
    expect(s.assign).toEqual({})
    expect(oct.plans[0].bills.find((b) => b.bill.name === 'Gym')?.moved).toBe(false)
  })

  it('assigns across a month boundary without losing the bill', () => {
    let s = sampleState()
    const savings = planMonth(s, '2026-10').plans[2].bills.find((b) => b.bill.name === 'Savings')!
    const nov1 = planMonth(s, '2026-11').plans[0].pay
    s = assignBill(s, savings.key, nov1, savings.original)
    expect(names(s, '2026-10')[2]).not.toContain('Savings')
    expect(names(s, '2026-11')[0]).toContain('Savings')
  })

  it('places every bill and expense under exactly one paycheck, however they are moved', () => {
    let s = sampleState()
    s.expenses = ['2026-09-30', '2026-10-01', '2026-10-09', '2026-10-10', '2026-10-31', '2026-11-05'].map((date, i) => ({
      id: `e${i}`, date, note: '', categoryId: 'c-gas', amount: i + 1,
    }))
    // Move things around: some forward, some back, some across months.
    const months = ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01']
    months.slice(1, 5).forEach((m, i) => {
      const plans = planMonth(s, m).plans
      for (const [j, p] of plans.entries()) {
        for (const b of p.bills) if ((b.bill.day + i + j) % 3 === 0) s = assignBill(s, b.key, plans[(j + 2) % plans.length].pay, b.original)
      }
    })
    const oct = planMonth(s, '2026-10').plans
    s = assignExpense(s, 'e1', oct[2].pay, oct[0].pay)
    s = assignExpense(s, 'e4', planMonth(s, '2026-11').plans[0].pay, oct[2].pay)

    const seenBills = new Map<string, number>()
    const seenExpenses = new Map<string, number>()
    for (const m of months) {
      for (const p of planMonth(s, m).plans) {
        for (const b of p.bills) seenBills.set(b.key, (seenBills.get(b.key) ?? 0) + 1)
        for (const e of p.expenses) seenExpenses.set(e.id, (seenExpenses.get(e.id) ?? 0) + 1)
      }
    }
    // Every occurrence due in the middle months shows exactly once.
    for (const m of months.slice(1, 5)) for (const bill of s.bills) expect(seenBills.get(occurrenceKey(bill.id, m))).toBe(1)
    for (const e of s.expenses) expect(seenExpenses.get(e.id)).toBe(1)
  })

  it('falls back to the automatic paycheck when the assigned one is deleted', () => {
    let s = sampleState()
    const [p1, , p3] = planMonth(s, '2026-10').plans
    const rent = p1.bills.find((b) => b.bill.name === 'Rent')!
    s = assignBill(s, rent.key, p3.pay, rent.original)
    s = { ...s, paychecks: s.paychecks.filter((p) => p.id !== 'p3') }
    expect(names(s, '2026-10')[0]).toContain('Rent')
  })

  it('moves an expense to another paycheck and back', () => {
    let s = sampleState()
    s.expenses = [{ id: 'x', date: '2026-10-03', note: '', categoryId: 'c-gas', amount: 40 }]
    const [p1, p2] = planMonth(s, '2026-10').plans
    s = assignExpense(s, 'x', p2.pay, p1.pay)
    let oct = planMonth(s, '2026-10').plans
    expect(oct[0].spent).toBe(0)
    expect(oct[1].spentByCategory['c-gas']).toBe(40)
    expect(placeExpense(s.paychecks, s.expenses[0])?.moved).toBe(true)
    s = assignExpense(s, 'x', p1.pay, p1.pay)
    oct = planMonth(s, '2026-10').plans
    expect(oct[0].spent).toBe(40)
    expect(s.expenses[0].paycheck).toBeUndefined()
  })

  it('turns old "N paychecks later" moves into assignments', () => {
    const old = { ...sampleState(), shifts: { [occurrenceKey('b-gym', '2026-10')]: 1, [occurrenceKey('b-savings', '2026-10')]: 1 } }
    const s = normalizeState(old as never)
    expect('shifts' in s).toBe(false)
    expect(names(s, '2026-10')[1]).toContain('Gym')
    expect(names(s, '2026-11')[0]).toContain('Savings')
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

describe('balances', () => {
  const at = (d: string, h = 12) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00`).getTime()
  const setup = (): AppState => ({
    ...sampleState(),
    accounts: { checking: { start: 1000, since: at('2026-10-02') }, savings: { start: 500, since: at('2026-10-02') } },
  })

  it('starts at the entered amounts and totals them', () => {
    expect(balances(setup(), at('2026-10-02', 13))).toEqual({ checking: 1000, savings: 500, total: 1500 })
  })

  it('adds paydays after the day the balance was set', () => {
    // Oct 10 pays; Oct 1 (before) and Oct 20 (future) do not.
    expect(balances(setup(), at('2026-10-12')).checking).toBe(2100)
  })

  it('subtracts expenses and paid bills logged after the balance was set', () => {
    const s = setup()
    s.expenses = [
      { id: 'a', date: '2026-10-03', note: '', categoryId: 'c-gas', amount: 40, addedAt: at('2026-10-03') },
      { id: 'b', date: '2026-10-02', note: '', categoryId: 'c-gas', amount: 99, addedAt: at('2026-10-02', 9) },
      { id: 'c', date: '2026-09-20', note: '', categoryId: 'c-gas', amount: 77, addedAt: at('2026-10-03') },
    ]
    s.paid = { 'b-gym@2026-10': at('2026-10-03'), 'b-rent@2026-10': at('2026-10-01'), 'b-wifi@2026-09': true }
    // Only the Oct 3 expense and the Gym payment count.
    expect(balances(s, at('2026-10-04')).checking).toBe(1000 - 40 - 118)
  })

  it('moves paid savings items from checking to savings', () => {
    const s = setup()
    s.paid = { 'b-savings@2026-10': at('2026-10-03') }
    expect(balances(s, at('2026-10-04'))).toEqual({ checking: 800, savings: 700, total: 1500 })
  })
})
