import { useState } from 'react'
import { billsDueBetween, type BillOccurrence } from '../lib/budget'
import { addDays, shortDate, today, weekdayDate } from '../lib/dates'
import { money, uid } from '../lib/format'
import { enableNotifications, notificationsSupported } from '../lib/notify'
import { togglePaid, update, useStore } from '../lib/store'
import type { DateStr, Reminder } from '../lib/types'
import { IconBell, IconPlus, IconTrash } from '../components/icons'
import { Button, CheckCircle, Pill, SectionTitle, toast } from '../components/ui'

type Item = { kind: 'bill'; date: DateStr; bill: BillOccurrence } | { kind: 'reminder'; date: DateStr; reminder: Reminder }

interface Group {
  id: string
  title: string
  tone?: 'danger'
  items: Item[]
}

/**
 * Agenda: overdue reminders, then each of the next 7 days (bills due and reminders),
 * then reminders further out. Finished reminders sit in a collapsed "Completed" list.
 */
function buildAgenda(bills: BillOccurrence[], reminders: Reminder[], t: DateStr): Group[] {
  const week = addDays(t, 7)
  const items: Item[] = [
    ...bills.map((b) => ({ kind: 'bill' as const, date: b.due, bill: b })),
    ...reminders.filter((r) => !r.done).map((r) => ({ kind: 'reminder' as const, date: r.date, reminder: r })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind === 'bill' ? -1 : 1))

  const groups = new Map<string, Group>()
  const add = (id: string, title: string, item: Item, tone?: 'danger') => {
    if (!groups.has(id)) groups.set(id, { id, title, tone, items: [] })
    groups.get(id)!.items.push(item)
  }
  for (const it of items) {
    if (it.date < t) add('overdue', 'Overdue', it, 'danger')
    else if (it.date > week) add('later', 'Later', it)
    else if (it.date === t) add(it.date, `Today · ${shortDate(it.date)}`, it)
    else if (it.date === addDays(t, 1)) add(it.date, `Tomorrow · ${shortDate(it.date)}`, it)
    else add(it.date, weekdayDate(it.date), it)
  }
  return [...groups.values()]
}

