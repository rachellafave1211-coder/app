import type { AppState, Bill, BillType } from './types'

export const DEFAULT_ACCENT = '#d6457a'

const bill = (id: string, name: string, day: number, amount: number, type: BillType): Bill => ({ id, name, day, amount, type })

export function sampleState(): AppState {
  return {
    ...emptyState(),
    paychecks: [
      { id: 'p1', day: 1, amount: 1100 },
      { id: 'p2', day: 10, amount: 1100 },
      { id: 'p3', day: 20, amount: 1100 },
    ],
    bills: [
      bill('b-rent', 'Rent', 1, 1210, 'bill'),
      bill('b-gym', 'Gym', 3, 118, 'subscription'),
      bill('b-netflix', 'Netflix', 12, 10, 'subscription'),
      bill('b-cc', 'Credit card', 15, 500, 'debt'),
      bill('b-spotify', 'Spotify', 16, 12.99, 'subscription'),
      bill('b-apple', 'Apple', 16, 10.98, 'subscription'),
      bill('b-car', 'Car insurance', 21, 115, 'bill'),
      bill('b-classpass', 'ClassPass', 23, 35, 'subscription'),
      bill('b-wifi', 'WiFi', 25, 25, 'bill'),
      bill('b-pge', 'PG&E', 28, 100, 'bill'),
      bill('b-savings', 'Savings', 28, 200, 'savings'),
    ],
    accounts: { checking: { start: 1850, since: Date.now() }, savings: { start: 3200, since: Date.now() } },
    categories: [
      { id: 'c-dining', name: 'Dining out', emoji: '🍜', budget: 200 },
      { id: 'c-gas', name: 'Gas', emoji: '⛽', budget: 100 },
      { id: 'c-groceries', name: 'Groceries', emoji: '🛒', budget: 100 },
      { id: 'c-fun', name: 'Entertainment', emoji: '🎬', budget: 100 },
    ],
  }
}

export function emptyState(): AppState {
  return {
    version: 1,
    paychecks: [],
    bills: [],
    categories: [],
    expenses: [],
    reminders: [],
    theme: { accent: DEFAULT_ACCENT, mode: 'auto' },
    paid: {},
    accounts: { checking: { start: 0, since: Date.now() }, savings: { start: 0, since: Date.now() } },
    assign: {},
    tasks: [],
    household: { name: 'Our place', members: [] },
    settled: {},
    notificationsOn: false,
    notified: {},
  }
}
