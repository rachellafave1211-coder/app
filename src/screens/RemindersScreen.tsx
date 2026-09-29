import { useState } from 'react'
import { billsDueBetween } from '../lib/budget'
import { addDays, daysBetween, shortDate, today } from '../lib/dates'
import { money, uid } from '../lib/format'
import { enableNotifications, notificationsSupported } from '../lib/notify'
import { toggleFlag, update, useStore } from '../lib/store'
import { IconBell, IconPlus, IconTrash } from '../components/icons'
import { Button, CheckCircle, Pill, SectionTitle, toast } from '../components/ui'

export function RemindersScreen() {
  const state = useStore()
  const t = today()
  const [text, setText] = useState('')
  const [date, setDate] = useState(t)
  const upcoming = billsDueBetween(state, t, addDays(t, 7))
  const reminders = [...state.reminders].sort((a, b) => Number(a.done) - Number(b.done) || (a.date < b.date ? -1 : 1))

  function add(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    update((s) => ({ ...s, reminders: [...s.reminders, { id: uid(), text: text.trim(), date, done: false }] }))
    setText('')
  }

  const whenLabel = (d: string) => {
    const n = daysBetween(t, d)
    return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n < 0 ? `${-n}d ago` : `in ${n} days`
  }

  return (
    <div>
      <header className="px-1 pb-3">
        <h1 className="font-serif text-[28px] font-semibold tracking-tight">Reminders</h1>
      </header>

      <form onSubmit={add} className="card space-y-3 p-4">
        <input className="field" placeholder="Remind me to…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Reminder" maxLength={120} />
        <div className="flex gap-2">
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value || t)} aria-label="Reminder date" />
          <Button type="submit" disabled={!text.trim()} className="shrink-0">
            <IconPlus size={18} /> Add
          </Button>
        </div>
      </form>

      <SectionTitle>Bills due in the next 7 days</SectionTitle>
      <div className="card divide-y divide-line px-4">
        {upcoming.length === 0 && <p className="py-5 text-center text-sm text-muted">No bills due this week. Enjoy it. ✨</p>}
        {upcoming.map((b) => (
          <div key={b.key} className="flex items-center gap-3 py-3">
            <CheckCircle checked={b.paid} label={`Mark ${b.bill.name} paid`} onToggle={() => update((s) => ({ ...s, paid: toggleFlag(s.paid, b.key) }))} />
            <div className={`min-w-0 flex-1 ${b.paid ? 'opacity-55' : ''}`}>
              <p className={`font-medium ${b.paid ? 'line-through' : ''}`}>{b.bill.name}</p>
              <p className="text-xs text-muted">{shortDate(b.due)}</p>
            </div>
            <Pill tone={b.paid ? 'muted' : daysBetween(t, b.due) <= 1 ? 'danger' : 'accent'}>{b.paid ? 'Paid' : whenLabel(b.due)}</Pill>
            <span className="num w-20 text-right font-semibold">{money(b.bill.amount)}</span>
          </div>
        ))}
      </div>

      <SectionTitle>Your reminders</SectionTitle>
      <div className="card divide-y divide-line px-4">
        {reminders.length === 0 && <p className="py-5 text-center text-sm text-muted">No reminders yet.</p>}
        {reminders.map((r) => (
          <div key={r.id} className="flex items-center gap-3 py-3">
            <CheckCircle
              checked={r.done}
              label={`Mark ${r.text} ${r.done ? 'not done' : 'done'}`}
              onToggle={() => update((s) => ({ ...s, reminders: s.reminders.map((x) => (x.id === r.id ? { ...x, done: !x.done } : x)) }))}
            />
            <div className={`min-w-0 flex-1 ${r.done ? 'opacity-55' : ''}`}>
              <p className={`font-medium break-words ${r.done ? 'line-through' : ''}`}>{r.text}</p>
              <p className={`text-xs ${!r.done && r.date < t ? 'font-semibold text-danger' : 'text-muted'}`}>
                {shortDate(r.date)} · {whenLabel(r.date)}
              </p>
            </div>
            <button
              className="press grid size-9 place-items-center rounded-full text-muted hover:bg-sunken hover:text-danger"
              aria-label={`Delete ${r.text}`}
              onClick={() => update((s) => ({ ...s, reminders: s.reminders.filter((x) => x.id !== r.id) }))}
            >
              <IconTrash size={18} />
            </button>
          </div>
        ))}
      </div>

      <SectionTitle>Alerts</SectionTitle>
      <div className="card p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-text">
            <IconBell size={20} />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Bill due alerts</p>
            <p className="text-sm text-muted">
              A heads-up 2 days before unpaid bills are due, plus your reminders on the day. Works while Payday is open or installed to your home screen.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          {state.notificationsOn ? (
            <>
              <Pill tone="good">On</Pill>
              <button className="ml-auto text-sm font-semibold text-muted" onClick={() => update((s) => ({ ...s, notificationsOn: false }))}>
                Turn off
              </button>
            </>
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
              {notificationsSupported() ? 'Turn on notifications' : 'Not supported on this browser'}
            </Button>
          )}
        </div>
        <p className="mt-3 text-xs text-muted">Email alerts arrive with account sync.</p>
      </div>
    </div>
  )
}
