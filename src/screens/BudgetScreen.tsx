import { useMemo, useState } from 'react'
import { categoryById, planMonth, type PaycheckPlan } from '../lib/budget'
import { addMonths, monthShort, shortDate, thisMonth, weekdayDate } from '../lib/dates'
import { money, moneyWhole, pct } from '../lib/format'
import { togglePaid, update, useStore } from '../lib/store'
import type { AppState, BillType } from '../lib/types'
import { IconNext, IconShare, IconTrash } from '../components/icons'
import { Bar, Button, CheckCircle, MonthSwitcher, Pill, Ring, SectionTitle } from '../components/ui'
import { WrappedSheet } from './WrappedSheet'
import { SplitsCard } from './SplitsCard'
import { BalancesCard } from './BalancesCard'

export const TYPE_LABEL: Record<BillType, string> = { bill: 'Bill', subscription: 'Sub', savings: 'Savings', debt: 'Debt' }

export function BudgetScreen({ onGoSettings }: { onGoSettings: () => void }) {
  const state = useStore()
  const [month, setMonth] = useState(thisMonth())
  const [wrapped, setWrapped] = useState(false)
  const plan = useMemo(() => planMonth(state, month), [state, month])

  const available = plan.income - plan.billsTotal
  const used = available > 0 ? plan.spent / available : plan.spent > 0 ? 1 : 0
  const monthExpenses = state.expenses.filter((e) => e.date.startsWith(month)).sort((a, b) => (a.date < b.date ? 1 : -1))
  const [showAll, setShowAll] = useState(false)

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
        <div className="card mt-5 p-6 text-center">
          <p className="font-serif text-xl font-semibold">Add your paychecks</p>
          <p className="mt-1 text-sm text-muted">Payday budgets each paycheck and assigns bills to the one that lands before they’re due.</p>
          <Button className="mt-4" onClick={onGoSettings}>
            Set up paychecks
          </Button>
        </div>
      ) : (
        <>
          <SectionTitle>Paychecks</SectionTitle>
          <div className="space-y-4">
            {plan.plans.map((p, i) => (
              <PaycheckCard key={p.pay.date + p.pay.paycheck.id} plan={p} state={state} index={i} />
            ))}
          </div>
        </>
      )}

      <SplitsCard month={month} />

      <SectionTitle
        action={
          monthExpenses.length > 6 && (
            <button className="text-sm font-semibold text-accent-text" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show less' : `All ${monthExpenses.length}`}
            </button>
          )
        }
      >
        Recent spending
      </SectionTitle>
      <div className="card divide-y divide-line px-4">
        {monthExpenses.length === 0 && <p className="py-5 text-center text-sm text-muted">Nothing spent yet this month. Tap + to log an expense.</p>}
        {(showAll ? monthExpenses : monthExpenses.slice(0, 6)).map((e) => {
          const cat = categoryById(state.categories, e.categoryId)
          return (
            <div key={e.id} className="flex items-center gap-3 py-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-lg" aria-hidden="true">
                {cat?.emoji ?? '•'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{e.note || cat?.name || 'Expense'}</p>
                <p className="text-xs text-muted">
                  {shortDate(e.date)} · {cat?.name ?? 'Uncategorized'}
                  {e.source === 'import' && ' · imported'}
                </p>
              </div>
              <p className="num text-lg font-semibold">{money(e.amount)}</p>
              <button
                className="press grid size-9 place-items-center rounded-full text-muted hover:bg-sunken hover:text-danger"
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
    </div>
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

function PaycheckCard({ plan, state, index }: { plan: PaycheckPlan; state: AppState; index: number }) {
  const { pay } = plan
  const short = plan.left < 0
  const paidCount = plan.bills.filter((b) => b.paid).length
  return (
    <article className="card anim-pop p-5" style={{ animationDelay: `${index * 40}ms` }}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted">Paycheck · {weekdayDate(pay.date)}</p>
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
                  due {shortDate(b.due)} · {TYPE_LABEL[b.bill.type]}
                  {b.shift > 0 && (
                    <button
                      className="ml-1.5 font-semibold text-accent-text underline-offset-2 hover:underline"
                      onClick={() =>
                        update((s) => {
                          const shifts = { ...s.shifts }
                          delete shifts[b.key]
                          return { ...s, shifts }
                        })
                      }
                    >
                      moved · undo
                    </button>
                  )}
                </p>
              </div>
              <span className="num font-semibold">{money(b.bill.amount)}</span>
              <button
                className="press grid size-8 place-items-center rounded-full text-muted hover:bg-sunken hover:text-accent-text"
                aria-label={`Move ${b.bill.name} to next paycheck`}
                title="Move to next paycheck"
                onClick={() => update((s) => ({ ...s, shifts: { ...s.shifts, [b.key]: (s.shifts[b.key] ?? 0) + 1 } }))}
              >
                <IconNext size={17} />
              </button>
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
