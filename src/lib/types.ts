export type Id = string
/** Local calendar date, `YYYY-MM-DD`. */
export type DateStr = string
/** Calendar month, `YYYY-MM`. */
export type MonthKey = string

export interface Paycheck {
  id: Id
  day: number
  amount: number
}

export type BillType = 'bill' | 'subscription' | 'savings' | 'debt'

export interface Bill {
  id: Id
  name: string
  day: number
  amount: number
  type: BillType
  /** Always pay this bill from this paycheck (in the bill's due month). */
  pinnedPaycheckId?: Id
  /** Household members who split this bill equally with you. */
  splitWith?: Id[]
}

export interface Category {
  id: Id
  name: string
  emoji: string
  /** Budget per paycheck. */
  budget: number
}

export interface Expense {
  id: Id
  date: DateStr
  note: string
  categoryId: Id | ''
  amount: number
  source?: 'manual' | 'import' | 'bank'
}

export interface Reminder {
  id: Id
  text: string
  date: DateStr
  done: boolean
}

export type ThemeMode = 'light' | 'dark' | 'auto'

export interface Theme {
  accent: string
  mode: ThemeMode
}

export interface Member {
  id: Id
  name: string
}

export interface Household {
  name: string
  members: Member[]
}

export interface AppState {
  version: 1
  paychecks: Paycheck[]
  bills: Bill[]
  categories: Category[]
  expenses: Expense[]
  reminders: Reminder[]
  theme: Theme
  /** Paid bill occurrences, keyed by `billId@YYYY-MM` (the due month). */
  paid: Record<string, true>
  /** Bill occurrences moved N paychecks later, keyed like `paid`. */
  shifts: Record<string, number>
  household: Household
  /** Split repayments received, keyed by `billId@YYYY-MM@memberId`. */
  settled: Record<string, true>
  notificationsOn: boolean
  /** Notifications already sent, so each fires once. */
  notified: Record<string, true>
}
