import { useEffect, useMemo, useState } from 'react'
import { billsDueBetween, categoryById, payInstances } from '../lib/budget'
import { addMonths, dateInMonth, daysInMonth, monthShort, parseMonth, shortDate, thisMonth, today, weekdayDate } from '../lib/dates'
import { money, uid } from '../lib/format'
import { togglePaid, update, useStore } from '../lib/store'
import type { DateStr, Task } from '../lib/types'
import { IconPlus, IconTrash, IconX } from '../components/icons'
import { Button, CheckCircle, MonthSwitcher, SectionTitle } from '../components/ui'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function CalendarScreen() {
  const state = useStore()
  const [month, setMonth] = useState(thisMonth())
  /** The day being looked at; null shows no day details, and new tasks get no due date by default. */
  const [selected, setSelected] = useState<DateStr | null>(null)
  const t = today()

  const { year, month0 } = parseMonth(month)
  const first = new Date(year, month0, 1).getDay()
  const count = daysInMonth(year, month0)
  const start = dateInMonth(month, 1)
  const end = dateInMonth(month, 31)

  const marks = useMemo(() => {
    const pays = new Set(payInstances(state.paychecks, month, month).map((p) => p.date))
    const bills = new Set(billsDueBetween(state, start, end).map((b) => b.due))
    const rems = new Set(state.reminders.filter((r) => !r.done).map((r) => r.date))
    const tasks = new Set(state.tasks.filter((x) => !x.done && x.due).map((x) => x.due!))
    return { pays, bills, rems, tasks }
  }, [state, month, start, end])

  return (
    <div>
      <header className="flex items-center justify-between px-1 pb-3">
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

      <section className="card p-3">
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-muted" aria-hidden="true">
          {WEEKDAYS.map((d, i) => (
            <div key={i} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5" role="grid" aria-label={monthShort(month)}>
          {Array.from({ length: first }, (_, i) => (
            <div key={`b${i}`} />
          ))}
          {Array.from({ length: count }, (_, i) => {
            const date = dateInMonth(month, i + 1)
            const isSel = date === selected
            const isToday = date === t
            const pay = marks.pays.has(date)
            const bill = marks.bills.has(date)
            const rem = marks.rems.has(date)
            const task = marks.tasks.has(date)
            const desc = [pay && 'payday', bill && 'bills due', rem && 'reminder', task && 'task due'].filter(Boolean).join(', ')
            return (
              <button
                key={date}
                role="gridcell"
                aria-selected={isSel}
                aria-label={`${weekdayDate(date)}${desc ? `: ${desc}` : ''}`}
                onClick={() => setSelected(isSel ? null : date)}
                className={`press mx-auto flex aspect-square w-full max-w-10 flex-col items-center justify-center rounded-xl ${
                  isSel ? 'bg-accent text-on-accent' : isToday ? 'bg-accent-soft text-accent-text' : 'hover:bg-sunken'
                }`}
              >
                <span className={`text-sm leading-5 ${isSel || isToday ? 'font-bold' : 'font-medium'}`}>{i + 1}</span>
                <span className="flex h-1.5 gap-0.5">
                  {pay && <Dot className={isSel ? 'bg-on-accent' : 'bg-accent'} />}
                  {bill && <Dot className={isSel ? 'bg-on-accent/85' : 'bg-warn'} />}
                  {rem && <Dot className={isSel ? 'bg-on-accent/70' : 'bg-info'} />}
                  {task && <Dot className={isSel ? 'bg-on-accent/55' : 'bg-good'} />}
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-muted">
          <Legend className="bg-accent" label="Payday" />
          <Legend className="bg-warn" label="Bill due" />
          <Legend className="bg-info" label="Reminder" />
          <Legend className="bg-good" label="Task" />
        </div>
      </section>

      {selected ? <DayDetails date={selected} onClear={() => setSelected(null)} /> : <p className="mt-3 px-1 text-sm text-muted">Tap a day to see its paycheck, bills, reminders and tasks.</p>}

      <TodoList selected={selected} />
    </div>
  )
}

function DayDetails({ date, onClear }: { date: DateStr; onClear: () => void }) {
  const state = useStore()
  const pays = payInstances(state.paychecks, date.slice(0, 7), date.slice(0, 7)).filter((p) => p.date === date)
  const bills = billsDueBetween(state, date, date)
  const rems = state.reminders.filter((r) => r.date === date)
  const tasks = state.tasks.filter((x) => x.due === date)
  const spent = state.expenses.filter((e) => e.date === date)
  const nothing = !pays.length && !bills.length && !rems.length && !tasks.length && !spent.length

  return (
    <section className="mt-4" aria-label={`Details for ${weekdayDate(date)}`}>
      <div className="flex items-center justify-between px-1">
        <h2 className="font-serif text-xl font-semibold">{weekdayDate(date)}</h2>
        <button onClick={onClear} className="press grid size-8 place-items-center rounded-full text-muted hover:bg-sunken" aria-label="Close day">
          <IconX size={16} />
        </button>
      </div>
      <div className="mt-2 space-y-3">
        {nothing && <p className="card p-4 text-center text-sm text-muted">Nothing on this day. Add a task below to plan something.</p>}
        {pays.map((p) => (
          <div key={p.paycheck.id} className="card flex items-center justify-between bg-accent-soft p-4">
            <div>
              <p className="text-sm font-semibold text-accent-text">💸 Payday</p>
              <p className="text-xs text-muted">covers until {weekdayDate(p.end)}</p>
            </div>
            <p className="num text-2xl font-semibold">{money(p.paycheck.amount)}</p>
          </div>
        ))}
        {bills.length > 0 && (
          <Group title="Bills due">
            {bills.map((b) => (
              <Row key={b.key}>
                <CheckCircle checked={b.paid} label={`Mark ${b.bill.name} paid`} onToggle={() => update((s) => ({ ...s, paid: togglePaid(s.paid, b.key) }))} />
                <span className={`flex-1 font-medium ${b.paid ? 'text-muted line-through' : ''}`}>{b.bill.name}</span>
                <span className="num font-semibold">{money(b.bill.amount)}</span>
              </Row>
            ))}
          </Group>
        )}
        {tasks.length > 0 && (
          <Group title="Tasks">
            {tasks.map((x) => (
              <TaskRow key={x.id} task={x} showDate={false} />
            ))}
          </Group>
        )}
        {rems.length > 0 && (
          <Group title="Reminders">
            {rems.map((r) => (
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
        {spent.length > 0 && (
          <Group title="Spending">
            {spent.map((e) => {
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
  )
}

/** To-do list: open tasks first (soonest due first), then finished ones. */
function TodoList({ selected }: { selected: DateStr | null }) {
  const { tasks } = useStore()
  const [title, setTitle] = useState('')
  const [due, setDue] = useState<DateStr | ''>('')

  // Picking a day makes it the new task's due date; the person can still change or clear it.
  useEffect(() => setDue(selected ?? ''), [selected])

  const sorted = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    const ad = a.due ?? '9999'
    const bd = b.due ?? '9999'
    return ad < bd ? -1 : ad > bd ? 1 : a.title.localeCompare(b.title)
  })
  const open = tasks.filter((x) => !x.done).length

  function add(e: React.FormEvent) {
    e.preventDefault()
    const text = title.trim()
    if (!text) return
    const task: Task = { id: uid(), title: text, done: false, ...(due ? { due } : {}) }
    update((s) => ({ ...s, tasks: [...s.tasks, task] }))
    setTitle('')
  }

  return (
    <section aria-label="To-do list">
      <SectionTitle action={<span className="text-sm text-muted">{open ? `${open} to do` : 'All done'}</span>}>To-do</SectionTitle>
      <div className="card p-4">
        <form onSubmit={add} className="space-y-2">
          <div className="flex gap-2">
            <input id="task-title" className="field" placeholder="Add task" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} aria-label="Task title" />
            <Button type="submit" disabled={!title.trim()} className="shrink-0 px-3" aria-label="Add task">
              <IconPlus size={18} />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="task-due" className="shrink-0 text-sm text-muted">
              Due
            </label>
            <input id="task-due" type="date" className="field py-2 text-sm" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date (optional)" />
            {due && (
              <button type="button" onClick={() => setDue('')} className="press shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-muted hover:bg-sunken">
                No date
              </button>
            )}
          </div>
        </form>

        <ul className="mt-3 divide-y divide-line">
          {sorted.length === 0 && <li className="py-4 text-center text-sm text-muted">No tasks yet. Add one above.</li>}
          {sorted.map((x) => (
            <TaskRow key={x.id} task={x} showDate />
          ))}
        </ul>
      </div>
    </section>
  )
}

function TaskRow({ task, showDate }: { task: Task; showDate: boolean }) {
  const t = today()
  const overdue = !task.done && !!task.due && task.due < t
  return (
    <li className="flex items-center gap-3 py-2.5">
      <CheckCircle
        checked={task.done}
        label={`Mark ${task.title} ${task.done ? 'not done' : 'done'}`}
        onToggle={() => update((s) => ({ ...s, tasks: s.tasks.map((x) => (x.id === task.id ? { ...x, done: !x.done } : x)) }))}
      />
      <div className={`min-w-0 flex-1 ${task.done ? 'opacity-55' : ''}`}>
        <p className={`font-medium break-words ${task.done ? 'line-through' : ''}`}>{task.title}</p>
        {showDate && task.due && (
          <p className={`text-xs ${overdue ? 'font-semibold text-danger' : 'text-muted'}`}>
            {task.due === t ? 'Due today' : `${overdue ? 'Overdue · ' : 'Due '}${shortDate(task.due)}`}
          </p>
        )}
      </div>
      <button
        className="press grid size-9 place-items-center rounded-full text-muted hover:bg-sunken hover:text-danger"
        aria-label={`Delete ${task.title}`}
        onClick={() => update((s) => ({ ...s, tasks: s.tasks.filter((x) => x.id !== task.id) }))}
      >
        <IconTrash size={18} />
      </button>
    </li>
  )
}

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
