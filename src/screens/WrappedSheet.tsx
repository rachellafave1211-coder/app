import { useMemo, useState } from 'react'
import type { MonthPlan } from '../lib/budget'
import { buildRecap, recapImage, recapText, shareOrCopy } from '../lib/share'
import { useStore } from '../lib/store'
import { IconShare } from '../components/icons'
import { Button, Sheet, toast } from '../components/ui'

/** "Paycheck Wrapped" — a themed, percentages-only recap card. */
export function WrappedSheet({ open, onClose, plan }: { open: boolean; onClose: () => void; plan: MonthPlan }) {
  const state = useStore()
  const recap = useMemo(() => buildRecap(state, plan), [state, plan])
  const [busy, setBusy] = useState(false)

  async function share() {
    setBusy(true)
    try {
      const blob = await recapImage(recap)
      const file = blob ? new File([blob], 'paycheck-wrapped.png', { type: 'image/png' }) : undefined
      const res = await shareOrCopy({ title: 'My Paycheck Wrapped', text: recapText(recap), file })
      if (res === 'copied') toast('Recap copied — paste it anywhere')
      if (res === 'failed') toast('Couldn’t share on this device')
    } finally {
      setBusy(false)
    }
  }

  async function download() {
    const blob = await recapImage(recap)
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'paycheck-wrapped.png'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Paycheck Wrapped">
      <div className="relative overflow-hidden rounded-[28px] bg-accent p-6 text-on-accent">
        <div className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full border-[32px] border-on-accent/12" />
        <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-90">Paycheck Wrapped</p>
        <p className="mt-1 font-serif text-3xl font-semibold">{recap.month}</p>
        <p className="mt-2 font-medium opacity-95">{recap.headline}</p>
        <ul className="mt-5 space-y-2.5">
          {recap.stats.map((s) => (
            <li key={s.label} className="grid grid-cols-[5.5rem_1fr] items-center gap-2 rounded-2xl bg-on-accent/15 px-4 py-3">
              <span className="num text-3xl font-semibold">{s.value}</span>
              <span className="text-sm font-medium">{s.label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 font-serif text-lg font-semibold">
          Payday <span className="font-sans text-sm font-medium opacity-85">budget every paycheck</span>
        </p>
      </div>
      <p className="mt-3 text-center text-xs text-muted">Only percentages are shared. Your card uses your theme color.</p>
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <Button onClick={share} disabled={busy}>
          <IconShare size={20} /> {busy ? 'Preparing…' : 'Share'}
        </Button>
        <Button variant="ghost" onClick={download}>
          Save image
        </Button>
      </div>
    </Sheet>
  )
}
