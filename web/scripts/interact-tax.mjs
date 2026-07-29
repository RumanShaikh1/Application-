// node scripts/interact-tax.mjs
// Drives the Tax Understanding module in a real headless browser and
// screenshots each meaningful state. Requires the web dev server (port
// 5173) and the API server (port 8787) to already be running.
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
  console.log(`Saved ${filePath} (from ${page.url()})`)
}

async function clickButtonWithText(page, text) {
  const clicked = await page.evaluate((t) => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const target = buttons.find((b) => b.textContent?.includes(t))
    if (target) {
      target.click()
      return true
    }
    return false
  }, text)
  if (!clicked) throw new Error(`No button found containing text: "${text}"`)
}

async function typeInto(page, selector, text) {
  await page.evaluate(
    (sel, value) => {
      const el = document.querySelector(sel)
      if (el) {
        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
        setter.call(el, value)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
    },
    selector,
    text
  )
}

async function clickSummaryWithText(page, text) {
  const clicked = await page.evaluate((t) => {
    const summaries = Array.from(document.querySelectorAll('summary'))
    const target = summaries.find((s) => s.textContent?.includes(t))
    if (target) {
      target.click()
      return true
    }
    return false
  }, text)
  if (!clicked) throw new Error(`No <summary> found containing text: "${text}"`)
}

const browser = await puppeteer.launch({ headless: true, args: ['--window-size=1280,1000'] })
try {
  const page = await browser.newPage()
  page.on('dialog', (d) => d.accept())
  await page.setViewport({ width: 1280, height: 1000 })

  // --- Scenario A: short-term equity delivery - the centrepiece counter + counterweight. ---
  await page.goto(`${baseUrl}/tax`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 400))
  await shoot(page, 'tax-comparator-empty')

  // Buy date must be within the last 12 months (relative to whenever this
  // runs) to land in "still short-term" - a fixed past date would drift
  // into long-term territory over time.
  const recentBuyDate = new Date()
  recentBuyDate.setUTCMonth(recentBuyDate.getUTCMonth() - 4)
  const recentBuyDateIso = recentBuyDate.toISOString().slice(0, 10)

  await typeInto(page, '#buyPrice', '100')
  await typeInto(page, '#buyDate', recentBuyDateIso)
  await typeInto(page, '#sellPrice', '200')
  await typeInto(page, '#quantity', '1000')
  await clickButtonWithText(page, 'Calculate')
  await page.waitForFunction(() => document.body.textContent?.includes('Days until long-term'), { timeout: 15000 })
  await new Promise((r) => setTimeout(r, 300))
  await shoot(page, 'tax-comparator-short-term-counter-and-counterweight')

  await clickButtonWithText(page, 'Explain this in plain English')
  await page.waitForFunction(() => document.body.textContent?.includes('Explaining...') || document.body.textContent?.includes('indicative estimate'), {
    timeout: 5000
  })
  await page.waitForFunction(() => !document.body.textContent?.includes('Explaining...'), { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 300))
  await shoot(page, 'tax-comparator-explanation-loaded')

  // --- Scenario B: validation errors on submit with nothing filled in. ---
  await page.goto(`${baseUrl}/tax`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 300))
  await clickButtonWithText(page, 'Calculate')
  await new Promise((r) => setTimeout(r, 200))
  await shoot(page, 'tax-comparator-validation-errors')

  // --- Scenario C: intraday, slab rate supplied, expandable breakdown. ---
  await page.goto(`${baseUrl}/tax`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 300))
  await clickButtonWithText(page, 'Intraday')
  await typeInto(page, '#buyPrice', '500')
  await typeInto(page, '#buyDate', '2024-09-05')
  await typeInto(page, '#sellPrice', '520')
  await typeInto(page, '#sellDate', '2024-09-05')
  await typeInto(page, '#quantity', '100')
  await typeInto(page, '#slabRate', '30')
  await clickButtonWithText(page, 'Calculate')
  await page.waitForFunction(() => document.body.textContent?.includes('speculative business income'), { timeout: 15000 })
  await new Promise((r) => setTimeout(r, 300))
  await shoot(page, 'tax-comparator-intraday-result')

  await clickSummaryWithText(page, 'Full line-by-line breakdown')
  await new Promise((r) => setTimeout(r, 300))
  await shoot(page, 'tax-comparator-breakdown-expanded')

  // --- Mobile width, on the intraday result already on screen. ---
  await page.setViewport({ width: 390, height: 844 })
  await new Promise((r) => setTimeout(r, 300))
  await shoot(page, 'tax-comparator-mobile')
  await page.setViewport({ width: 1280, height: 1000 })

  // --- FY overview: fresh empty state. ---
  await page.goto(`${baseUrl}/tax/fy-overview`, { waitUntil: 'networkidle0', timeout: 30000 })
  await page.waitForFunction(() => document.body.textContent?.includes('headroom'), { timeout: 15000 })
  await new Promise((r) => setTimeout(r, 300))
  await shoot(page, 'tax-fy-overview-empty')

  // --- FY overview: realised gains entered, exceeding the LTCG exemption. ---
  // Real focus -> type -> blur (native Puppeteer input), not the typeInto
  // shortcut: these fields commit on a genuine blur event, which typeInto's
  // property-setter approach never triggers because it never focuses the
  // element in the first place.
  await page.click('#stGains', { clickCount: 3 })
  await page.type('#stGains', '80000')
  await page.click('#ltGains', { clickCount: 3 })
  await page.type('#ltGains', '150000')
  await page.keyboard.press('Tab')
  await page.waitForFunction(() => document.body.textContent?.includes('₹0.00'), { timeout: 15000 })
  await new Promise((r) => setTimeout(r, 300))
  await shoot(page, 'tax-fy-overview-headroom-exhausted')

  // --- FY overview: add an open loss position, see the offset suggestion. ---
  await typeInto(page, '#positionLabel', 'INFY')
  await typeInto(page, '#lossAmount', '30000')
  await clickButtonWithText(page, 'Add position')
  await page.waitForFunction(() => document.body.textContent?.includes('What booking these losses would offset'), { timeout: 15000 })
  await new Promise((r) => setTimeout(r, 300))
  await shoot(page, 'tax-fy-overview-loss-harvesting-populated')

  // --- Mobile width on the populated FY overview. ---
  await page.setViewport({ width: 390, height: 844 })
  await new Promise((r) => setTimeout(r, 300))
  await shoot(page, 'tax-fy-overview-mobile')

  console.log('Done.')
} finally {
  await browser.close()
}
