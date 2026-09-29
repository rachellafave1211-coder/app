import { billsDueBetween } from './budget'
import { addDays, today } from './dates'
import { money } from './format'
import { getState, update } from './store'

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function enableNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  const ok = perm === 'granted'
  update((s) => ({ ...s, notificationsOn: ok }))
  if (ok) checkAndNotify()
  return ok
}

async function show(title: string, body: string, tag: string) {
  const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined)
  if (reg) await reg.showNotification(title, { body, tag, icon: '/icons/icon-192.png' })
  else new Notification(title, { body, tag, icon: '/icons/icon-192.png' })
}

/**
 * Local notifications while Payday is open or installed: unpaid bills due within
 * 2 days and reminders due today. Each fires once.
 */
export function checkAndNotify(): void {
  const s = getState()
  if (!s.notificationsOn || !notificationsSupported() || Notification.permission !== 'granted') return
  const t = today()
  const sent: Record<string, true> = {}
  for (const occ of billsDueBetween(s, t, addDays(t, 2))) {
    const tag = `bill:${occ.key}`
    if (occ.paid || s.notified[tag]) continue
    const when = occ.due === t ? 'today' : occ.due === addDays(t, 1) ? 'tomorrow' : 'in 2 days'
    void show(`${occ.bill.name} is due ${when}`, `${money(occ.bill.amount)} — tap to check it off in Payday`, tag)
    sent[tag] = true
  }
  for (const r of s.reminders) {
    const tag = `rem:${r.id}`
    if (r.done || r.date !== t || s.notified[tag]) continue
    void show('Payday reminder', r.text, tag)
    sent[tag] = true
  }
  if (Object.keys(sent).length) update((st) => ({ ...st, notified: { ...st.notified, ...sent } }))
}
