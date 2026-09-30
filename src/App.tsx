import { useEffect, useState } from 'react'
import { readLink, type LinkPayload } from './lib/links'
import { checkAndNotify } from './lib/notify'
import { startSync } from './lib/sync'
import { useStore } from './lib/store'
import { applyTheme } from './lib/theme'
import { IconBell, IconCalendar, IconPlus, IconSettings, IconWallet } from './components/icons'
import { Toaster } from './components/ui'
import { AddExpenseSheet } from './screens/AddExpenseSheet'
import { BudgetScreen } from './screens/BudgetScreen'
import { CalendarScreen } from './screens/CalendarScreen'
import { LinkSheet } from './screens/LinkSheet'
import { ConflictSheet } from './screens/SyncSection'
import { RemindersScreen } from './screens/RemindersScreen'
import { SettingsScreen, type SettingsSection } from './screens/SettingsScreen'

type Tab = 'budget' | 'calendar' | 'reminders' | 'settings'

export default function App() {
  const state = useStore()
  const [tab, setTab] = useState<Tab>('budget')
  const [adding, setAdding] = useState(false)
  const [link, setLink] = useState<LinkPayload | null>(null)

  useEffect(() => {
    applyTheme(state.theme)
    if (state.theme.mode !== 'auto') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const on = () => applyTheme(state.theme)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [state.theme])

  // Shared links (#theme=…, #template=…, #household=…).
  useEffect(() => {
    const read = () => {
      const p = readLink(location.hash)
      if (!p) return // Leave other hashes alone, e.g. the sign-in link's token.
      setLink(p)
      history.replaceState(null, '', location.pathname + location.search)
    }
    read()
    addEventListener('hashchange', read)
    return () => removeEventListener('hashchange', read)
  }, [])

  useEffect(() => startSync(), [])

  // Local bill and reminder alerts.
  useEffect(() => {
    checkAndNotify()
    const id = setInterval(checkAndNotify, 30 * 60 * 1000)
    const onVis = () => document.visibilityState === 'visible' && checkAndNotify()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const [settingsFocus, setSettingsFocus] = useState<SettingsSection | null>(null)
  const go = (t: Tab, section: SettingsSection | null = null) => {
    setSettingsFocus(section)
    setTab(t)
    scrollTo({ top: 0 })
  }

  return (
    <div className="min-h-dvh">
      <main className="pt-safe mx-auto max-w-md px-4 pb-32">
        {tab === 'budget' && <BudgetScreen onGoSettings={(section) => go('settings', section)} />}
        {tab === 'calendar' && <CalendarScreen />}
        {tab === 'reminders' && <RemindersScreen />}
        {tab === 'settings' && <SettingsScreen focus={settingsFocus} />}
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/85 backdrop-blur-xl" aria-label="Main">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-1.5 pb-1.5">
          <TabBtn icon={<IconWallet />} label="Budget" on={tab === 'budget'} onClick={() => go('budget')} />
          <TabBtn icon={<IconCalendar />} label="Calendar" on={tab === 'calendar'} onClick={() => go('calendar')} />
          <div className="flex justify-center">
            <button
              onClick={() => setAdding(true)}
              aria-label="Add expense"
              className="press -mt-7 grid size-16 place-items-center rounded-full bg-accent text-on-accent shadow-[0_10px_24px_-8px_var(--accent)] ring-4 ring-bg"
            >
              <IconPlus size={28} strokeWidth={2.4} />
            </button>
          </div>
          <TabBtn icon={<IconBell />} label="Reminders" on={tab === 'reminders'} onClick={() => go('reminders')} />
          <TabBtn icon={<IconSettings />} label="Settings" on={tab === 'settings'} onClick={() => go('settings')} />
        </div>
      </nav>

      <AddExpenseSheet open={adding} onClose={() => setAdding(false)} />
      <LinkSheet payload={link} onClose={() => setLink(null)} />
      <ConflictSheet />
      <Toaster />
    </div>
  )
}

function TabBtn({ icon, label, on, onClick }: { icon: React.ReactNode; label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-current={on ? 'page' : undefined} className={`press flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-semibold ${on ? 'text-accent-text' : 'text-muted'}`}>
      {icon}
      {label}
    </button>
  )
}
