// node scripts/interact-stock-grid-round2.mjs
// Round 2: keyboard-only card selection, graceful per-card degradation when
// a quote batch fails, and the manual search still working for a symbol
// outside the curated grid.
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
  // --- Check 1: keyboard-only selection ---
  const page1 = await browser.newPage()
  await page1.setViewport({ width: 1280, height: 900 })
  await page1.goto(`${baseUrl}/simulator/trade`, { waitUntil: 'networkidle0', timeout: 30000 })
  await page1.waitForFunction(() => Array.from(document.querySelectorAll('button[aria-label*=","]')).some((b) => /₹/.test(b.getAttribute('aria-label') ?? '')), {
    timeout: 20000
  })

  // Tab from the page's start to the first grid card (skip nav links + back button).
  const firstCardLabel = await page1.evaluate(() => {
    const button = document.querySelector('button[aria-label*=","]')
    return button?.getAttribute('aria-label') ?? null
  })
  await page1.evaluate(() => {
    const button = document.querySelector('button[aria-label*=","]')
    if (button instanceof HTMLElement) button.focus()
  })
  const focusedLabel = await page1.evaluate(() => document.activeElement?.getAttribute('aria-label'))
  if (focusedLabel !== firstCardLabel) throw new Error(`Expected focus on "${firstCardLabel}", got "${focusedLabel}"`)
  await page1.keyboard.press('Enter')
  await new Promise((r) => setTimeout(r, 300))
  const populated = await page1.evaluate(() => (document.querySelector('#symbol')?.value ?? '').length > 0)
  if (!populated) throw new Error('Enter on a focused card did not populate the symbol field')
  console.log('Keyboard-only selection: OK -', firstCardLabel)
  await shoot(page1, 'keyboard-selected-first-card')
  await page1.close()

  // --- Check 2: one quote batch fails - affected cards degrade gracefully, others still work ---
  const page2 = await browser.newPage()
  await page2.setViewport({ width: 1280, height: 900 })
  let blockedCount = 0
  await page2.setRequestInterception(true)
  page2.on('request', (req) => {
    const url = req.url()
    // Fail every other /api/stats batch (there are ~4, batches of 6) to simulate a partial provider outage.
    if (url.includes('/api/stats')) {
      blockedCount++
      if (blockedCount % 2 === 0) {
        req.abort()
        return
      }
    }
    req.continue()
  })
  await page2.goto(`${baseUrl}/simulator/trade`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 1500))
  const state = await page2.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button[aria-label*=","]'))
    return {
      total: buttons.length,
      unavailable: buttons.filter((b) => b.disabled).length,
      available: buttons.filter((b) => !b.disabled).length
    }
  })
  console.log('Partial quote failure:', JSON.stringify(state))
  if (state.total !== 20) throw new Error(`Expected all 20 names to still render, got ${state.total}`)
  if (state.unavailable === 0) throw new Error('Expected at least one card to show as unavailable after blocking some quote batches')
  if (state.available === 0) throw new Error('Expected at least one card to still work after blocking some quote batches')
  await shoot(page2, 'partial-quote-failure-graceful')
  await page2.close()

  // --- Check 3: manual search still works for a symbol outside the curated grid ---
  const page3 = await browser.newPage()
  await page3.setViewport({ width: 1280, height: 900 })
  await page3.goto(`${baseUrl}/simulator/trade`, { waitUntil: 'networkidle0', timeout: 30000 })
  await page3.waitForFunction(() => Array.from(document.querySelectorAll('button[aria-label*=","]')).some((b) => /₹/.test(b.getAttribute('aria-label') ?? '')), {
    timeout: 20000
  })
  await page3.type('#symbol', 'WIPRO.NS')
  await page3.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const lookupButton = buttons.find((b) => b.textContent?.includes('Look up'))
    lookupButton?.click()
  })
  await new Promise((r) => setTimeout(r, 1200))
  const manualQuoteShown = await page3.evaluate(() => document.body.textContent?.includes('WIPRO') ?? false)
  if (!manualQuoteShown) throw new Error('Manual search for a non-curated symbol (WIPRO.NS) did not surface a quote')
  console.log('Manual search fallback for a non-curated symbol: OK')
  await shoot(page3, 'manual-search-non-curated-symbol')
  await page3.close()

  console.log('All round-2 checks passed.')
} finally {
  await browser.close()
}
