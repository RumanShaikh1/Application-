// node scripts/interact-simulator.mjs
// Drives the simulator loop in a real headless browser and screenshots
// each meaningful state. Requires the web dev server (port 5173) and the
// API server (port 8787) to already be running.
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

const browser = await puppeteer.launch({ headless: true, args: ['--window-size=1280,900'] })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })

  // 1. Fresh dashboard (new browser context - no prior localStorage state).
  await page.goto(`${baseUrl}/simulator`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 500))
  await shoot(page, 'sim-dashboard-fresh')

  // 2. Go to trade ticket, look up a real symbol.
  await clickButtonWithText(page, 'New trade')
  await new Promise((r) => setTimeout(r, 400))
  await typeInto(page, '#symbol', 'RELIANCE.NS')
  await clickButtonWithText(page, 'Look up')
  await new Promise((r) => setTimeout(r, 1500))
  await shoot(page, 'sim-trade-quote-looked-up')

  // 3. Select Buy, enter quantity, submit with NO rationale first (validation check).
  await page.evaluate(() => {
    const radio = document.querySelector('[role="radio"]')
    if (radio instanceof HTMLElement) radio.click()
  })
  await typeInto(page, '#quantity', '5')
  await clickButtonWithText(page, 'Place trade')
  await new Promise((r) => setTimeout(r, 300))
  await shoot(page, 'sim-trade-rationale-validation-error')

  // 4. Fill in a real rationale and submit for real.
  await typeInto(
    page,
    '#rationale',
    'Reliance has strong refining margins this quarter and I am starting a small position - sized modestly given brokerage and STT costs on delivery trades.'
  )
  await clickButtonWithText(page, 'Place trade')
  await page.waitForFunction(() => document.body.textContent?.includes('Process score'), { timeout: 30000 })
  await new Promise((r) => setTimeout(r, 300))
  await shoot(page, 'sim-trade-score-result')

  // 5. Back to dashboard - should now show the holding and trade history.
  await clickButtonWithText(page, 'Back to portfolio')
  await page.waitForFunction(() => document.body.textContent?.includes('Trade history'), { timeout: 30000 })
  await new Promise((r) => setTimeout(r, 500))
  await shoot(page, 'sim-dashboard-populated')

  // 6. Mobile width.
  await page.setViewport({ width: 390, height: 844 })
  await new Promise((r) => setTimeout(r, 300))
  await shoot(page, 'sim-dashboard-mobile')
  await page.setViewport({ width: 1280, height: 900 })

  // 7. Insufficient-cash error: try to buy an enormous quantity.
  await clickButtonWithText(page, 'New trade')
  await new Promise((r) => setTimeout(r, 400))
  await typeInto(page, '#symbol', 'RELIANCE.NS')
  await clickButtonWithText(page, 'Look up')
  await new Promise((r) => setTimeout(r, 1500))
  await page.evaluate(() => {
    const radio = document.querySelector('[role="radio"]')
    if (radio instanceof HTMLElement) radio.click()
  })
  await typeInto(page, '#quantity', '100000')
  await typeInto(page, '#rationale', 'Testing an order far larger than my virtual cash balance.')
  await clickButtonWithText(page, 'Place trade')
  await page.waitForFunction(() => document.body.textContent?.includes('Insufficient'), { timeout: 30000 })
  await new Promise((r) => setTimeout(r, 300))
  await shoot(page, 'sim-trade-insufficient-cash-error')

  console.log('Done.')
} finally {
  await browser.close()
}
