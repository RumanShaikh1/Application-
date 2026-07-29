// node scripts/interact-sandbox-round2.mjs
// Round 2: keyboard-only navigation from the list to a detail page, and an
// unknown-symbol edge case on the detail route.
import puppeteer from 'puppeteer'
import { mkdir, readdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../../temporary screenshots')
await mkdir(outDir, { recursive: true })
const baseUrl = process.env.WEB_BASE_URL ?? 'http://localhost:5173'

async function nextFileName(label) {
  const existing = await readdir(outDir)
  const nextNumber =
    existing.reduce((max, name) => {
      const match = name.match(/^screenshot-(\d+)/)
      return match ? Math.max(max, Number(match[1])) : max
    }, 0) + 1
  return path.join(outDir, `screenshot-${nextNumber}-${label}.png`)
}
async function shoot(page, label) {
  const filePath = await nextFileName(label)
  await page.screenshot({ path: filePath, fullPage: true })
  console.log(`Saved ${filePath}`)
}

const browser = await puppeteer.launch({ headless: true, args: ['--window-size=1280,900'] })

try {
  // --- Check 1: keyboard-only navigation from the list ---
  const page1 = await browser.newPage()
  await page1.setViewport({ width: 1280, height: 900 })
  await page1.goto(`${baseUrl}/sandbox`, { waitUntil: 'networkidle0', timeout: 30000 })

  const firstCardHref = await page1.evaluate(() => document.querySelector('a[href^="/sandbox/stocks/"]')?.getAttribute('href'))
  await page1.evaluate(() => {
    const link = document.querySelector('a[href^="/sandbox/stocks/"]')
    if (link instanceof HTMLElement) link.focus()
  })
  const focusedHref = await page1.evaluate(() => document.activeElement?.getAttribute('href'))
  if (focusedHref !== firstCardHref) throw new Error(`Expected focus on ${firstCardHref}, got ${focusedHref}`)
  await page1.keyboard.press('Enter')
  await page1.waitForFunction((href) => location.pathname === href, { timeout: 10000 }, firstCardHref)
  console.log('Keyboard-only navigation from the list: OK ->', page1.url())
  await shoot(page1, 'sandbox-keyboard-nav-detail')
  await page1.close()

  // --- Check 2: unknown symbol on the detail route - should error gracefully, not crash ---
  const page2 = await browser.newPage()
  await page2.setViewport({ width: 1280, height: 900 })
  await page2.goto(`${baseUrl}/sandbox/stocks/NOTAREALSYMBOL.NS`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 400))
  const hasErrorState = await page2.evaluate(() => document.querySelector('[role="alert"]') !== null)
  if (!hasErrorState) throw new Error('Expected an error state for an unknown symbol, found none')
  console.log('Unknown symbol shows a graceful error state: OK')
  await shoot(page2, 'sandbox-unknown-symbol-error')
  await page2.close()

  console.log('All round-2 checks passed.')
} finally {
  await browser.close()
}
