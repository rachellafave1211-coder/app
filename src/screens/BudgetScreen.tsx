import { useMemo, useState } from 'react'
import { assignBill, assignExpense, categoryById, paycheckLabel, payKey, placeExpense, planMonth, type PaycheckPlan, type PayInstance, type Placement } from '../lib/budget'
import { billTypeLabel } from '../lib/billTypes'
import { addMonths, monthShort, shortDate, thisMonth, weekdayDate } from '../lib/dates'
import { money, moneyWhole, pct } from '../lib/format'
import { replaceState, togglePaid, update, useStore } from '../lib/store'
import type { AppState, Expense } from '../lib/types'
import { isUncategorized } from '../lib/expenses'
import { IconShare, IconTrash } from '../components/icons'
import { Bar, Button, CheckCircle, MonthSwitcher, Pill, Ring, SectionTitle, toast } from '../components/ui'
import { WrappedSheet } from './WrappedSheet'
import { SplitsCard } from './SplitsCard'
import { BalancesCard } from './BalancesCard'
import type { SettingsSection } from './SettingsScreen'
import { sampleState } from '../lib/seed'
import { AddExpenseSheet } from './AddExpenseSheet'


export function BudgetScreen({ onGoSettings }: { onGoSettings: (section: SettingsSection) => void }) {
  const state = useStore()
  const [month, setMonth] = useState(thisMonth())
  const [wrapped, setWrapped] = useState(false)
  const plan = useMemo(() => planMonth(state, month), [state, month])

  const available = plan.income - plan.billsTotal
  const used = available > 0 ? plan.spent / available : plan.spent > 0 ? 1 : 0
  const monthExpenses = state.expenses.filter((e) => e.date.startsWith(month)).sort((a, b) => (a.date < b.date ? 1 : -1))
  const [showAll, setShowAll] = useState(false)
  const [onlyUncategorized, setOnlyUncategorized] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const uncategorized = monthExpenses.filter((e) => isUncategorized(e, state.categories))
  const filtering = onlyUncategorized && uncategorized.length > 0
  const listed = filtering ? uncategorized : showAll ? monthExpenses : monthExpenses.slice(0, 6)

  return (
    <div>
      <header className="flex items-center justify-between px-1 pb-3">
        <h1 className="font-serif text-[28px] font-semibold tracking-tight">Payday</h1>
        <MonthSwitcher label={monthShort(month)} onPrev={() => setMonth(addMonths(month, -1))} onNext={() => setMonth(addMonths(month, 1))} onToday={() => setMonth(thisMonth())} />
      </header>

      <div className="mb-4">
        <BalancesCard />
      </div>

      <section className="anim-pop relative overflow-hidden rounded-[28px] bg-accent p-6 text-on-accent shadow-card">
        <div className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full border-[28px] border-on-accent/10" />
        <div className="relative flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium opacity-85">Left to spend this month</p>
            <p className={`num mt-1 text-[52px] leading-none font-semibold ${plan.leftToSpend < 0 ? 'opacity-95' : ''}`}>
              {plan.leftToSpend < 0 ? '−' : ''}
              {moneyWhole(Math.abs(plan.leftToSpend))}
            </p>
            <p className="mt-2 text-sm opacity-85">{plan.leftToSpend < 0 ? 'over what this month’s paychecks cover' : `after bills and ${moneyWhole(plan.spent)} spent`}</p>
          </div>
          <Ring value={used} size={104} stroke={10}>
            <div>
              <p className="num text-2xl font-semibold">{Math.min(999, Math.round(used * 100))}%</p>
              <p className="text-[11px] font-medium opacity-80">spent</p>
            </div>
          </Ring>
        </div>
        <dl className="relative mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-on-accent/12 p-3 text-center">
          <Stat label="Income" value={moneyWhole(plan.income)} />
          <Stat label="Bills" value={moneyWhole(plan.billsTotal)} />
          <Stat label="Spent" value={moneyWhole(plan.spent)} />
        </dl>
      </section>

      {plan.plans.length === 0 ? (
        <WelcomeCard onGoSettings={onGoSettings} />
      ) : (
        <>
          <WelcomeCard onGoSettings={onGoSettings} compact />
          <SectionTitle>Paychecks</SectionTitle>
          <div className="space-y-4">
            {plan.plans.map((p, i) => (
              <PaycheckCard key={payKey(p.pay)} plan={p} state={state} index={i} />
            ))}
          </div>
        </>
      )}

      <SplitsCard month={month} />

      <SectionTitle
        action={
          monthExpenses.length > 6 &&
          !filtering && (
            <button className="text-sm font-semibold text-accent-text" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show less' : `All ${monthExpenses.length}`}
            </button>
          )
        }
      >
        Recent spending
      </SectionTitle>
      {uncategorized.length > 0 && (
        <button
          className={`press mb-3 flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold ${filtering ? 'bg-accent text-on-accent' : 'bg-accent-soft text-accent-text'}`}
          aria-pressed={filtering}
          onClick={() => setOnlyUncategorized(!filtering)}
        >
          <span>
            {uncategorized.length} uncategorized {uncategorized.length === 1 ? 'charge' : 'charges'}
            {filtering ? '' : ' · tap to sort'}
          </span>
          <span>{filtering ? 'Show all' : '›'}</span>
        </button>
      )}
      <div className="card divide-y divide-line px-4">
        {monthExpenses.length === 0 && <p className="py-5 text-center text-sm text-muted">Nothing spent yet this month. Tap + to log an expense.</p>}
        {listed.map((e) => {
          const cat = categoryById(state.categories, e.categoryId)
          const where = placeExpense(state.paychecks, e)
          const name = e.note || cat?.name || 'Expense'
          return (
            <div key={e.id} className="flex items-start gap-1 py-3">
              <div className="min-w-0 flex-1">
                <button className="press flex w-full items-center gap-3 text-left" onClick={() => setEditing(e)} aria-label={`Edit ${name}, ${money(e.amount)}`}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-lg" aria-hidden="true">
                    {cat?.emoji ?? '•'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{name}</span>
                    <span className="block text-xs text-muted">
                      {shortDate(e.date)} · {cat ? cat.name : <span className="font-semibold text-accent-text">Uncategorized</span>}
                      {where && ` · ${paycheckLabel(state.paychecks, where.current, false)}`}
                    </span>
                  </span>
                  <span className="num text-lg font-semibold">{money(e.amount)}</span>
                </button>
                {where?.moved && (
                  <div className="pl-13">
                    <MovedTag
                      name={name}
                      from={where.original && paycheckLabel(state.paychecks, where.original, where.original.month !== where.current.month)}
                      onBack={where.original ? () => moveItem({ kind: 'expense', id: e.id, name, where }, where.original!) : undefined}
                    />
                  </div>
                )}
              </div>
              <button
                className="press grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-sunken hover:text-danger"
                aria-label={`Delete ${e.note || 'expense'}`}
                onClick={() => update((s) => ({ ...s, expenses: s.expenses.filter((x) => x.id !== e.id) }))}
              >
                <IconTrash size={18} />
              </button>
            </div>
          )
        })}
      </div>

      <Button className="mt-6 w-full py-4" onClick={() => setWrapped(true)} disabled={plan.plans.length === 0}>
        <IconShare size={20} /> Share my recap
      </Button>
      <p className="mt-2 text-center text-xs text-muted">Recaps only show percentages — never your dollar amounts.</p>

      <WrappedSheet open={wrapped} onClose={() => setWrapped(false)} plan={plan} />
      <AddExpenseSheet open={!!editing} expense={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

const WELCOME_HIDDEN = 'payday:welcome-hidden'

/**
 * First-run checklist. With no paychecks it is the Budget page's main content; after that a
 * compact version stays above the paychecks until balances, paychecks and bills are set, or
 * until it's hidden on this device.
 */
function WelcomeCard({ onGoSettings, compact }: { onGoSettings: (section: SettingsSection) => void; compact?: boolean }) {
  const s = useStore()
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(WELCOME_HIDDEN) === '1'
    } catch {
      return false
    }
  })
  const steps: { done: boolean; title: string; detail: string; section: SettingsSection }[] = [
    {
      done: s.accounts.checking.start !== 0 || s.accounts.savings.start !== 0,
      title: 'Enter your balances',
      detail: 'What’s in checking and savings right now.',
      section: 'balances',
    },
    { done: s.paychecks.length > 0, title: 'Add your paychecks', detail: 'The day of the month each one lands, and how much.', section: 'paychecks' },
    { done: s.bills.length > 0, title: 'Add your bills', detail: 'Rent, phone, subscriptions: each with its due day.', section: 'bills' },
    { done: s.categories.length > 0, title: 'Set spending budgets', detail: 'Optional: groceries, gas, dining out, per paycheck.', section: 'categories' },
  ]
  if (compact && (hidden || steps.slice(0, 3).every((x) => x.done))) return null
  return (
    <section className="card mt-5 p-5" aria-label="Get started">
      <div className="flex items-start justify-between gap-3">
        <p className="font-serif text-2xl font-semibold">{compact ? 'Finish setting up' : 'Welcome to Payday'}</p>
        {compact && (
          <button
            className="press shrink-0 rounded-full px-2 py-1 text-sm font-semibold text-muted hover:bg-sunken"
            onClick={() => {
              setHidden(true)
              try {
                localStorage.setItem(WELCOME_HIDDEN, '1')
              } catch {
                // Hidden for this visit only.
              }
            }}
          >
            Hide
          </button>
        )}
      </div>
      {!compact && (
        <p className="mt-1 text-sm text-muted">Payday gives each paycheck its own budget and puts every bill on the paycheck that lands before it’s due. Set it up in a few steps:</p>
      )}
      <ol className="mt-4 space-y-2">
        {steps.map((step, i) => (
          <li key={step.section}>
            <button onClick={() => onGoSettings(step.section)} className="press flex w-full items-center gap-3 rounded-2xl bg-sunken p-3 text-left hover:bg-accent-soft">
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${step.done ? 'bg-accent text-on-accent' : 'bg-card text-muted'}`}
                aria-hidden="true"
              >
                {step.done ? '✓' : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block font-semibold ${step.done ? 'text-muted line-through' : ''}`}>{step.title}</span>
                <span className="block text-xs text-muted">{step.detail}</span>
              </span>
              <span className="sr-only">{step.done ? 'Done' : 'Not done yet'}</span>
              <span className="text-muted" aria-hidden="true">
                ›
              </span>
            </button>
          </li>
        ))}
      </ol>
      {!compact && (
        <div className="mt-4 border-t border-line pt-4 text-center">
          <p className="text-sm text-muted">Just looking around?</p>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => replaceState({ ...sampleState(), theme: s.theme })}>
            Try a sample budget
          </Button>
          <p className="mt-2 text-xs text-muted">You can clear it later in Settings → Your data.</p>
        </div>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium tracking-wide uppercase opacity-80">{label}</dt>
      <dd className="num text-lg font-semibold">{value}</dd>
    </div>
  )
}

/** A bill occurrence or expense that was moved for one month (moves made before assigning moved to Settings). */
type MoveTarget = { kind: 'bill'; key: string; name: string; where: Placement } | { kind: 'expense'; id: string; name: string; where: Placement }

function moveItem(target: MoveTarget, to: PayInstance) {
  const { original } = target.where
  update((s) => (target.kind === 'bill' ? assignBill(s, target.key, to, original) : assignExpense(s, target.id, to, original)))
  toast(`Moved ${target.name} back`)
}

function MovedTag({ name, from, onBack }: { name: string; from: string | null; onBack?: () => void }) {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-text">{from ? `Moved from ${from}` : 'Moved'}</span>
      {onBack && (
        <button onClick={onBack} className="text-[11px] font-semibold text-accent-text underline underline-offset-2" aria-label={`Move ${name} back to ${from}`}>
          Move back
        </button>
      )}
    </p>
  )
}

