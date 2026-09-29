import { useEffect, useRef, useState, type ReactNode } from 'react'
import { IconCheck, IconChevronL, IconChevronR, IconX } from './icons'

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="anim-fade absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        className="anim-sheet relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-card px-5 pt-3 pb-safe shadow-2xl outline-none"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl font-semibold">{title}</h2>
          <button onClick={onClose} className="press grid size-9 place-items-center rounded-full bg-sunken text-muted" aria-label="Close">
            <IconX size={18} />
          </button>
        </div>
        <div className="pb-6">{children}</div>
      </div>
    </div>
  )
}

export function Ring({ value, size = 132, stroke = 12, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-on-accent/25" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className="stroke-on-accent"
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(.2,.9,.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

export function Bar({ value, danger }: { value: number; danger?: boolean }) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="h-2 overflow-hidden rounded-full bg-sunken">
      <div className={`h-full rounded-full ${danger ? 'bg-danger' : 'bg-accent'}`} style={{ width: `${v * 100}%`, transition: 'width 500ms cubic-bezier(.2,.9,.3,1)' }} />
    </div>
  )
}

export function Pill({ tone, children }: { tone: 'good' | 'danger' | 'accent' | 'muted'; children: ReactNode }) {
  const cls = {
    good: 'bg-good/15 text-good',
    danger: 'bg-danger/15 text-danger',
    accent: 'bg-accent-soft text-accent-text',
    muted: 'bg-sunken text-muted',
  }[tone]
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${cls}`}>{children}</span>
}

export function CheckCircle({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      onClick={onToggle}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={`press grid size-7 shrink-0 place-items-center rounded-full border-2 ${checked ? 'anim-check border-accent bg-accent text-on-accent' : 'border-line text-transparent'}`}
    >
      <IconCheck size={15} strokeWidth={3} />
    </button>
  )
}

export function MonthSwitcher({ label, onPrev, onNext, onToday }: { label: string; onPrev: () => void; onNext: () => void; onToday?: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={onPrev} className="press grid size-10 place-items-center rounded-full text-muted hover:bg-sunken" aria-label="Previous month">
        <IconChevronL />
      </button>
      <button onClick={onToday} className="min-w-22 text-center font-semibold whitespace-nowrap" aria-label={`${label}. Jump to this month`}>
        {label}
      </button>
      <button onClick={onNext} className="press grid size-10 place-items-center rounded-full text-muted hover:bg-sunken" aria-label="Next month">
        <IconChevronR />
      </button>
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex rounded-2xl bg-sunken p-1" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`press flex-1 rounded-xl py-2 text-sm font-semibold ${value === o.value ? 'bg-card text-ink shadow-card' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-7 mb-3 flex items-end justify-between px-1">
      <h2 className="font-serif text-xl font-semibold">{children}</h2>
      {action}
    </div>
  )
}

export function Button({ children, variant = 'primary', className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'ghost' | 'danger' }) {
  const cls = {
    primary: 'bg-accent text-on-accent',
    soft: 'bg-accent-soft text-accent-text',
    ghost: 'bg-sunken text-ink',
    danger: 'bg-danger/12 text-danger',
  }[variant]
  return (
    <button {...rest} className={`press inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold disabled:opacity-50 ${cls} ${className}`}>
      {children}
    </button>
  )
}

// A tiny global toast.
let pushToast: (msg: string) => void = () => {}
export const toast = (msg: string) => pushToast(msg)

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    pushToast = (m) => {
      setMsg(m)
      clearTimeout(t)
      t = setTimeout(() => setMsg(null), 2400)
    }
    return () => clearTimeout(t)
  }, [])
  if (!msg) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center pt-safe" role="status" aria-live="polite">
      <div className="anim-pop mt-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-bg shadow-lg">{msg}</div>
    </div>
  )
}
