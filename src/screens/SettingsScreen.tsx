import { useEffect, useRef, useState, type ReactNode } from 'react'
import { balances, sortedPaychecks } from '../lib/budget'
import { ordinal } from '../lib/dates'
import { money, uid } from '../lib/format'
import { rowsFromCsv, sheetsCsvUrl, type ImportRow } from '../lib/importer'
import { householdLink, templateLink } from '../lib/links'
import { emptyState, sampleState } from '../lib/seed'
import { copy, shareOrCopy } from '../lib/share'
import { getState, replaceState, setBalance, update, useStore } from '../lib/store'
import { PRESETS } from '../lib/theme'
import type { Bill, ThemeMode } from '../lib/types'
import { IconBank, IconCheck, IconCloud, IconLink, IconPlus, IconTrash, IconUpload, IconUsers } from '../components/icons'
import { Button, Segmented, toast } from '../components/ui'
import { ImportSheet } from './ImportSheet'
import { bankApi, connectBank, disconnectBank, refreshBanks, useBank, type BankItem } from '../lib/bank'
import { balancesFromAccounts, transactionsToRows } from '../lib/bankData'
import { SyncPanel } from './SyncSection'
import { syncSetupProblem, useSync, type SyncStatus } from '../lib/sync'
import { BUILT_IN_TYPES, billTypeLabel } from '../lib/billTypes'

function syncSubtitle(status: SyncStatus, email: string | null) {
  if (status === 'off') return syncSetupProblem ? 'Setting needs fixing' : 'Not set up yet'
  if (status === 'signed-out') return 'Sign in to use your budget everywhere'
  return email ?? 'Signed in'
}

/** Settings sections other screens can open directly. */
export type SettingsSection = 'balances' | 'paychecks' | 'categories' | 'bills'

export function SettingsScreen({ focus = null }: { focus?: SettingsSection | null }) {
  const state = useStore()
  const sync = useSync()
  useEffect(() => {
    if (focus) document.getElementById(`settings-${focus}`)?.scrollIntoView({ block: 'start' })
  }, [focus])
  return (
    <div>
      <header className="px-1 pb-3">
        <h1 className="font-serif text-[28px] font-semibold tracking-tight">Settings</h1>
      </header>
      <div className="space-y-3">
        <Section title="Sync across devices" subtitle={syncSubtitle(sync.status, sync.email)} icon={<IconCloud size={20} />}>
          <SyncPanel />
        </Section>
        <ThemeSection />
        <Section id="settings-balances" open={focus === 'balances'} title="Account balances" subtitle="Checking and savings">
          <AccountsEditor />
        </Section>
        <Section id="settings-paychecks" open={focus === 'paychecks'} title="Paychecks" subtitle={`${state.paychecks.length} per month`}>
          <PaychecksEditor />
        </Section>
        <Section id="settings-categories" open={focus === 'categories'} title="Category budgets" subtitle="Per paycheck">
          <CategoriesEditor />
        </Section>
        <Section id="settings-bills" open={focus === 'bills'} title="Bills" subtitle={`${state.bills.length} recurring monthly`}>
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
      <p className="mt-8 text-center text-xs text-muted">
        Payday ·{' '}
        <a href="/privacy" className="font-semibold underline">
          Privacy Policy
        </a>
      </p>
    </div>
  )
}

function Section({ title, subtitle, icon, children, open, id }: { title: string; subtitle?: string; icon?: ReactNode; children: ReactNode; open?: boolean; id?: string }) {
  return (
    <details id={id} className="card group scroll-mt-4 overflow-hidden" open={open}>
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
        className={`field ${prefix ? 'pl-8' : ''}`}
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
    </section>
  )
}

function AccountsEditor() {
  const state = useStore()
  const b = balances(state)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-sm font-semibold">Checking</span>
          <NumField label="Checking balance" prefix="$" value={b.checking} min={-1e7} onCommit={(n) => setBalance('checking', n)} />
        </div>
        <div className="space-y-1">
          <span className="text-sm font-semibold">Savings</span>
          <NumField label="Savings balance" prefix="$" value={b.savings} min={-1e7} onCommit={(n) => setBalance('savings', n)} />
        </div>
      </div>
      <p className="text-xs text-muted">
        Enter what’s in each account now. Checking goes up each payday and down when you log an expense or check off a bill. Checking off a savings item moves it from checking to savings.
      </p>
    </div>
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
          <DeleteBtn label={`Remove paycheck on the ${ordinal(p.day)}`} onClick={() => update((s) => ({ ...s, paychecks: s.paychecks.filter((x) => x.id !== p.id), bills: s.bills.map((b) => (b.paycheckId === p.id ? { ...b, paycheckId: undefined } : b)) }))} />
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

function Chip({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: ReactNode; label?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`press rounded-full px-3 py-1.5 text-sm font-semibold ${on ? 'bg-accent text-on-accent' : 'bg-card text-ink'}`}
    >
      {children}
    </button>
  )
}

