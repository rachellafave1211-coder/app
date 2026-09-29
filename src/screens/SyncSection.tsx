import { useState } from 'react'
import { balances } from '../lib/budget'
import { money } from '../lib/format'
import { useStore } from '../lib/store'
import { resolveConflict, sendSignInLink, signOut, syncConfigured, syncSetupProblem, syncNow, useSync, verifyCode, type SyncStatus } from '../lib/sync'
import { fromSynced } from '../lib/syncCore'
import { Button, Pill, Sheet, toast } from '../components/ui'

const STATUS: Record<SyncStatus, { label: string; tone: 'good' | 'danger' | 'accent' | 'muted' }> = {
  off: { label: 'Not set up', tone: 'muted' },
  'signed-out': { label: 'Off', tone: 'muted' },
  syncing: { label: 'Syncing…', tone: 'accent' },
  synced: { label: 'Synced', tone: 'good' },
  offline: { label: 'Offline — will sync', tone: 'muted' },
  error: { label: 'Couldn’t sync', tone: 'danger' },
}

/** Settings panel: sign in to keep your budget and balances the same on every device. */
export function SyncPanel() {
  const sync = useSync()
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')

  if (!syncConfigured && syncSetupProblem) {
    return (
      <div className="space-y-2 text-sm">
        <p className="font-semibold text-danger">Sync is set up, but one of its settings looks wrong.</p>
        <p className="text-muted">{syncSetupProblem}</p>
        <p className="text-muted">Fix it in Vercel under Settings → Environment Variables, then redeploy. Your budget keeps working on this device in the meantime.</p>
      </div>
    )
  }

  if (!syncConfigured) {
    return (
      <p className="text-sm text-muted">
        Sync isn’t set up for this site yet. The site owner connects a Supabase project (see the README), and then you can sign in here. Your budget keeps working on this device in the meantime.
      </p>
    )
  }

  if (sync.status === 'signed-out') {
    return (
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          const err = await sendSignInLink(email.trim())
          setBusy(false)
          if (err) toast(`Couldn’t send the link: ${err}`)
          else setSentTo(email.trim())
        }}
      >
        <p className="text-sm text-muted">Sign in with your email to keep your budget and balances the same on your phone, tablet and computer. No password needed.</p>
        <input id="sync-email" type="email" required autoComplete="email" className="field" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
        <Button type="submit" className="w-full" disabled={busy || !email.includes('@')}>
          {busy ? 'Sending…' : 'Email me a sign-in link'}
        </Button>
        {sentTo && (
          <div className="space-y-2 rounded-2xl bg-accent-soft p-3" role="status">
            <p className="text-sm text-accent-text">Check {sentTo}. Open the link on this device, or enter the code from the email.</p>
            <div className="flex gap-2">
              <input
                id="sync-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="field bg-card"
                placeholder="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                aria-label="Sign-in code"
              />
              <Button
                type="button"
                className="shrink-0"
                disabled={busy || code.length < 6}
                onClick={async () => {
                  setBusy(true)
                  const err = await verifyCode(sentTo, code)
                  setBusy(false)
                  if (err) toast(`That code didn’t work: ${err}`)
                }}
              >
                Sign in
              </Button>
            </div>
          </div>
        )}
      </form>
    )
  }

  const s = STATUS[sync.status]
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{sync.email}</p>
          <p className="text-xs text-muted">{sync.lastSynced ? `Last synced ${new Date(sync.lastSynced).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Signed in'}</p>
        </div>
        <Pill tone={s.tone}>{s.label}</Pill>
      </div>
      {sync.status === 'error' && sync.error && <p className="text-sm text-danger">{sync.error}</p>}
      <p className="text-xs text-muted">Changes sync automatically, including your Checking and Savings balances. Alert settings stay on each device.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => void syncNow()}>
          Sync now
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            await signOut()
            toast('Signed out. Your budget stays on this device.')
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  )
}

/** Asks which copy to keep when this device and the account both have different data. */
export function ConflictSheet() {
  const sync = useSync()
  const local = useStore()
  const c = sync.conflict
  if (!c) return null
  const remote = fromSynced(local, c.remote.data)
  const here = balances(local)
  const there = balances(remote)
  const when = new Date(c.remote.updated_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  return (
    <Sheet open required onClose={() => {}} title="Which budget should we keep?">
      <p className="text-sm text-muted">
        {c.firstLink
          ? 'Your account already has a budget, and it’s different from the one on this device.'
          : 'This device and your account were both changed since they last synced.'}{' '}
        The one you don’t pick is replaced.
      </p>
      <div className="mt-4 grid gap-3">
        <Choice
          title="Keep my account’s budget"
          detail={`Saved ${when} · ${remote.expenses.length} expenses · ${remote.bills.length} bills`}
          totals={there}
          onPick={() => resolveConflict('account')}
        />
        <Choice
          title="Keep this device’s budget"
          detail={`${local.expenses.length} expenses · ${local.bills.length} bills`}
          totals={here}
          onPick={() => resolveConflict('device')}
        />
      </div>
    </Sheet>
  )
}

function Choice({ title, detail, totals, onPick }: { title: string; detail: string; totals: ReturnType<typeof balances>; onPick: () => void }) {
  return (
    <button onClick={onPick} className="press rounded-3xl border-2 border-line p-4 text-left hover:border-accent">
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-muted">{detail}</p>
      <p className="mt-2 text-sm">
        Checking <span className="num font-semibold">{money(totals.checking)}</span> · Savings <span className="num font-semibold">{money(totals.savings)}</span>
      </p>
    </button>
  )
}
