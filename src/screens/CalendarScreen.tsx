import { useMemo, useState } from 'react'
import { billsDueBetween, categoryById, payInstances } from '../lib/budget'
import { addMonths, dateInMonth, daysInMonth, monthShort, parseMonth, thisMonth, today, weekdayDate } from '../lib/dates'
import { money } from '../lib/format'
import { togglePaid, update, useStore } from '../lib/store'
import type { DateStr } from '../lib/types'
import { CheckCircle, MonthSwitcher } from '../components/ui'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarScreen() {
  const state = useStore()
  const [month, setMonth] = useState(thisMonth())
  const [selected, setSelected] = useState<DateStr>(today())
  const t = today()

  const { year, month0 } = parseMonth(month)
  const first = new Date(year, month0, 1).getDay()
  const count = daysInMonth(year, month0)
  const start = dateInMonth(month, 1)
  const end = dateInMonth(month, 31)

  const marks = useMemo(() => {
    const pays = new Map(payInstances(state.paychecks, month, month).map((p) => [p.date, p.paycheck.amount]))
    const bills = new Map<DateStr, string[]>()
    for (const b of billsDueBetween(state, start, end)) bills.set(b.due, [...(bills.get(b.due) ?? []), b.bill.name])
    const rems = new Map<DateStr, string[]>()
    for (const r of state.reminders) if (!r.done) rems.set(r.date, [...(rems.get(r.date) ?? []), r.text])
    return { pays, bills, rems }
  }, [state, month, start, end])

  const selPay = payInstances(state.paychecks, selected.slice(0, 7), selected.slice(0, 7)).filter((p) => p.date === selected)
  const selBills = billsDueBetween(state, selected, selected)
  const selRems = state.reminders.filter((r) => r.date === selected)
  const selExp = state.expenses.filter((e) => e.date === selected)
  const nothing = !selPay.length && !selBills.length && !selRems.length && !selExp.length
  const rows = Math.ceil((first + count) / 7)

  return (
    <div>
      <header className="flex h-13 items-center justify-between px-1">
        <h1 className="font-serif text-[28px] font-semibold tracking-tight">Calendar</h1>
        <MonthSwitcher
          label={monthShort(month)}
          onPrev={() => setMonth(addMonths(month, -1))}
          onNext={() => setMonth(addMonths(month, 1))}
          onToday={() => {
            setMonth(thisMonth())
            setSelected(t)
          }}
        />
      </header>

      <div className="flex flex-col gap-5 lg:flex-row">
      <section className="cal-fill card flex min-w-0 flex-col p-2 sm:p-4 lg:flex-1">
        <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted" aria-hidden="true">
          {WEEKDAYS.map((d, i) => (
            <div key={i} className="py-1">
              <span className="sm:hidden">{d[0]}</span>
              <span className="hidden sm:inline">{d}</span>
            </div>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-7 gap-1" style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }} role="grid" aria-label={monthShort(month)}>
          {Array.from({ length: first }, (_, i) => (
            <div key={`b${i}`} />
          ))}
          {Array.from({ length: count }, (_, i) => {
            const date = dateInMonth(month, i + 1)
            const isSel = date === selected
            const isToday = date === t
            const pay = marks.pays.get(date)
            const bills = marks.bills.get(date) ?? []
            const rems = marks.rems.get(date) ?? []
            const desc = [pay !== undefined && 'payday', bills.length && 'bills due', rems.length && 'reminder'].filter(Boolean).join(', ')
            return (
              <button
                key={date}
                role="gridcell"
                aria-selected={isSel}
                aria-label={`${weekdayDate(date)}${desc ? `: ${desc}` : ''}`}
                onClick={() => setSelected(date)}
                className={`press flex min-h-0 min-w-0 flex-col items-center overflow-hidden rounded-xl p-1 md:items-stretch md:rounded-2xl md:p-2 ${
                  isSel ? 'bg-accent text-on-accent' : isToday ? 'bg-accent-soft text-accent-text' : 'bg-sunken/50 hover:bg-sunken'
                }`}
              >
                <span className={`text-[15px] leading-6 md:text-left ${isSel || isToday ? 'font-bold' : 'font-medium'}`}>{i + 1}</span>
                <span className="mt-0.5 flex h-1.5 gap-0.5 md:hidden">
                  {pay !== undefined && <Dot className={isSel ? 'bg-on-accent' : 'bg-accent'} />}
                  {bills.length > 0 && <Dot className={isSel ? 'bg-on-accent/80' : 'bg-warn'} />}
                  {rems.length > 0 && <Dot className={isSel ? 'bg-on-accent/60' : 'bg-info'} />}
                </span>
                <span className="mt-1 hidden min-h-0 flex-col gap-0.5 overflow-hidden text-left text-[11px] leading-4 font-medium md:flex">
                  {pay !== undefined && <Chip dot={isSel ? 'bg-on-accent' : 'bg-accent'} text={`Payday ${money(pay)}`} />}
                  {bills.map((n, j) => (
                    <Chip key={`b${j}`} dot={isSel ? 'bg-on-accent/80' : 'bg-warn'} text={n} />
                  ))}
                  {rems.map((n, j) => (
                    <Chip key={`r${j}`} dot={isSel ? 'bg-on-accent/60' : 'bg-info'} text={n} />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
          <Legend className="bg-accent" label="Payday" />
          <Legend className="bg-warn" label="Bill due" />
          <Legend className="bg-info" label="Reminder" />
        </div>
      </section>

      <section className="lg:cal-fill min-w-0 lg:w-80 lg:shrink-0 lg:overflow-y-auto xl:w-96">
        <h2 className="px-1 font-serif text-xl font-semibold">{weekdayDate(selected)}</h2>
        <div className="mt-3 space-y-3">
          {nothing && <p className="card p-5 text-center text-sm text-muted">Nothing on this day.</p>}
          {selPay.map((p) => (
            <div key={p.paycheck.id} className="card flex items-center justify-between bg-accent-soft p-4">
              <div>
                <p className="text-sm font-semibold text-accent-text">💸 Payday</p>
                <p className="text-xs text-muted">covers until {weekdayDate(p.end)}</p>
              </div>
              <p className="num text-2xl font-semibold">{money(p.paycheck.amount)}</p>
            </div>
          ))}
          {selBills.length > 0 && (
            <Group title="Bills due">
              {selBills.map((b) => (
                <Row key={b.key}>
                  <CheckCircle checked={b.paid} label={`Mark ${b.bill.name} paid`} onToggle={() => update((s) => ({ ...s, paid: togglePaid(s.paid, b.key) }))} />
                  <span className={`flex-1 font-medium ${b.paid ? 'text-muted line-through' : ''}`}>{b.bill.name}</span>
                  <span className="num font-semibold">{money(b.bill.amount)}</span>
                </Row>
              ))}
            </Group>
          )}
          {selRems.length > 0 && (
            <Group title="Reminders">
              {selRems.map((r) => (
                <Row key={r.id}>
                  <CheckCircle
                    checked={r.done}
                    label={`Mark ${r.text} done`}
                    onToggle={() => update((s) => ({ ...s, reminders: s.reminders.map((x) => (x.id === r.id ? { ...x, done: !x.done } : x)) }))}
                  />
                  <span className={`flex-1 font-medium ${r.done ? 'text-muted line-through' : ''}`}>{r.text}</span>
                </Row>
              ))}
            </Group>
          )}
          {selExp.length > 0 && (
            <Group title="Spending">
              {selExp.map((e) => {
                const c = categoryById(state.categories, e.categoryId)
                return (
                  <Row key={e.id}>
                    <span className="grid size-7 place-items-center" aria-hidden="true">
                      {c?.emoji ?? '•'}
                    </span>
                    <span className="flex-1 font-medium">{e.note || c?.name || 'Expense'}</span>
                    <span className="num font-semibold">{money(e.amount)}</span>
                  </Row>
                )
              })}
            </Group>
          )}
        </div>
      </section>
      </div>
    </div>
  )
}

const Chip = ({ dot, text }: { dot: string; text: string }) => (
  <span className="flex min-w-0 items-center gap-1">
    <span className={`size-1.5 shrink-0 rounded-full ${dot}`} />
    <span className="truncate">{text}</span>
  </span>
)

const Dot = ({ className }: { className: string }) => <span className={`size-1.5 rounded-full ${className}`} />

const Legend = ({ className, label }: { className: string; label: string }) => (
  <span className="flex items-center gap-1.5">
    <span className={`size-2 rounded-full ${className}`} /> {label}
  </span>
)

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card px-4 pt-3 pb-1">
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
      <ul className="divide-y divide-line">{children}</ul>
    </div>
  )
}

const Row = ({ children }: { children: React.ReactNode }) => <li className="flex items-center gap-3 py-2.5">{children}</li>
