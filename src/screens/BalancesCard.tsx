import { useEffect, useRef, useState } from 'react'
import { balances } from '../lib/budget'
import { money, round2 } from '../lib/format'
import { setBalance, useStore } from '../lib/store'
import { AmountField, Button, Sheet, toast } from '../components/ui'

type Account = 'checking' | 'savings'
const LABEL: Record<Account, string> = { checking: 'Checking', savings: 'Savings' }

/** Running Checking, Savings and Total balances. Tap an account to set it. */
export function BalancesCard() {
  const state = useStore()
  const b = balances(state)
  const [editing, setEditing] = useState<Account | null>(null)

  return (
    <section className="card grid grid-cols-3 gap-1 p-1.5" aria-label="Account balances">
      {(['checking', 'savings'] as const).map((a) => (
        <button key={a} onClick={() => setEditing(a)} className="press rounded-[18px] px-2 py-3 text-center hover:bg-sunken" aria-label={`${LABEL[a]} ${money(b[a])}. Set balance`}>
          <span className="block text-[11px] font-semibold tracking-wide text-muted uppercase">{LABEL[a]}</span>
          <span className={`num block text-xl font-semibold ${b[a] < 0 ? 'text-danger' : ''}`}>{money(b[a])}</span>
        </button>
      ))}
      <div className="px-2 py-3 text-center">
        <span className="block text-[11px] font-semibold tracking-wide text-muted uppercase">Total</span>
        <span className={`num block text-xl font-semibold ${b.total < 0 ? 'text-danger' : 'text-accent-text'}`}>{money(b.total)}</span>
      </div>
      <BalanceSheet account={editing} current={editing ? b[editing] : 0} onClose={() => setEditing(null)} />
    </section>
  )
}

function BalanceSheet({ account, current, onClose }: { account: Account | null; current: number; onClose: () => void }) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!account) return
    setText(String(current))
    setTimeout(() => ref.current?.select(), 250)
    // Prefill only when the sheet opens.
  }, [account])

  const value = parseFloat(text)
  const valid = isFinite(value)

  return (
    <Sheet open={!!account} onClose={onClose} title={account ? `${LABEL[account]} balance` : ''}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!account || !valid) return
          setBalance(account, round2(value))
          toast(`${LABEL[account]} set to ${money(round2(value))}`)
          onClose()
        }}
      >
        <AmountField inputRef={ref} value={text} onChange={setText} label={`${account ? LABEL[account] : ''} balance`} allowNegative />
        <p className="text-sm text-muted">
          {account === 'checking'
            ? 'Enter what’s in checking right now. It goes up each payday, and down when you log an expense or check off a bill.'
            : 'Enter what’s in savings right now. Checking off a savings item moves that amount here from checking.'}
        </p>
        <Button type="submit" disabled={!valid} className="w-full py-4 text-lg">
          Save balance
        </Button>
      </form>
    </Sheet>
  )
}
