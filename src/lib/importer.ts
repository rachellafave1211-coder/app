import { toDateStr } from './dates'
import { round2 } from './format'
import { nearestOccurrence } from './budget'
import { merchantKey } from './expenses'
import type { Bill, Category, DateStr } from './types'

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

export interface ImportRow {
  date: DateStr
  name: string
  category: string
  amount: number
}

function parseAmount(s: string): number {
  const neg = /^\(.*\)$/.test(s.trim()) || s.trim().startsWith('-')
  const n = parseFloat(s.replace(/[^0-9.]/g, ''))
  if (!isFinite(n)) return NaN
  return neg ? -n : n
}

function parseAnyDate(s: string): DateStr | null {
  const t = s.trim()
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return toDateStr(new Date(+m[1], +m[2] - 1, +m[3]))
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]
    return toDateStr(new Date(y, +m[1] - 1, +m[2]))
  }
  const d = new Date(t)
  return isNaN(d.getTime()) ? null : toDateStr(d)
}

/**
 * Rows in the order date, name, category, amount. A header row is detected
 * and used to find columns in any order.
 */
export function rowsFromCsv(text: string): { rows: ImportRow[]; skipped: number } {
  const table = parseCsv(text)
  if (!table.length) return { rows: [], skipped: 0 }
  let cols = { date: 0, name: 1, category: 2, amount: 3 }
  const head = table[0].map((h) => h.trim().toLowerCase())
  const find = (...names: string[]) => head.findIndex((h) => names.some((n) => h.includes(n)))
  const hasHeader = find('date') >= 0 && find('amount', 'amt') >= 0
  if (hasHeader) {
    cols = {
      date: find('date'),
      name: find('name', 'description', 'note', 'merchant', 'payee'),
      category: find('category'),
      amount: find('amount', 'amt'),
    }
  }
  const rows: ImportRow[] = []
  let skipped = 0
  for (const r of table.slice(hasHeader ? 1 : 0)) {
    const date = parseAnyDate(r[cols.date] ?? '')
    const amount = parseAmount(r[cols.amount] ?? '')
    if (!date || !isFinite(amount) || amount === 0) {
      skipped++
      continue
    }
    rows.push({
      date,
      name: (cols.name >= 0 ? r[cols.name] : '')?.trim() ?? '',
      category: (cols.category >= 0 ? r[cols.category] : '')?.trim() ?? '',
      amount: round2(Math.abs(amount)),
    })
  }
  return { rows, skipped }
}

/** Google Sheets share link → CSV endpoint (the sheet must be shared "anyone with the link"). */
export function sheetsCsvUrl(url: string): string | null {
  const id = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1]
  if (!id) return null
  const gid = url.match(/[#&?]gid=(\d+)/)?.[1]
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ''}`
}

const KEYWORDS: Record<string, string[]> = {
  dining: ['restaurant', 'cafe', 'coffee', 'starbucks', 'doordash', 'uber eats', 'ubereats', 'grubhub', 'pizza', 'taco', 'sushi', 'bar ', 'chipotle', 'mcdonald', 'dining', 'lunch', 'dinner', 'brunch'],
  gas: ['shell', 'chevron', 'exxon', 'mobil', 'arco', '76 ', 'gas', 'fuel', 'bp '],
  groceries: ['grocery', 'groceries', 'safeway', 'trader joe', 'whole foods', 'kroger', 'costco', 'aldi', 'market', 'target', 'walmart'],
  entertainment: ['movie', 'cinema', 'amc', 'concert', 'ticket', 'steam', 'playstation', 'xbox', 'museum', 'bowling', 'entertainment'],
}

/** Best category for a transaction: its own label first, then merchant keywords. */
export function autoCategory(name: string, label: string, categories: Category[]): string {
  const norm = (s: string) => s.toLowerCase().trim()
  if (label) {
    const exact = categories.find((c) => norm(c.name) === norm(label))
    if (exact) return exact.id
    const loose = categories.find((c) => norm(c.name).includes(norm(label)) || norm(label).includes(norm(c.name)))
    if (loose) return loose.id
  }
  const text = ` ${norm(name)} ${norm(label)} `
  for (const c of categories) {
    if (text.includes(norm(c.name))) return c.id
    const kw = Object.entries(KEYWORDS).find(([k]) => norm(c.name).includes(k) || k.includes(norm(c.name).split(' ')[0]))
    if (kw && kw[1].some((w) => text.includes(w))) return c.id
  }
  return ''
}

/**
 * A bill this transaction pays: a merchant the person marked as paying it (any amount), or
 * names that overlap with the amount within 10%. Returns the occurrence key for the bill's
 * due month closest to the date.
 */
export function matchBill(row: ImportRow, bills: Bill[]): { bill: Bill; key: string } | null {
  const merchant = merchantKey(row.name)
  const learned = merchant ? bills.find((b) => b.merchants?.includes(merchant)) : undefined
  if (learned) return { bill: learned, key: nearestOccurrence(learned, row.date) }
  const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9& ]/g, ' ').split(/\s+/).filter((w) => w.length >= 3 || w === 'pg&e')
  const rowWords = new Set(words(`${row.name} ${row.category}`))
  for (const bill of bills) {
    const nameHit = words(bill.name).some((w) => rowWords.has(w)) || row.name.toLowerCase().includes(bill.name.toLowerCase())
    const close = Math.abs(row.amount - bill.amount) <= Math.max(1, bill.amount * 0.1)
    if (!nameHit || !close) continue
    // Paid near the due date: pick the due month whose due date is nearest.
    return { bill, key: nearestOccurrence(bill, row.date) }
  }
  return null
}
