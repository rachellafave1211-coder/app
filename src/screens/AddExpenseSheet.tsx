import { useEffect, useRef, useState } from 'react'
import { today } from '../lib/dates'
import { money, round2, uid } from '../lib/format'
import { update, useStore } from '../lib/store'
import { AmountField, Button, Sheet, toast } from '../components/ui'

export function AddExpenseSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useStore()
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setAmount('')
    setNote('')
    setDate(today())
    setCategoryId((c) => c || state.categories[0]?.id || '')
    setTimeout(() => amountRef.current?.focus(), 250)
    // Reset only when the sheet opens.
  }, [open])

  const value = parseFloat(amount)
  const valid = isFinite(value) && value > 0

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    update((s) => ({ ...s, expenses: [...s.expenses, { id: uid(), date, note: note.trim(), categoryId, amount: round2(value), source: 'manual', addedAt: Date.now() }] }))
    toast(`Added ${money(round2(value))}`)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="New expense">
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
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input className="field" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" maxLength={80} />
          <input type="date" className="field w-40" value={date} onChange={(e) => setDate(e.target.value || today())} aria-label="Date" />
        </div>

        <Button type="submit" disabled={!valid} className="w-full py-4 text-lg">
          Add expense
        </Button>
      </form>
    </Sheet>
  )
}
