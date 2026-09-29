import { useEffect, useRef, useState, type ReactNode } from 'react'
import { sortedPaychecks } from '../lib/budget'
import { ordinal } from '../lib/dates'
import { uid } from '../lib/format'
import { rowsFromCsv, sheetsCsvUrl, type ImportRow } from '../lib/importer'
import { householdLink, templateLink, themeLink } from '../lib/links'
import { emptyState, sampleState } from '../lib/seed'
import { copy, shareOrCopy } from '../lib/share'
import { getState, replaceState, update, useStore } from '../lib/store'
import { PRESETS } from '../lib/theme'
import type { Bill, BillType, ThemeMode } from '../lib/types'
import { IconBank, IconCheck, IconLink, IconPlus, IconTrash, IconUpload, IconUsers } from '../components/icons'
import { Button, Pill, Segmented, toast } from '../components/ui'
import { ImportSheet } from './ImportSheet'
import { TYPE_LABEL } from './BudgetScreen'

export function SettingsScreen() {
  const state = useStore()
  return (
    <div>
      <header className="px-1 pb-3">
        <h1 className="font-serif text-[28px] font-semibold tracking-tight">Settings</h1>
      </header>
      <div className="space-y-3">
        <ThemeSection />
        <Section title="Paychecks" subtitle={`${state.paychecks.length} per month`}>
          <PaychecksEditor />
        </Section>
        <Section title="Category budgets" subtitle="Per paycheck">
          <CategoriesEditor />
        </Section>
        <Section title="Bills" subtitle={`${state.bills.length} recurring monthly`}>
          <BillsEditor />
        </Section>
        <Section title="Shared budget" subtitle="Roommates & partners" icon={<IconUsers size={20} />}>
          <HouseholdEditor />
        </Section>
        <Section title="Import expenses" subtitle="CSV or Google Sheets" icon={<IconUpload size={20} />}>
          <ImportPanel />
        </Section>
        <BankCard />
        <Section title="Share a budget template" subtitle="A link friends can copy" icon={<IconLink size={20} />}>
          <TemplateShare />
        </Section>
        <Section title="Your data" subtitle="Stored on this device">
          <DataPanel />
        </Section>
      </div>
      <p className="mt-8 text-center text-xs text-muted">Payday · your data stays on this device</p>
    </div>
  )
}

function Section({ title, subtitle, icon, children, open }: { title: string; subtitle?: string; icon?: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details className="card group overflow-hidden" open={open}>
      <summary className="flex cursor-pointer items-center gap-3 p-5 select-none">
        {icon && <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-text">{icon}</span>}
        <span className="flex-1">
          <span className="block font-semibold">{title}</span>
          {subtitle && <span className="block text-sm text-muted">{subtitle}</span>}
        </span>
        <span className="text-muted transition-transform group-open:rotate-90" aria-hidden="true">
          ›
        </span>
      </summary>
      <div className="border-t border-line p-5">{children}</div>
    </details>
  )
}

/** Numeric input that keeps its own text while typing and commits valid numbers. */
function NumField({ value, onCommit, min = 0, max = 1e7, label, prefix, className = '' }: { value: number; onCommit: (n: number) => void; min?: number; max?: number; label: string; prefix?: string; className?: string }) {
  const [text, setText] = useState(String(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(String(value))
  }, [value])
  return (
    <label className={`relative block ${className}`}>
      {prefix && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">{prefix}</span>}
      <input
        inputMode="decimal"
        aria-label={label}
        className={`field ${prefix ? 'pl-7' : ''}`}
        value={text}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false
          setText(String(value))
        }}
        onChange={(e) => {
          setText(e.target.value)
          const n = parseFloat(e.target.value)
          if (isFinite(n) && n >= min && n <= max) onCommit(Math.round(n * 100) / 100)
        }}
      />
    </label>
  )
}

