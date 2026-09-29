import { useEffect, useState } from 'react'
import { autoCategory, matchBill, type ImportRow } from '../lib/importer'
import { parseDate, shortDate } from '../lib/dates'
import { money, uid } from '../lib/format'
import { update, useStore } from '../lib/store'
import { Button, Sheet, toast } from '../components/ui'

interface Draft extends ImportRow {
  key: string
  categoryId: string
  /** Occurrence key of a bill this transaction pays, if matched. */
  billKey: string | null
  billName: string
  include: boolean
}

/** Review imported transactions: auto-categorized, editable, and matched to bills. */
export function ImportSheet({ rows, skipped, onClose }: { rows: ImportRow[] | null; skipped: number; onClose: () => void }) {
  const state = useStore()
  const [drafts, setDrafts] = useState<Draft[]>([])

  useEffect(() => {
    if (!rows) return
    const existing = new Set(state.expenses.map((e) => `${e.date}|${e.amount}|${e.note}`))
    setDrafts(
      rows.map((r, i) => {
        const match = matchBill(r, state.bills)
        return {
          ...r,
          key: String(i),
          categoryId: autoCategory(r.name, r.category, state.categories),
          billKey: match?.key ?? null,
          billName: match?.bill.name ?? '',
          include: !existing.has(`${r.date}|${r.amount}|${r.name}`),
        }
      }),
    )
    // Build drafts once per import.
  }, [rows])

  const set = (key: string, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)))
  const chosen = drafts.filter((d) => d.include)
  const billCount = chosen.filter((d) => d.billKey).length

  function confirm() {
    const now = Date.now()
    update((s) => {
      const paid = { ...s.paid }
      const expenses = [...s.expenses]
      for (const d of chosen) {
        // Stamp bill payments with the transaction's day so older payments don't move today's balance.
        if (d.billKey) paid[d.billKey] = Math.min(now, parseDate(d.date).getTime() + 86_399_999)
        else expenses.push({ id: uid(), date: d.date, note: d.name, categoryId: d.categoryId, amount: d.amount, source: 'import', addedAt: now })
      }
      return { ...s, paid, expenses }
    })
    toast(`Imported ${chosen.length - billCount} expenses${billCount ? `, checked off ${billCount} bills` : ''}`)
    onClose()
  }

  return (
    <Sheet open={!!rows} onClose={onClose} title="Review import">
      <p className="text-sm text-muted">
        {drafts.length} transactions{skipped ? ` · ${skipped} rows skipped` : ''}. Categories were guessed — tap to change. Bill payments check off the matching bill instead of counting as spending.
      </p>
      <ul className="mt-4 divide-y divide-line">
        {drafts.map((d) => (
          <li key={d.key} className={`py-3 ${d.include ? '' : 'opacity-45'}`}>
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={d.include} onChange={(e) => set(d.key, { include: e.target.checked })} className="size-5 accent-[var(--accent)]" aria-label={`Include ${d.name}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.name || 'Transaction'}</p>
                <p className="text-xs text-muted">{shortDate(d.date)}</p>
              </div>
              <span className="num font-semibold">{money(d.amount)}</span>
            </div>
            <div className="mt-2 flex items-center gap-2 pl-8">
              {d.billKey ? (
                <>
                  <span className="rounded-full bg-good/15 px-2.5 py-1 text-xs font-semibold text-good">✓ Pays {d.billName}</span>
                  <button className="text-xs font-semibold text-muted underline" onClick={() => set(d.key, { billKey: null })}>
                    Not a bill
                  </button>
                </>
              ) : (
                <select className="field py-1.5 text-sm" value={d.categoryId} onChange={(e) => set(d.key, { categoryId: e.target.value })} aria-label={`Category for ${d.name}`}>
                  <option value="">Uncategorized</option>
                  {state.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Button className="mt-4 w-full py-4" disabled={!chosen.length} onClick={confirm}>
        Import {chosen.length}
      </Button>
    </Sheet>
  )
}
