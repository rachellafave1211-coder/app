// Renders scripts/icon.svg to the PNG app icons in public/icons (run: node scripts/make-icons.mjs).
// Needs Playwright's Chromium; it isn't a project dependency because icons change rarely.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright')
const svg = readFileSync(new URL('./icon.svg', import.meta.url), 'utf8')

// [file, size, artwork scale]. Maskable icons keep the artwork inside the central 80% safe zone.
const icons = [
  ['apple-touch-icon.png', 180, 1],
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['maskable-512.png', 512, 0.78],
]

const browser = await chromium.launch()
const page = await browser.newPage()
for (const [file, size, scale] of icons) {
  await page.setViewportSize({ width: size, height: size })
  const scaled = svg.replace('scale(var(--s, 1))', `scale(${scale})`)
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${scaled}`)
  await page.screenshot({ path: new URL(`../public/icons/${file}`, import.meta.url).pathname })
  console.log('wrote', file)
}
await browser.close()
