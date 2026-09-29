const whole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const cents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** `$1,210` for whole amounts, `$12.99` otherwise. */
export function money(n: number): string {
  const r = Math.round(n * 100) / 100
  return Number.isInteger(r) ? whole.format(r) : cents.format(r)
}

export function moneyWhole(n: number): string {
  return whole.format(Math.round(n))
}

export function pct(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 100)
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