function ThemeSection() {
  const { theme } = useStore()
  const setTheme = (patch: Partial<typeof theme>) => update((s) => ({ ...s, theme: { ...s.theme, ...patch } }))
  const isPreset = PRESETS.some((p) => p.color.toLowerCase() === theme.accent.toLowerCase())
  return (
    <section className="card p-5">
      <p className="font-semibold">Theme</p>
      <p className="text-sm text-muted">The whole app recolors instantly.</p>
      <div className="mt-4 flex flex-wrap gap-3" role="radiogroup" aria-label="Accent color">
        {PRESETS.map((p) => {
          const on = p.color.toLowerCase() === theme.accent.toLowerCase()
          return (
            <button
              key={p.color}
              role="radio"
              aria-checked={on}
              aria-label={p.name}
              title={p.name}
              onClick={() => setTheme({ accent: p.color })}
              className={`press grid size-11 place-items-center rounded-full text-white ${on ? 'ring-2 ring-ink ring-offset-2 ring-offset-card' : ''}`}
              style={{ background: p.color }}
            >
              {on && <IconCheck size={18} strokeWidth={3} />}
            </button>
          )
        })}
        <label
          className={`press relative grid size-11 cursor-pointer place-items-center overflow-hidden rounded-full ${!isPreset ? 'ring-2 ring-ink ring-offset-2 ring-offset-card' : ''}`}
          style={{ background: 'conic-gradient(#f43f5e, #f59e0b, #84cc16, #06b6d4, #6366f1, #d946ef, #f43f5e)' }}
          title="Custom color"
        >
          <input type="color" value={theme.accent} onChange={(e) => setTheme({ accent: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Custom accent color" />
          <span className="grid size-6 place-items-center rounded-full bg-card text-xs font-bold text-ink">+</span>
        </label>
      </div>
      <div className="mt-4">
        <Segmented<ThemeMode>
          label="Appearance"
          value={theme.mode}
          onChange={(mode) => setTheme({ mode })}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'auto', label: 'Auto' },
          ]}
        />
      </div>
      <Button
        variant="soft"
        className="mt-4 w-full"
        onClick={async () => {
          const r = await shareOrCopy({ title: 'My Payday theme', text: 'Try my Payday theme 🎨', url: themeLink(theme) })
          if (r === 'copied') toast('Theme link copied')
        }}
      >
        <IconLink size={18} /> Share this theme
      </Button>
    </section>
  )
}