export function RemindersScreen() {
  const state = useStore()
  const t = today()
  const [text, setText] = useState('')
  const [date, setDate] = useState(t)

  const bills = billsDueBetween(state, t, addDays(t, 7))
  const unpaid = bills.filter((b) => !b.paid)
  const openReminders = state.reminders.filter((r) => !r.done)
  const done = state.reminders.filter((r) => r.done).sort((a, b) => (a.date < b.date ? 1 : -1))
  const agenda = buildAgenda(bills, state.reminders, t)

  function add(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    update((s) => ({ ...s, reminders: [...s.reminders, { id: uid(), text: text.trim(), date, done: false }] }))
    setText('')
    toast(`Reminder set for ${date === t ? 'today' : shortDate(date)}`)
  }

  return (
    <div>
      <header className="px-1 pb-3">
        <h1 className="font-serif text-[28px] font-semibold tracking-tight">Reminders</h1>
        <p className="text-sm text-muted">
          {unpaid.length ? `${unpaid.length} ${unpaid.length === 1 ? 'bill' : 'bills'} due this week (${money(unpaid.reduce((n, b) => n + b.bill.amount, 0))})` : 'No unpaid bills this week'}
          {' · '}
          {openReminders.length ? `${openReminders.length} ${openReminders.length === 1 ? 'reminder' : 'reminders'}` : 'no reminders'}
        </p>
      </header>

      <form onSubmit={add} className="card flex flex-col gap-2 p-4" aria-label="New reminder">
        <input id="reminder-text" className="field" placeholder="Remind me to…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Reminder" maxLength={120} />
        <div className="flex gap-2">
          <input id="reminder-date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value || t)} aria-label="Reminder date" />
          <Button type="submit" disabled={!text.trim()} className="shrink-0">
            <IconPlus size={18} /> Add
          </Button>
        </div>
      </form>

      <SectionTitle>Coming up</SectionTitle>
      <div className="mb-2 flex gap-4 px-1 text-xs text-muted" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-warn" /> Bill due
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-info" /> Reminder
        </span>
      </div>

      {agenda.length === 0 ? (
        <p className="card p-5 text-center text-sm text-muted">Nothing coming up this week. Add a reminder above.</p>
      ) : (
        <div className="space-y-3">
          {agenda.map((g) => (
            <section key={g.id} className="card px-4 pt-3 pb-1" aria-label={g.title}>
              <h3 className={`flex items-center justify-between text-xs font-semibold tracking-wide uppercase ${g.tone === 'danger' ? 'text-danger' : 'text-muted'}`}>
                {g.title}
                <span className="font-medium normal-case">{g.items.length}</span>
              </h3>
              <ul className="divide-y divide-line">
                {g.items.map((it) =>
                  it.kind === 'bill' ? (
                    <BillRow key={it.bill.key} occ={it.bill} showDate={g.id === 'overdue' || g.id === 'later'} />
                  ) : (
                    <ReminderRow key={it.reminder.id} r={it.reminder} showDate={g.id === 'overdue' || g.id === 'later'} />
                  ),
                )}
              </ul>
            </section>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <details className="card group mt-3 overflow-hidden">
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold select-none">
            Completed ({done.length})
            <span className="text-muted transition-transform group-open:rotate-90" aria-hidden="true">
              ›
            </span>
          </summary>
          <ul className="divide-y divide-line border-t border-line px-4">
            {done.map((r) => (
              <ReminderRow key={r.id} r={r} showDate />
            ))}
          </ul>
          <div className="px-4 pb-3">
            <Button variant="ghost" className="w-full py-2 text-sm" onClick={() => update((s) => ({ ...s, reminders: s.reminders.filter((x) => !x.done) }))}>
              Clear completed
            </Button>
          </div>
        </details>
      )}

      <SectionTitle>Alerts</SectionTitle>
      <AlertsCard />
    </div>
  )
}

function BillRow({ occ, showDate }: { occ: BillOccurrence; showDate: boolean }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <CheckCircle checked={occ.paid} label={`Mark ${occ.bill.name} ${occ.paid ? 'unpaid' : 'paid'}`} onToggle={() => update((s) => ({ ...s, paid: togglePaid(s.paid, occ.key) }))} />
      <div className={`min-w-0 flex-1 ${occ.paid ? 'opacity-55' : ''}`}>
        <p className={`truncate font-medium ${occ.paid ? 'line-through' : ''}`}>{occ.bill.name}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <span className="size-1.5 rounded-full bg-warn" aria-hidden="true" />
          {occ.paid ? 'Paid' : 'Bill due'}
          {showDate && ` · ${shortDate(occ.due)}`}
        </p>
      </div>
      <span className="num font-semibold">{money(occ.bill.amount)}</span>
    </li>
  )
}

function ReminderRow({ r, showDate }: { r: Reminder; showDate: boolean }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <CheckCircle
        checked={r.done}
        label={`Mark ${r.text} ${r.done ? 'not done' : 'done'}`}
        onToggle={() => update((s) => ({ ...s, reminders: s.reminders.map((x) => (x.id === r.id ? { ...x, done: !x.done } : x)) }))}
      />
      <div className={`min-w-0 flex-1 ${r.done ? 'opacity-55' : ''}`}>
        <p className={`font-medium break-words ${r.done ? 'line-through' : ''}`}>{r.text}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <span className="size-1.5 rounded-full bg-info" aria-hidden="true" />
          Reminder
          {showDate && ` · ${shortDate(r.date)}`}
        </p>
      </div>
      <button
        className="press grid size-9 place-items-center rounded-full text-muted hover:bg-sunken hover:text-danger"
        aria-label={`Delete ${r.text}`}
        onClick={() => update((s) => ({ ...s, reminders: s.reminders.filter((x) => x.id !== r.id) }))}
      >
        <IconTrash size={18} />
      </button>
    </li>
  )
}

function AlertsCard() {
  const { notificationsOn } = useStore()
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-text">
          <IconBell size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">Bill due alerts</p>
            {notificationsOn && <Pill tone="good">On</Pill>}
          </div>
          <p className="text-sm text-muted">A heads-up 2 days before an unpaid bill is due, and your reminders on the day.</p>
        </div>
      </div>
      <div className="mt-3">
        {notificationsOn ? (
          <button className="text-sm font-semibold text-muted underline underline-offset-2" onClick={() => update((s) => ({ ...s, notificationsOn: false }))}>
            Turn off alerts
          </button>
        ) : (
          <Button
            variant="soft"
            className="w-full"
            disabled={!notificationsSupported()}
            onClick={async () => {
              const ok = await enableNotifications()
              toast(ok ? 'Alerts on' : 'Notifications are blocked in your browser settings')
            }}
          >
            {notificationsSupported() ? 'Turn on alerts' : 'Alerts aren’t available in this browser'}
          </Button>
        )}
        <p className="mt-2 text-xs text-muted">Alerts appear while Payday is open or added to your home screen.</p>
      </div>
    </div>
  )
}
