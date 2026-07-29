import puppeteer from 'puppeteer'
import { mkdir, readdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../../temporary screenshots')
await mkdir(outDir, { recursive: true })

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
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
      setter.call(el, value)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    },
    selector,
    text
  )
}

const browser = await puppeteer.launch({ headless: true, args: ['--window-size=1280,900'] })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })

  console.log('--- Buy TCS.NS first, via KEYBOARD-only side selection ---')
  await page.goto('http://localhost:5173/simulator/trade', { waitUntil: 'networkidle0', timeout: 30000 })
  await typeInto(page, '#symbol', 'TCS.NS')
  await clickButtonWithText(page, 'Look up')
  await new Promise((r) => setTimeout(r, 1500))

  // Keyboard-only: focus first radio (Buy), arrow to Sell and back to Buy, Enter to confirm Buy.
  await page.evaluate(() => {
    const radio = document.querySelector('[role="radio"]')
    if (radio instanceof HTMLElement) radio.focus()
  })
  await page.keyboard.press('ArrowRight') // -> Sell
  await page.keyboard.press('ArrowLeft') // -> Buy
  await page.keyboard.press('Enter')
  const selected = await page.evaluate(() => document.querySelector('[role="radio"][aria-checked="true"]')?.textContent)
  console.log('Keyboard-selected side:', selected)

  await typeInto(page, '#quantity', '4')
  await typeInto(page, '#rationale', 'Buying a small TCS position to set up a sell test - strong balance sheet and consistent margins, sized modestly given transaction costs.')
  await clickButtonWithText(page, 'Place trade')
  await page.waitForFunction(() => document.body.textContent?.includes('Process score'), { timeout: 30000 })
  await clickButtonWithText(page, 'Back to portfolio')
  await page.waitForFunction(() => document.body.textContent?.includes('Trade history'), { timeout: 30000 })

  console.log('--- Now sell 2 of the 4 TCS.NS shares ---')
  await clickButtonWithText(page, 'New trade')
  await new Promise((r) => setTimeout(r, 400))
  await typeInto(page, '#symbol', 'TCS.NS')
  await clickButtonWithText(page, 'Look up')
  await new Promise((r) => setTimeout(r, 1500))

  // Keyboard again, this time landing on Sell.
  await page.evaluate(() => {
    const radio = document.querySelector('[role="radio"]')
    if (radio instanceof HTMLElement) radio.focus()
  })
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  const selectedSell = await page.evaluate(() => document.querySelector('[role="radio"][aria-checked="true"]')?.textContent)
  console.log('Keyboard-selected side (should be Sell):', selectedSell)

  await typeInto(page, '#quantity', '2')
  await typeInto(page, '#rationale', 'Trimming half the position to lock in some diversification headroom for other ideas.')
  await clickButtonWithText(page, 'Place trade')
  await page.waitForFunction(() => document.body.textContent?.includes('Process score'), { timeout: 30000 })
  await shoot(page, 'sim-sell-score-result')

  await clickButtonWithText(page, 'Back to portfolio')
  await page.waitForFunction(() => document.body.textContent?.includes('Trade history'), { timeout: 30000 })
  await new Promise((r) => setTimeout(r, 400))
  await shoot(page, 'sim-dashboard-after-buy-and-sell')

  console.log('--- Sell the remaining 2 shares (full close) and confirm holding disappears ---')
  await clickButtonWithText(page, 'New trade')
  await new Promise((r) => setTimeout(r, 400))
  await typeInto(page, '#symbol', 'TCS.NS')
  await clickButtonWithText(page, 'Look up')
  await new Promise((r) => setTimeout(r, 1500))
  await page.evaluate(() => {
    const radios = document.querySelectorAll('[role="radio"]')
    if (radios[1] instanceof HTMLElement) radios[1].click()
  })
  await typeInto(page, '#quantity', '2')
  await typeInto(page, '#rationale', 'Closing out the remaining shares entirely to reallocate.')
  await clickButtonWithText(page, 'Place trade')
  await page.waitForFunction(() => document.body.textContent?.includes('Process score'), { timeout: 30000 })
  await clickButtonWithText(page, 'Back to portfolio')
  await page.waitForFunction(() => document.body.textContent?.includes('Trade history'), { timeout: 30000 })
  await new Promise((r) => setTimeout(r, 400))
  const hasHoldingsTable = await page.evaluate(() => Boolean(document.querySelector('table')))
  console.log('Holdings table present after fully closing the position (should be false):', hasHoldingsTable)
  await shoot(page, 'sim-dashboard-position-fully-closed')

  console.log('Done.')
} finally {
  await browser.close()
}
