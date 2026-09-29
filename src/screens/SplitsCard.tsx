import { occurrenceKey } from '../lib/budget'
import { dateInMonth, shortDate } from '../lib/dates'
import { money, round2 } from '../lib/format'
import { toggleFlag, update, useStore } from '../lib/store'
import type { MonthKey } from '../lib/types'
import { CheckCircle, SectionTitle } from '../components/ui'

/** Who owes you what for shared bills this month. */
export function SplitsCard({ month }: { month: MonthKey }) {
  const state = useStore()
  const members = state.household.members
  const splitBills = state.bills.filter((b) => b.splitWith?.some((id) => members.some((m) => m.id === id)))
  if (!splitBills.length) return null

  let owed = 0
  const rows = splitBills.map((bill) => {
    const people = members.filter((m) => bill.splitWith!.includes(m.id))
    const share = round2(bill.amount / (people.length + 1))
    return {
      bill,
      share,
      people: people.map((m) => {
        const key = `${occurrenceKey(bill.id, month)}@${m.id}`
        const settled = !!state.settled[key]
        if (!settled) owed += share
        return { m, key, settled }
      }),
    }
  })

  return (
    <>
      <SectionTitle action={<span className="text-sm text-muted">{owed > 0 ? `${money(owed)} owed to you` : 'All settled'}</span>}>
        {state.household.name}
      </SectionTitle>
      <div className="card space-y-4 p-5">
        {rows.map(({ bill, share, people }) => (
          <div key={bill.id}>
            <div className="flex items-baseline justify-between">
              <p className="font-semibold">{bill.name}</p>
              <p className="text-sm text-muted">
                {money(bill.amount)} ÷ {people.length + 1} · due {shortDate(dateInMonth(month, bill.day))}
              </p>
            </div>
            <ul className="mt-1">
              {people.map(({ m, key, settled }) => (
                <li key={key} className="flex items-center gap-3 py-1.5">
                  <CheckCircle checked={settled} label={`${m.name} paid their share`} onToggle={() => update((s) => ({ ...s, settled: toggleFlag(s.settled, key) }))} />
                  <span className={`flex-1 ${settled ? 'text-muted line-through' : ''}`}>{m.name} {settled ? 'paid' : 'owes you'}</span>
                  <span className="num font-semibold">{money(share)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  )
}