function PaychecksEditor() {
  const { paychecks } = useStore()
  const set = (id: string, patch: { day?: number; amount?: number }) => update((s) => ({ ...s, paychecks: s.paychecks.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
  return (
    <div className="space-y-2">
      {sortedPaychecks(paychecks).map((p) => (
        <div key={p.id} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2">
          <NumField label="Pay day of month" value={p.day} min={1} max={31} onCommit={(day) => set(p.id, { day: Math.round(day) })} />
          <NumField label="Paycheck amount" prefix="$" value={p.amount} onCommit={(amount) => set(p.id, { amount })} />
          <DeleteBtn label={`Remove paycheck on the ${ordinal(p.day)}`} onClick={() => update((s) => ({ ...s, paychecks: s.paychecks.filter((x) => x.id !== p.id), bills: s.bills.map((b) => (b.pinnedPaycheckId === p.id ? { ...b, pinnedPaycheckId: undefined } : b)) }))} />
        </div>
      ))}
      <p className="text-xs text-muted">Day of month · amount. Days past a month’s end land on its last day.</p>
      <AddBtn
        onClick={() => {
          const used = new Set(paychecks.map((p) => p.day))
          const day = [15, 5, 25, 1, 10, 20, 28].find((d) => !used.has(d)) ?? 15
          update((s) => ({ ...s, paychecks: [...s.paychecks, { id: uid(), day, amount: s.paychecks[0]?.amount ?? 1000 }] }))
        }}
      >
        Add paycheck
      </AddBtn>
    </div>
  )
}

function CategoriesEditor() {
  const { categories } = useStore()
  const set = (id: string, patch: Partial<(typeof categories)[number]>) => update((s) => ({ ...s, categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))
  return (
    <div className="space-y-2">
      {categories.map((c) => (
        <div key={c.id} className="grid grid-cols-[3.25rem_1fr_6.5rem_auto] items-center gap-2">
          <input className="field px-2 text-center" value={c.emoji} maxLength={4} onChange={(e) => set(c.id, { emoji: e.target.value })} aria-label={`${c.name} emoji`} />
          <input className="field" value={c.name} maxLength={30} onChange={(e) => set(c.id, { name: e.target.value })} aria-label="Category name" />
          <NumField label={`${c.name} budget per paycheck`} prefix="$" value={c.budget} onCommit={(budget) => set(c.id, { budget })} />
          <DeleteBtn label={`Remove ${c.name}`} onClick={() => update((s) => ({ ...s, categories: s.categories.filter((x) => x.id !== c.id) }))} />
        </div>
      ))}
      <AddBtn onClick={() => update((s) => ({ ...s, categories: [...s.categories, { id: uid(), name: 'New category', emoji: '✨', budget: 50 }] }))}>Add category</AddBtn>
    </div>
  )
}

const TYPES: BillType[] = ['bill', 'subscription', 'savings', 'debt']

function BillsEditor() {
  const { bills, paychecks, household } = useStore()
  const [openId, setOpenId] = useState<string | null>(null)
  const set = (id: string, patch: Partial<Bill>) => update((s) => ({ ...s, bills: s.bills.map((b) => (b.id === id ? { ...b, ...patch } : b)) }))
  const sorted = [...bills].sort((a, b) => a.day - b.day || a.name.localeCompare(b.name))
  return (
    <div>
      <ul className="divide-y divide-line">
        {sorted.map((b) => {
          const open = openId === b.id
          return (
            <li key={b.id} className="py-2">
              <button className="flex w-full items-center gap-3 py-1 text-left" onClick={() => setOpenId(open ? null : b.id)} aria-expanded={open}>
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sunken text-xs font-bold text-muted">{b.day}</span>
                <span className="flex-1 font-medium">{b.name}</span>
                <Pill tone="muted">{TYPE_LABEL[b.type]}</Pill>
                <span className="num w-20 text-right font-semibold">${b.amount.toLocaleString()}</span>
              </button>
              {open && (
                <div className="anim-pop mt-2 space-y-2 rounded-2xl bg-sunken/60 p-3">
                  <input className="field" value={b.name} maxLength={40} onChange={(e) => set(b.id, { name: e.target.value })} aria-label="Bill name" />
                  <div className="grid grid-cols-2 gap-2">
                    <NumField label="Due day of month" value={b.day} min={1} max={31} onCommit={(day) => set(b.id, { day: Math.round(day) })} />
                    <NumField label="Bill amount" prefix="$" value={b.amount} onCommit={(amount) => set(b.id, { amount })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select className="field" value={b.type} onChange={(e) => set(b.id, { type: e.target.value as BillType })} aria-label="Bill type">
                      {TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t[0].toUpperCase() + t.slice(1)}
                        </option>
                      ))}
                    </select>
                    <select className="field" value={b.pinnedPaycheckId ?? ''} onChange={(e) => set(b.id, { pinnedPaycheckId: e.target.value || undefined })} aria-label="Pay from paycheck">
                      <option value="">Auto paycheck</option>
                      {sortedPaychecks(paychecks).map((p) => (
                        <option key={p.id} value={p.id}>
                          Pin to {ordinal(p.day)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {household.members.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-sm text-muted">Split with</span>
                      {household.members.map((m) => {
                        const on = b.splitWith?.includes(m.id)
                        return (
                          <button
                            key={m.id}
                            aria-pressed={on}
                            onClick={() => set(b.id, { splitWith: on ? b.splitWith!.filter((x) => x !== m.id) : [...(b.splitWith ?? []), m.id] })}
                            className={`press rounded-full px-3 py-1.5 text-sm font-semibold ${on ? 'bg-accent text-on-accent' : 'bg-card text-ink'}`}
                          >
                            {m.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <Button variant="danger" className="w-full py-2.5" onClick={() => update((s) => ({ ...s, bills: s.bills.filter((x) => x.id !== b.id) }))}>
                    <IconTrash size={18} /> Delete bill
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <AddBtn
        onClick={() => {
          const id = uid()
          update((s) => ({ ...s, bills: [...s.bills, { id, name: 'New bill', day: 1, amount: 0, type: 'bill' }] }))
          setOpenId(id)
        }}
      >
        Add bill
      </AddBtn>
    </div>
  )
}

function HouseholdEditor() {
  const { household } = useStore()
  const [name, setName] = useState('')
  const [me, setMe] = useState('')
  const setHousehold = (patch: Partial<typeof household>) => update((s) => ({ ...s, household: { ...s.household, ...patch } }))
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Split rent and shared bills. Mark a bill as split in Bills, then track who’s paid you back on the Budget tab.</p>
      <input className="field" value={household.name} maxLength={30} onChange={(e) => setHousehold({ name: e.target.value })} aria-label="Household name" />
      <ul className="space-y-2">
        {household.members.map((m) => (
          <li key={m.id} className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent-text">{m.name[0]?.toUpperCase()}</span>
            <span className="flex-1 font-medium">{m.name}</span>
            <DeleteBtn
              label={`Remove ${m.name}`}
              onClick={() =>
                update((s) => ({
                  ...s,
                  household: { ...s.household, members: s.household.members.filter((x) => x.id !== m.id) },
                  bills: s.bills.map((b) => ({ ...b, splitWith: b.splitWith?.filter((x) => x !== m.id) })),
                }))
              }
            />
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          setHousehold({ members: [...household.members, { id: uid(), name: name.trim() }] })
          setName('')
        }}
      >
        <input className="field" placeholder="Roommate or partner name" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} aria-label="Member name" />
        <Button type="submit" variant="ghost" disabled={!name.trim()}>
          Add
        </Button>
      </form>
      <div className="rounded-2xl bg-sunken p-3">
        <p className="text-sm font-semibold">Invite by link</p>
        <p className="text-xs text-muted">Shares your household and split bills so they can set up the same splits. Live syncing arrives with accounts.</p>
        <div className="mt-2 flex gap-2">
          <input className="field bg-card" placeholder="Your name" value={me} maxLength={30} onChange={(e) => setMe(e.target.value)} aria-label="Your name" />
          <Button
            className="shrink-0"
            disabled={!me.trim()}
            onClick={async () => {
              const r = await shareOrCopy({ title: 'Join our Payday budget', text: `${me.trim()} invited you to split bills in Payday`, url: householdLink(getState(), me.trim()) })
              if (r === 'copied') toast('Invite link copied')
            }}
          >
            Invite
          </Button>
        </div>
      </div>
    </div>
  )
}

function ImportPanel() {
  const [rows, setRows] = useState<ImportRow[] | null>(null)
  const [skipped, setSkipped] = useState(0)
  const [paste, setPaste] = useState('')
  const [sheet, setSheet] = useState('')
  const [loading, setLoading] = useState(false)

  function load(text: string) {
    const res = rowsFromCsv(text)
    if (!res.rows.length) {
      toast('No rows found — expected columns: date, name, category, amount')
      return
    }
    setSkipped(res.skipped)
    setRows(res.rows)
  }

  async function loadSheet() {
    const url = sheetsCsvUrl(sheet)
    if (!url) return toast('That doesn’t look like a Google Sheets link')
    setLoading(true)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error()
      load(await res.text())
    } catch {
      toast('Couldn’t read the sheet — set sharing to “Anyone with the link”')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Columns: <strong className="text-ink">date, name, category, amount</strong>. A header row is optional. Payments that match a bill check it off automatically.
      </p>
      <label className="press flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line py-5 font-semibold text-accent-text">
        <IconUpload size={20} /> Choose a CSV file
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) load(await f.text())
            e.target.value = ''
          }}
        />
      </label>
      <div className="space-y-2">
        <p className="text-sm font-semibold">Google Sheets link</p>
        <div className="flex gap-2">
          <input className="field" placeholder="https://docs.google.com/spreadsheets/d/…" value={sheet} onChange={(e) => setSheet(e.target.value)} aria-label="Google Sheets link" />
          <Button variant="ghost" className="shrink-0" onClick={loadSheet} disabled={!sheet || loading}>
            {loading ? '…' : 'Load'}
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">Or paste CSV</p>
        <textarea className="field min-h-24 font-mono text-sm" placeholder={'2026-09-12,Trader Joe’s,Groceries,54.20'} value={paste} onChange={(e) => setPaste(e.target.value)} aria-label="CSV text" />
        <Button variant="ghost" className="w-full" disabled={!paste.trim()} onClick={() => load(paste)}>
          Review rows
        </Button>
      </div>
      <ImportSheet
        rows={rows}
        skipped={skipped}
        onClose={() => {
          setRows(null)
          setPaste('')
        }}
      />
    </div>
  )
}

function BankCard() {
  return (
    <section className="card p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-text">
          <IconBank size={20} />
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold">Connect your bank</p>
            <Pill tone="accent">Soon</Pill>
          </div>
          <p className="mt-1 text-sm text-muted">
            Read-only via Plaid. Transactions are auto-categorized, editable, and matched to bills so they check off on their own. Manual entry and CSV import always work without a bank.
          </p>
        </div>
      </div>
      <Button variant="ghost" className="mt-4 w-full" disabled>
        Connect with Plaid
      </Button>
    </section>
  )
}

function TemplateShare() {
  const [amounts, setAmounts] = useState(false)
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Share your paycheck setup, categories and bills as a starting point. Opening the link lets them apply it to their own Payday.</p>
      <label className="flex items-center gap-3 text-sm font-medium">
        <input type="checkbox" checked={amounts} onChange={(e) => setAmounts(e.target.checked)} className="size-5 accent-[var(--accent)]" />
        Include dollar amounts
      </label>
      <Button
        variant="soft"
        className="w-full"
        onClick={async () => {
          const r = await shareOrCopy({ title: 'My Payday budget template', text: 'Here’s how I budget each paycheck 💸', url: templateLink(getState(), amounts) })
          if (r === 'copied') toast('Template link copied')
        }}
      >
        <IconLink size={18} /> Share template link
      </Button>
    </div>
  )
}

function DataPanel() {
  const state = useStore()
  return (
    <div className="space-y-2">
      <Button
        variant="ghost"
        className="w-full"
        onClick={async () => {
          const ok = await copy(JSON.stringify(state))
          toast(ok ? 'Backup copied to clipboard' : 'Couldn’t copy')
        }}
      >
        Copy backup (JSON)
      </Button>
      <Button
        variant="ghost"
        className="w-full"
        onClick={() => {
          if (confirm('Replace your budget with the sample budget? Your theme is kept.')) replaceState({ ...sampleState(), theme: state.theme })
        }}
      >
        Load sample budget
      </Button>
      <Button
        variant="danger"
        className="w-full"
        onClick={() => {
          if (confirm('Clear all paychecks, bills, categories, expenses and reminders? This can’t be undone.')) replaceState({ ...emptyState(), theme: state.theme })
        }}
      >
        Clear all data
      </Button>
    </div>
  )
}

function DeleteBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={label} className="press grid size-10 place-items-center rounded-full text-muted hover:bg-sunken hover:text-danger">
      <IconTrash size={18} />
    </button>
  )
}

function AddBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="press mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line py-3 font-semibold text-accent-text">
      <IconPlus size={18} /> {children}
    </button>
  )
}
