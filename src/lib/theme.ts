import type { Theme } from './types'

export const PRESETS: { name: string; color: string }[] = [
  { name: 'Berry', color: '#d6457a' },
  { name: 'Evergreen', color: '#1c4a44' },
  { name: 'Ocean', color: '#2f6fdb' },
  { name: 'Sage', color: '#3f8a63' },
  { name: 'Tangerine', color: '#e0662a' },
  { name: 'Plum', color: '#7d4fd6' },
  { name: 'Ink', color: '#2e3445' },
]

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function isValidHex(s: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)
}

/** Text color that reads well on top of the accent. */
export function onAccent(hex: string): string {
  const l = luminance(hex)
  const vsWhite = 1.05 / (l + 0.05)
  const vsInk = (l + 0.05) / 0.0625
  // Lean toward white text; it suits the brand look on mid-tone accents.
  return vsInk > vsWhite * 1.3 ? '#1b1d24' : '#ffffff'
}

export function resolvedDark(mode: Theme['mode']): boolean {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
}

/** Write theme tokens onto <html>; every color in the UI derives from these. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  const accent = isValidHex(theme.accent) ? theme.accent : '#d6457a'
  const dark = resolvedDark(theme.mode)
  root.dataset.theme = dark ? 'dark' : 'light'
  root.style.setProperty('--accent', accent)
  root.style.setProperty('--on-accent', onAccent(accent))
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#121319' : '#f4f5f8')
}
