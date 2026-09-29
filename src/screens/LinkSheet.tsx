import { useState } from 'react'
import { applyTemplate, type LinkPayload } from '../lib/links'
import { money, round2, uid } from '../lib/format'
import { ordinal } from '../lib/dates'
import { update } from '../lib/store'
import { Button, Sheet, toast } from '../components/ui'

const TITLES = { theme: 'A shared theme', template: 'A shared budget', household: 'You’re invited' }

/** Confirm before applying anything that arrived in a shared link. */
export function LinkSheet({ payload, onClose }: { payload: LinkPayload | null; onClose: () => void }) {
  const [addShares, setAddShares] = useState(true)
  if (!payload) return null

  function apply() {
    if (!payload) return
    if (payload.kind === 'theme') {
      update((s) => ({ ...s, theme: payload.theme }))
      toast('Theme applied')
    } else if (payload.kind === 'template') {
      update((s) => applyTemplate(s, payload))
      toast('Template applied')
    } else {
      const inviter = { id: uid(), name: payload.from }
      const ways = payload.household.members.length + 1
      update((s) => ({
        ...s,
        household: { name: payload.household.name, members: [inviter] },
        bills: addShares
          ? [...s.bills, ...payload.splits.map((b) => ({ id: uid(), name: `${b.name} (my share)`, day: b.day, amount: round2(b.amount / ways), type: 'bill' as const }))]
          : s.bills,
      }))
      toast(`Joined ${payload.household.name}`)
    }
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title={TITLES[payload.kind]}>
      {payload.kind === 'theme' && (
        <div className="flex items-center gap-4">
          <span className="size-16 rounded-3xl" style={{ background: payload.theme.accent }} />
          <p className="text-muted">
            Accent <span className="font-mono text-ink">{payload.theme.accent}</span> · {payload.theme.mode} mode
          </p>
        </div>
      )}
      {payload.kind === 'template' && (
        <div className="space-y-2 text-sm">
          <p className="text-muted">This replaces your paychecks, categories and bills. Expenses and reminders are kept.</p>
          <p>
            <strong>Paychecks:</strong> {payload.paychecks.map((p) => ordinal(p.day) + (p.amount ? ` (${money(p.amount)})` : '')).join(', ') || 'none'}
          </p>
          <p>
            <strong>Categories:</strong> {payload.categories.map((c) => `${c.emoji} ${c.name}`).join(', ') || 'none'}
          </p>
          <p>
            <strong>Bills:</strong> {payload.bills.map((b) => b.name).join(', ') || 'none'}
          </p>
        </div>
      )}
      {payload.kind === 'household' && (
        <div className="space-y-3">
          <p>
            <strong>{payload.from}</strong> invited you to <strong>{payload.household.name}</strong>.
          </p>
          {payload.splits.length > 0 && (
            <label className="flex items-start gap-3 rounded-2xl bg-sunken p-3 text-sm">
              <input type="checkbox" checked={addShares} onChange={(e) => setAddShares(e.target.checked)} className="mt-0.5 size-5 accent-[var(--accent)]" />
              <span>
                Add my share of {payload.splits.map((b) => `${b.name} (${money(round2(b.amount / (payload.household.members.length + 1)))})`).join(', ')} to my bills
              </span>
            </label>
          )}
        </div>
      )}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={onClose}>
          Not now
        </Button>
        <Button onClick={apply}>{payload.kind === 'household' ? 'Join' : 'Apply'}</Button>
      </div>
    </Sheet>
  )
}
