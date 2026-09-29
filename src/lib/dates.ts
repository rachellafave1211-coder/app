import type { DateStr, MonthKey } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}

export function monthKey(year: number, month0: number): MonthKey {
  const d = new Date(year, month0, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function parseMonth(key: MonthKey): { year: number; month0: number } {
  const [y, m] = key.split('-').map(Number)
  return { year: y, month0: m - 1 }
}

export function addMonths(key: MonthKey, n: number): MonthKey {
  const { year, month0 } = parseMonth(key)
  return monthKey(year, month0 + n)
}

/** The date for `day` in the month, clamped to the month's length (31 → Feb 28). */
export function dateInMonth(key: MonthKey, day: number): DateStr {
  const { year, month0 } = parseMonth(key)
  const d = Math.min(Math.max(1, day), daysInMonth(year, month0))
  return `${key}-${pad(d)}`
}

export function toDateStr(d: Date): DateStr {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function today(): DateStr {
  return toDateStr(new Date())
}

export function thisMonth(): MonthKey {
  return today().slice(0, 7)
}

export function parseDate(s: DateStr): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: DateStr, n: number): DateStr {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

export function daysBetween(a: DateStr, b: DateStr): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000)
}

export function monthLabel(key: MonthKey): string {
  const { year, month0 } = parseMonth(key)
  return new Date(year, month0, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function monthShort(key: MonthKey): string {
  const { year, month0 } = parseMonth(key)
  return new Date(year, month0, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

export function shortDate(s: DateStr): string {
  return parseDate(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function weekdayDate(s: DateStr): string {
  return parseDate(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