function BillsEditor() {
  const { bills, household, paychecks, billTypes } = useStore()
  const [openId, setOpenId] = useState<string | null>(null)
  const set = (id: string, patch: Partial<Bill>) => update((s) => ({ ...s, bills: s.bills.map((b) => (b.id === id ? { ...b, ...patch } : b)) }))
  const sorted = [...bills].sort((a, b) => a.day - b.day || a.name.localeCompare(b.name))
  const checks = sortedPaychecks(paychecks)
  const checkName = (id?: string) => {
    const i = checks.findIndex((p) => p.id === id)
    return i >= 0 ? `Paycheck ${i + 1}` : null
  }
  return (
    <div>
      <ul className="divide-y divide-line">
        {sorted.map((b) => {
          const open = openId === b.id
          const assigned = checkName(b.paycheckId)
          return (
            <li key={b.id} className="py-2">
              <button className="flex w-full items-center gap-3 py-1 text-left" onClick={() => setOpenId(open ? null : b.id)} aria-expanded={open}>
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sunken text-xs font-bold text-muted">{b.day}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{b.name}</span>
                  <span className="block text-xs text-muted">
                    {billTypeLabel(billTypes, b.type)} · {assigned ? `from ${assigned}` : 'automatic paycheck'}
                  </span>
                </span>
                <span className="num text-right font-semibold">${b.amount.toLocaleString()}</span>
              </button>
              {open && (
                <div className="anim-pop mt-2 space-y-4 rounded-2xl bg-sunken/60 p-3">
                  <div className="space-y-2">
                    <input className="field" value={b.name} maxLength={40} onChange={(e) => set(b.id, { name: e.target.value })} aria-label="Bill name" />
                    <div className="grid grid-cols-2 gap-2">
                      <NumField label="Due day of month" value={b.day} min={1} max={31} onCommit={(day) => set(b.id, { day: Math.round(day) })} />
                      <NumField label="Bill amount" prefix="$" value={b.amount} onCommit={(amount) => set(b.id, { amount })} />
                    </div>
                  </div>

                  <fieldset>
                    <legend className="mb-1.5 text-sm font-semibold">Assign to paycheck</legend>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Paycheck for ${b.name}`}>
                      <Chip on={!assigned} onClick={() => set(b.id, { paycheckId: undefined })}>
                        Automatic
                      </Chip>
                      {checks.map((p, i) => (
                        <Chip key={p.id} on={b.paycheckId === p.id} onClick={() => set(b.id, { paycheckId: p.id })} label={`Paycheck ${i + 1}, paid on the ${ordinal(p.day)}`}>
                          Paycheck {i + 1} · {ordinal(p.day)}
                        </Chip>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-muted">
                      {assigned
                        ? `Every month, ${b.name} comes out of the last ${assigned} before it’s due.`
                        : `Every month, ${b.name} comes out of the last paycheck before it’s due.`}
                    </p>
                  </fieldset>

                  <fieldset>
                    <legend className="mb-1.5 text-sm font-semibold">Type</legend>
                    <TypePicker value={b.type} onChange={(type) => set(b.id, { type })} billName={b.name} />
                  </fieldset>

                  {household.members.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">Split with</span>
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
      <BillTypesManager />
    </div>
  )
}

/** Built-in and custom type chips, plus a field to create a new type on the spot. */
function TypePicker({ value, onChange, billName }: { value: string; onChange: (type: string) => void; billName: string }) {
  const { billTypes } = useStore()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const all = [...BUILT_IN_TYPES.map((t) => ({ id: t.id as string, name: t.name })), ...billTypes]
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Type for ${billName}`}>
        {all.map((t) => (
          <Chip key={t.id} on={value === t.id || (t.id === 'bill' && !all.some((x) => x.id === value))} onClick={() => onChange(t.id)}>
            {t.name}
          </Chip>
        ))}
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="press rounded-full border-2 border-dashed border-line px-3 py-1 text-sm font-semibold text-accent-text">
            + New type
          </button>
        )}
      </div>
      {adding && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const id = addBillType(name)
            if (id) onChange(id)
            setName('')
            setAdding(false)
          }}
        >
          <input autoFocus className="field bg-card" placeholder="e.g. Insurance" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} aria-label="New bill type name" />
          <Button type="submit" className="shrink-0" disabled={!name.trim()}>
            Add
          </Button>
          <Button type="button" variant="ghost" className="shrink-0" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </form>
      )}
      {value === 'savings' && <p className="text-xs text-muted">Checking off a Savings item moves its amount from Checking to Savings.</p>}
    </div>
  )
}

