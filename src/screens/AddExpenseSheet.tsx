import { useEffect, useRef, useState } from 'react'
import { categoryById } from '../lib/budget'
import { today } from '../lib/dates'
import { sameMerchantUncategorized } from '../lib/expenses'
import { money, round2, uid } from '../lib/format'
import { update, useStore } from '../lib/store'
import type { Expense } from '../lib/types'
import { AmountField, Button, Sheet, toast } from '../components/ui'

/** Logs a new expense, or edits `expense` when one is given. */
export function AddExpenseSheet({ open, onClose, expense }: { open: boolean; onClose: () => void; expense?: Expense | null }) {
  const state = useStore()
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  const [applyToSame, setApplyToSame] = useState(true)
  const amountRef = useRef<HTMLInputElement>(null)
  const editing = !!expense

  useEffect(() => {
    if (!open) return
    if (expense) {
      setAmount(expense.amount.toFixed(2))
      setNote(expense.note)
      setDate(expense.date)
      setCategoryId(categoryById(state.categories, expense.categoryId) ? expense.categoryId : '')
      setApplyToSame(true)
      return
    }
    setAmount('')
    setNote('')
    setDate(today())
    setCategoryId((c) => c || state.categories[0]?.id || '')
    setTimeout(() => amountRef.current?.focus(), 250)
    // Reset only when the sheet opens.
  }, [open, expense])

  const value = parseFloat(amount)
  const valid = isFinite(value) && value > 0
  // When an uncategorized charge gets a category, offer the same for its other charges from that merchant.
  const same = expense && categoryId ? sameMerchantUncategorized({ id: expense.id, note: note.trim() || expense.note }, state.expenses, state.categories) : []
  const category = categoryById(state.categories, categoryId)

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    if (expense) {
      const others = new Set(applyToSame ? same.map((x) => x.id) : [])
      update((s) => ({
        ...s,
        expenses: s.expenses.map((x) =>
          x.id === expense.id ? { ...x, date, note: note.trim(), categoryId, amount: round2(value) } : others.has(x.id) ? { ...x, categoryId } : x,
        ),
      }))
      toast(others.size ? `Saved, and moved ${others.size} more to ${category?.name}` : 'Saved')
    } else {
      update((s) => ({ ...s, expenses: [...s.expenses, { id: uid(), date, note: note.trim(), categoryId, amount: round2(value), source: 'manual', addedAt: Date.now() }] }))
      toast(`Added ${money(round2(value))}`)
    }
    onClose()
  }

  function remove() {
    if (!expense) return
    update((s) => ({ ...s, expenses: s.expenses.filter((x) => x.id !== expense.id) }))
    toast('Expense deleted')
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit expense' : 'New expense'}>
      <form onSubmit={save} className="space-y-5">
        <AmountField inputRef={amountRef} value={amount} onChange={setAmount} label="Amount" />

        <div>
          <p className="mb-2 text-sm font-semibold text-muted">Category</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
            {state.categories.map((c) => (
              <button
                type="button"
                key={c.id}
                role="radio"
                aria-checked={categoryId === c.id}
                onClick={() => setCategoryId(c.id)}
                className={`press rounded-full px-4 py-2 text-sm font-semibold ${categoryId === c.id ? 'bg-accent text-on-accent' : 'bg-sunken text-ink'}`}
              >
                <span aria-hidden="true">{c.emoji}</span> {c.name}
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={categoryId === ''}
              onClick={() => setCategoryId('')}
              className={`press rounded-full px-4 py-2 text-sm font-semibold ${categoryId === '' ? 'bg-accent text-on-accent' : 'bg-sunken text-muted'}`}
            >
              Other
            </button>
          </div>
          {same.length > 0 && category && (
            <label className="mt-3 flex items-start gap-3 rounded-2xl bg-accent-soft p-3 text-sm">
              <input type="checkbox" checked={applyToSame} onChange={(e) => setApplyToSame(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
              <span>
                Also move {same.length === 1 ? 'the other uncategorized charge' : `the other ${same.length} uncategorized charges`} from{' '}
                <strong>{note.trim() || expense?.note}</strong> to {category.name}
              </span>
            </label>
          )}
          {editing && <p className="mt-2 text-xs text-muted">Future imports from this merchant will use the category you pick.</p>}
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input className="field" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" maxLength={80} />
          <input type="date" className="field w-40" value={date} onChange={(e) => setDate(e.target.value || today())} aria-label="Date" />
        </div>

        <Button type="submit" disabled={!valid} className="w-full py-4 text-lg">
          {editing ? 'Save changes' : 'Add expense'}
        </Button>
        {editing && (
          <Button type="button" variant="ghost" className="w-full text-danger" onClick={remove}>
            Delete expense
          </Button>
        )}
      </form>
    </Sheet>
  )
}