function PaycheckCard({ plan, state, index }: { plan: PaycheckPlan; state: AppState; index: number }) {
  const { pay } = plan
  const short = plan.left < 0
  const paidCount = plan.bills.filter((b) => b.paid).length
  return (
    <article className="card anim-pop p-5" style={{ animationDelay: `${index * 40}ms` }}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted">
            {paycheckLabel(state.paychecks, pay, false)} · {weekdayDate(pay.date)}
          </p>
          <p className="num text-4xl font-semibold">{money(pay.paycheck.amount)}</p>
        </div>
        <Pill tone={short ? 'danger' : 'good'}>{short ? `Short ${money(-plan.left)}` : `${money(plan.left)} free`}</Pill>
      </header>

      <dl className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-sunken p-3 text-center">
        <MiniStat label="Bills" value={money(plan.billsTotal)} />
        <MiniStat label="Categories" value={money(plan.categoryTotal)} />
        <MiniStat label="Spent" value={money(plan.spent)} />
      </dl>

      {state.categories.length > 0 && (
        <div className="mt-4 space-y-3">
          {state.categories.map((c) => {
            const spent = plan.spentByCategory[c.id] ?? 0
            const over = spent > c.budget
            return (
              <div key={c.id}>
                <div className="mb-1.5 flex items-baseline justify-between text-sm">
                  <span className="font-medium">
                    <span aria-hidden="true">{c.emoji}</span> {c.name}
                  </span>
                  <span className={over ? 'font-semibold text-danger' : 'text-muted'}>
                    {money(spent)} <span className="text-muted">/ {money(c.budget)}</span>
                  </span>
                </div>
                <Bar value={c.budget > 0 ? spent / c.budget : spent > 0 ? 1 : 0} danger={over} />
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-5">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Bills from this check</h3>
          {plan.bills.length > 0 && (
            <span className="text-xs text-muted">
              {paidCount}/{plan.bills.length} paid · {pct(paidCount, plan.bills.length)}%
            </span>
          )}
        </div>
        {plan.bills.length === 0 && <p className="py-2 text-sm text-muted">No bills land on this paycheck.</p>}
        <ul className="divide-y divide-line">
          {plan.bills.map((b) => (
            <li key={b.key} className="flex items-center gap-3 py-2.5">
              <CheckCircle
                checked={b.paid}
                label={`Mark ${b.bill.name} ${b.paid ? 'unpaid' : 'paid'}`}
                onToggle={() => update((s) => ({ ...s, paid: togglePaid(s.paid, b.key) }))}
              />
              <div className={`min-w-0 flex-1 ${b.paid ? 'opacity-55' : ''}`}>
                <p className={`truncate font-medium ${b.paid ? 'line-through decoration-muted' : ''}`}>
                  {b.bill.name}
                </p>
                <p className="text-xs text-muted">
                  due {shortDate(b.due)} · {billTypeLabel(state.billTypes, b.bill.type, true)}
                  {b.pinned && !b.moved && ' · assigned in Settings'}
                </p>
                {b.moved && (
                  <MovedTag
                    name={b.bill.name}
                    from={b.original && paycheckLabel(state.paychecks, b.original, b.original.month !== pay.month)}
                    onBack={b.original ? () => moveItem({ kind: 'bill', key: b.key, name: b.bill.name, where: b }, b.original!) : undefined}
                  />
                )}
              </div>
              <span className="num font-semibold">{money(b.bill.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-muted">{label}</dt>
      <dd className="num text-[17px] font-semibold">{value}</dd>
    </div>
  )
}