/** Adds a custom bill type, reusing one with the same name. Returns its id. */
function addBillType(raw: string): string | null {
  const name = raw.trim()
  if (!name) return null
  const s = getState()
  const existing = [...BUILT_IN_TYPES.map((t) => ({ id: t.id as string, name: t.name })), ...s.billTypes].find((t) => t.name.toLowerCase() === name.toLowerCase())
  if (existing) return existing.id
  const id = uid()
  update((st) => ({ ...st, billTypes: [...st.billTypes, { id, name }] }))
  return id
}

function BillTypesManager() {
  const { billTypes, bills } = useStore()
  const [name, setName] = useState('')
  return (
    <div className="mt-5 rounded-2xl bg-sunken/60 p-3">
      <p className="text-sm font-semibold">Bill types</p>
      <p className="text-xs text-muted">Bill, Subscription, Savings and Debt are built in. Add your own, like Insurance or Loan.</p>
      <ul className="mt-2 space-y-2">
        {billTypes.map((t) => {
          const used = bills.filter((b) => b.type === t.id).length
          return (
            <li key={t.id} className="flex items-center gap-2">
              <input
                className="field bg-card py-2"
                value={t.name}
                maxLength={30}
                onChange={(e) => update((s) => ({ ...s, billTypes: s.billTypes.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)) }))}
                aria-label={`Rename ${t.name}`}
              />
              <span className="shrink-0 text-xs text-muted">{used === 1 ? '1 bill' : `${used} bills`}</span>
              <DeleteBtn
                label={`Delete type ${t.name}${used ? `; its bills become Bill` : ''}`}
                onClick={() =>
                  update((s) => ({
                    ...s,
                    billTypes: s.billTypes.filter((x) => x.id !== t.id),
                    bills: s.bills.map((b) => (b.type === t.id ? { ...b, type: 'bill' } : b)),
                  }))
                }
              />
            </li>
          )
        })}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          addBillType(name)
          setName('')
        }}
      >
        <input className="field bg-card py-2" placeholder="New type name" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} aria-label="New bill type" />
        <Button type="submit" variant="ghost" className="shrink-0 bg-card py-2" disabled={!name.trim()}>
          Add type
        </Button>
      </form>
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
        <textarea className="field min-h-24 font-mono" placeholder={'2026-09-12,Trader Joe’s,Groceries,54.20'} value={paste} onChange={(e) => setPaste(e.target.value)} aria-label="CSV text" />
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
  const sync = useSync()
  const bank = useBank()
  const signedIn = sync.status !== 'off' && sync.status !== 'signed-out'
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [review, setReview] = useState<{ item: BankItem; rows: ImportRow[]; skipped: number; cursor: string | null } | null>(null)
  const [balances, setBalances] = useState<{ bank: string; checking: number | null; savings: number | null } | null>(null)

  // Load the connected banks once; after a failure, wait for "Try again" instead of retrying in a loop.
  useEffect(() => {
    if (signedIn && bank.items === null && !bank.loading && !bank.error) void refreshBanks()
  }, [signedIn, bank.items, bank.loading, bank.error])

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const importFrom = (item: BankItem) =>
    run(`sync:${item.item_id}`, async () => {
      const res = await bankApi.sync(item.item_id)
      const { rows, skipped } = transactionsToRows(res.transactions)
      const b = balancesFromAccounts(res.accounts)
      if (b.checking !== null || b.savings !== null) setBalances({ bank: item.institution_name, ...b })
      if (!rows.length) {
        await bankApi.commit(item.item_id, res.next_cursor)
        toast(`No new spending from ${item.institution_name}`)
        return
      }
      setReview({ item, rows, skipped, cursor: res.next_cursor })
    })

  return (
    <section className="card p-5" aria-label="Connect your bank">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-text">
          <IconBank size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Connect your bank</p>
          <p className="mt-1 text-sm text-muted">
            Read-only, through Plaid. Payday never sees your bank password. New spending comes in for you to review: auto-categorized, editable, and matched to your bills so they check off on their own.
          </p>
        </div>
      </div>

      {!signedIn ? (
        <p className="mt-4 rounded-2xl bg-sunken p-3 text-sm text-muted">
          {sync.status === 'off' ? 'The bank connection uses your Payday account. Set up sync first (see the README).' : 'Sign in under Sync across devices first. Your bank connection belongs to your account.'}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {bank.loading && bank.items === null && <p className="text-sm text-muted">Checking for connected banks…</p>}
          {(bank.items ?? []).map((item) => (
            <div key={item.item_id} className="rounded-2xl bg-sunken p-3">
              <p className="font-semibold">{item.institution_name}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button className="py-2" disabled={!!busy} onClick={() => importFrom(item)}>
                  {busy === `sync:${item.item_id}` ? 'Checking…' : 'Import new spending'}
                </Button>
                <ConfirmButton
                  variant="ghost"
                  confirmText="Tap again to disconnect"
                  onConfirm={() => run(`remove:${item.item_id}`, () => disconnectBank(item.item_id))}
                >
                  Disconnect
                </ConfirmButton>
              </div>
            </div>
          ))}

          {balances && (
            <div className="rounded-2xl bg-accent-soft p-3 text-sm" role="status">
              <p className="font-semibold text-accent-text">Balances at {balances.bank}</p>
              <p className="mt-0.5">
                {balances.checking !== null && <>Checking {money(balances.checking)}</>}
                {balances.checking !== null && balances.savings !== null && ' · '}
                {balances.savings !== null && <>Savings {money(balances.savings)}</>}
              </p>
              <Button
                variant="soft"
                className="mt-2 w-full bg-card py-2"
                onClick={() => {
                  if (balances.checking !== null) setBalance('checking', balances.checking)
                  if (balances.savings !== null) setBalance('savings', balances.savings)
                  setBalances(null)
                  toast('Balances updated from your bank')
                }}
              >
                Use these as my balances
              </Button>
            </div>
          )}

          <Button
            variant={bank.items?.length ? 'ghost' : 'primary'}
            className="w-full"
            disabled={!!busy}
            onClick={() =>
              run('connect', async () => {
                const item = await connectBank()
                if (item) {
                  toast(`Connected ${item.institution_name}`)
                  await importFrom(item)
                }
              })
            }
          >
            {busy === 'connect' ? 'Opening…' : bank.items?.length ? 'Connect another bank' : 'Connect a bank'}
          </Button>
          <p className="text-xs text-muted">
            By connecting a bank, you agree to Payday’s{' '}
            <a href="/privacy" className="font-semibold underline">
              Privacy Policy
            </a>{' '}
            and Plaid’s{' '}
            <a href="https://plaid.com/legal/#end-user-privacy-policy" target="_blank" rel="noopener" className="font-semibold underline">
              End User Privacy Policy
            </a>
            .
          </p>
          {(error || bank.error) && (
            <div className="space-y-2" role="alert">
              <p className="text-sm text-danger">{error || bank.error}</p>
              {bank.error && bank.items === null && (
                <Button variant="ghost" className="w-full py-2" disabled={bank.loading} onClick={() => void refreshBanks()}>
                  {bank.loading ? 'Checking…' : 'Try again'}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <ImportSheet
        rows={review?.rows ?? null}
        skipped={review?.skipped ?? 0}
        source="bank"
        title={review ? `New from ${review.item.institution_name}` : 'Review import'}
        note="Pending charges come in once they post. Money coming in, like your paycheck, isn’t counted as spending."
        onImported={() => {
          if (review) void bankApi.commit(review.item.item_id, review.cursor).catch((e) => setError((e as Error).message))
        }}
        onClose={() => setReview(null)}
      />
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
  const { status } = useSync()
  const everywhere = status !== 'off' && status !== 'signed-out'
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
      <ConfirmButton variant="ghost" confirmText={everywhere ? "Tap again to replace it on all devices" : "Tap again to replace your budget"} onConfirm={() => replaceState({ ...sampleState(), theme: state.theme })}>
        Load sample budget
      </ConfirmButton>
      <ConfirmButton variant="danger" confirmText={everywhere ? "Tap again to erase on all devices" : "Tap again to erase everything"} onConfirm={() => replaceState({ ...emptyState(), theme: state.theme })}>
        Clear all data
      </ConfirmButton>
      <p className="text-xs text-muted">Loading the sample or clearing keeps your theme. Clearing can’t be undone.{everywhere && ' While you’re signed in, both apply to all your devices.'}</p>
    </div>
  )
}

/** Two-tap confirmation, so destructive actions don't depend on browser dialogs. */
function ConfirmButton({ children, confirmText, onConfirm, variant }: { children: ReactNode; confirmText: string; onConfirm: () => void; variant: 'ghost' | 'danger' }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <Button
      variant={armed ? 'danger' : variant}
      className="w-full"
      onClick={() => {
        if (!armed) return setArmed(true)
        setArmed(false)
        onConfirm()
        toast('Done')
      }}
    >
      {armed ? confirmText : children}
    </Button>
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
