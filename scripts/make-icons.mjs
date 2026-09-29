// Builds the app icons in public/icons from scripts/icon-source.png (a square, opaque image).
// Run: PLAYWRIGHT_PATH=<path to playwright> node scripts/make-icons.mjs
// Playwright isn't a project dependency because icons change rarely.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright')
// Top fraction of the source that is plain background (no artwork), used to extend it.
const BAND = Number(process.env.ICON_BAND ?? 0.15)
const source = 'data:image/png;base64,' + readFileSync(new URL('./icon-source.png', import.meta.url)).toString('base64')

// [file, size, artwork scale]. The maskable icon shrinks the artwork into Android's central safe
// circle (so round or squircle masks never clip it) and continues the background out to the edges.
const icons = [
  ['favicon-64.png', 64, 1],
  ['apple-touch-icon.png', 180, 1],
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['maskable-512.png', 512, 0.66],
]

const browser = await chromium.launch()
const page = await browser.newPage()
for (const [file, size, scale] of icons) {
  const dataUrl = await page.evaluate(
    async ({ source, size, scale, BAND }) => {
      const img = new Image()
      img.src = source
      await img.decode()
      const c = document.createElement('canvas')
      c.width = c.height = size
      const ctx = c.getContext('2d')
      ctx.imageSmoothingQuality = 'high'
      const s = size * scale
      const o = (size - s) / 2
      if (scale < 1) {
        // Background behind the shrunken image: the source's top band (plain background above the
        // artwork) stretched to full height, then mirrored out to the left and right edges.
        const band = img.height * BAND
        ctx.drawImage(img, 0, 0, img.width, band, o, 0, s, size)
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(c, o, 0, o, size, -o, 0, o, size)
        ctx.drawImage(c, o + s - o, 0, o, size, -(o + s + o), 0, o, size)
        ctx.restore()
      }
      ctx.drawImage(img, o, o, s, s)
      return c.toDataURL('image/png')
    },
    { source, size, scale, BAND },
  )
  writeFileSync(new URL(`../public/icons/${file}`, import.meta.url), Buffer.from(dataUrl.split(',')[1], 'base64'))
  console.log('wrote', file)
}
await browser.close()
