import { monthLabel } from './dates'
import { sum, type MonthPlan } from './budget'
import { pct } from './format'
import type { AppState } from './types'

export interface Recap {
  month: string
  stats: { value: string; label: string }[]
  headline: string
}

/** Month recap built from percentages only — never dollar amounts. */
export function buildRecap(state: AppState, plan: MonthPlan): Recap {
  const income = plan.income
  const bills = plan.plans.flatMap((p) => p.bills)
  const savings = sum(bills.filter((b) => b.bill.type === 'savings').map((b) => b.bill.amount))
  const paidCount = bills.filter((b) => b.paid).length
  const totalByCat: Record<string, number> = {}
  for (const p of plan.plans) for (const [k, v] of Object.entries(p.spentByCategory)) totalByCat[k] = (totalByCat[k] ?? 0) + v
  const top = Object.entries(totalByCat).sort((a, b) => b[1] - a[1])[0]
  const topCat = top && state.categories.find((c) => c.id === top[0])
  const catChecks = plan.plans.flatMap((p) => state.categories.map((c) => (p.spentByCategory[c.id] ?? 0) <= c.budget))
  const underPct = pct(catChecks.filter(Boolean).length, catChecks.length)
  const fundedPct = pct(plan.plans.filter((p) => p.left >= 0).length, plan.plans.length)

  const stats = [
    { value: `${pct(plan.billsTotal, income)}%`, label: 'of pay went to bills' },
    { value: `${pct(savings, income)}%`, label: 'of pay went to savings' },
    { value: `${pct(paidCount, bills.length)}%`, label: 'of bills checked off' },
    { value: `${underPct}%`, label: 'of budgets stayed on track' },
  ]
  const headline = topCat
    ? `${topCat.emoji} ${topCat.name} was ${pct(top[1], plan.spent)}% of my spending`
    : `${fundedPct}% of my paychecks were fully funded`
  return { month: monthLabel(plan.month), stats, headline }
}

export function recapText(r: Recap): string {
  return [`My Paycheck Wrapped — ${r.month} 💸`, r.headline, ...r.stats.map((s) => `${s.value} ${s.label}`), '', 'Budget by paycheck with Payday'].join('\n')
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Draw the recap as a 1080×1350 story card using the current theme tokens. */
export async function recapImage(r: Recap): Promise<Blob | null> {
  const css = getComputedStyle(document.documentElement)
  const tok = (n: string) => css.getPropertyValue(n).trim()
  const accent = tok('--accent') || '#d6457a'
  const onAccent = tok('--on-accent') || '#fff'
  await document.fonts?.ready

  const W = 1080
  const H = 1350
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = accent
  ctx.fillRect(0, 0, W, H)
  // Soft decorative rings.
  ctx.globalAlpha = 0.14
  ctx.strokeStyle = onAccent
  ctx.lineWidth = 70
  ctx.beginPath()
  ctx.arc(W - 120, 170, 260, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(80, H - 90, 200, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 1

  ctx.fillStyle = onAccent
  ctx.font = '600 34px "DM Sans", sans-serif'
  ctx.fillText('PAYCHECK WRAPPED', 90, 140)
  ctx.font = '600 92px Fraunces, Georgia, serif'
  ctx.fillText(r.month, 90, 250)
  ctx.font = '500 40px "DM Sans", sans-serif'
  wrap(ctx, r.headline, 90, 330, W - 180, 52)

  const cardY = 450
  r.stats.forEach((s, i) => {
    const y = cardY + i * 190
    ctx.globalAlpha = 0.16
    ctx.fillStyle = onAccent
    roundRect(ctx, 70, y, W - 140, 160, 40)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = onAccent
    ctx.font = '600 96px Fraunces, Georgia, serif'
    ctx.fillText(s.value, 120, y + 112)
    const vw = ctx.measureText(s.value).width
    ctx.font = '500 38px "DM Sans", sans-serif'
    ctx.fillText(s.label, 150 + vw, y + 100)
  })

  ctx.font = '700 40px Fraunces, Georgia, serif'
  ctx.fillText('Payday', 90, H - 80)
  ctx.font = '500 30px "DM Sans", sans-serif'
  ctx.globalAlpha = 0.85
  ctx.fillText('budget every paycheck', 250, H - 82)
  ctx.globalAlpha = 1

  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'))
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  let line = ''
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y)
      line = word
      y += lh
    } else line = test
  }
  ctx.fillText(line, x, y)
}

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed'

/** Native share sheet when available, otherwise copy to the clipboard. */
export async function shareOrCopy(opts: { title: string; text: string; url?: string; file?: File }): Promise<ShareResult> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  const data: ShareData = { title: opts.title, text: opts.text, url: opts.url }
  if (opts.file && nav.canShare?.({ files: [opts.file] })) data.files = [opts.file]
  if (nav.share) {
    try {
      await nav.share(data)
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
    }
  }
  return (await copy([opts.text, opts.url].filter(Boolean).join('\n'))) ? 'copied' : 'failed'
}

export async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}
