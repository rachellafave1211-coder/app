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

/** The four types every budget has. Savings items move money from Checking to Savings when paid. */
export type BuiltInBillType = 'bill' | 'subscription' | 'savings' | 'debt'

/** A bill type someone added, e.g. "Insurance". Bills of this type work like regular bills. */
export interface CustomBillType {
  id: Id
  name: string
}

export interface Bill {
  id: Id
  name: string
  day: number
  amount: number
  /** A built-in type, or the id of a custom type. */
  type: BuiltInBillType | Id
  /** Always pay from this paycheck (the last one before the due date). Unset means automatic. */
  paycheckId?: Id
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
  /** When it was logged (ms). Balances only count expenses logged after the balance was set. */
  addedAt?: number
  /** Paycheck it was moved to (`paycheckId@YYYY-MM`). Unset means the paycheck its date falls in. */
  paycheck?: string
}

export interface Task {
  id: Id
  title: string
  due?: DateStr
  done: boolean
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

/** A balance you entered, and when (ms). Later activity moves it from there. */
export interface Balance {
  start: number
  since: number
}

export interface AppState {
  version: 1
  paychecks: Paycheck[]
  bills: Bill[]
  categories: Category[]
  expenses: Expense[]
  reminders: Reminder[]
  theme: Theme
  /** Paid bill occurrences, keyed by `billId@YYYY-MM` (the due month), with when they were paid (ms). */
  paid: Record<string, number | true>
  /** Bill occurrences moved to another paycheck: occurrence key → `paycheckId@YYYY-MM`. */
  assign: Record<string, string>
  tasks: Task[]
  billTypes: CustomBillType[]
  household: Household
  /** Split repayments received, keyed by `billId@YYYY-MM@memberId`. */
  settled: Record<string, true>
  accounts: { checking: Balance; savings: Balance }
  notificationsOn: boolean
  /** Notifications already sent, so each fires once. */
  notified: Record<string, true>
}
