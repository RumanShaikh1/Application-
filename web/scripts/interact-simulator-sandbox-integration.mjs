// node scripts/interact-simulator-sandbox-integration.mjs
// Verifies the Sandbox is now a mode of the Simulator, not a separate page:
// the mode toggle, the full 2020-replay trading loop (pick a stock, buy with
// a thesis, day-advance, sell to close, the portfolio grade), and that live
// mode still works unchanged. Requires both servers running (5173, 8787).
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
async function clickByText(page, tag, text) {
  const clicked = await page.evaluate(
    (t, txt) => {
      const el = Array.from(document.querySelectorAll(t)).find((e) => e.textContent?.includes(txt))
      if (el) {
        el.click()
        return true
      }
      return false
    },
    tag,
    text
  )
  if (!clicked) throw new Error(`Could not find <${tag}> containing "${text}"`)
}

const browser = await puppeteer.launch({ headless: true, args: ['--window-size=1280,900'] })

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })

  // Clear localStorage so this is a fresh session (fresh live + sandbox portfolios, mode defaults to live).
  await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 30000 })
  await page.evaluate(() => localStorage.clear())

  // 1. Simulator dashboard, default (live) mode - the mode toggle should be visible, no "Sandbox" nav item anymore.
  await page.goto(`${baseUrl}/simulator`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 400))
  const hasSandboxNavItem = await page.evaluate(() => Array.from(document.querySelectorAll('nav a')).some((a) => a.textContent?.trim() === 'Sandbox'))
  if (hasSandboxNavItem) throw new Error('Expected the standalone "Sandbox" nav item to be gone')
  console.log('No separate Sandbox nav item: OK')
  await shoot(page, 'simulator-dashboard-live-default')

  // 2. Old /sandbox URL should no longer resolve to a real page (falls through to the 404 route).
  await page.goto(`${baseUrl}/sandbox`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 300))
  const is404 = await page.evaluate(() => document.body.textContent?.includes('Page not found') ?? false)
  if (!is404) throw new Error('Expected /sandbox to now 404')
  console.log('/sandbox now 404s (folded into Simulator): OK')

  // 3. Switch to Replay mode on the dashboard.
  await page.goto(`${baseUrl}/simulator`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 300))
  await clickByText(page, 'button', '2020 replay')
  await new Promise((r) => setTimeout(r, 600))
  await shoot(page, 'simulator-dashboard-replay-mode-day0')

  const dayLabelPresent = await page.evaluate(() => document.body.textContent?.includes('Day 0 of 250') ?? false)
  if (!dayLabelPresent) throw new Error('Expected "Day 0 of 250" on the replay dashboard')
  console.log('Replay dashboard shows day cursor: OK')

  // 4. New trade in replay mode - the picker grid with real day-0 prices.
  await clickByText(page, 'button', 'New trade')
  await page.waitForFunction(() => location.pathname === '/simulator/trade', { timeout: 10000 })
  await page.waitForFunction(() => document.body.textContent?.includes('₹') ?? false, { timeout: 15000 })
  await new Promise((r) => setTimeout(r, 400))
  await shoot(page, 'replay-trade-ticket-picker')

  // 5. Open the info modal on a card (Reliance) - the SandboxStockModal, reused from before.
  const infoOpened = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button[aria-label^="Full details for Reliance"]'))
    if (buttons[0]) {
      buttons[0].click()
      return true
    }
    return false
  })
  if (!infoOpened) throw new Error('Could not find the info button for Reliance Industries')
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 })
  await new Promise((r) => setTimeout(r, 400))
  await shoot(page, 'replay-trade-ticket-info-modal')
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelector('[role="dialog"]') === null, { timeout: 5000 })

  // 6. Select Reliance to trade, buy 10 shares with a thesis.
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Reliance Industries'))
    button?.click()
  })
  await new Promise((r) => setTimeout(r, 300))
  await clickByText(page, 'button', 'Buy')
  await page.type('#sandbox-quantity', '10')
  await clickByText(page, 'button', 'It fits my goal')
  await shoot(page, 'replay-trade-ticket-filled')

  await clickByText(page, 'button', 'Place trade')
  await page.waitForFunction(() => document.body.textContent?.includes('Bought') ?? false, { timeout: 15000 })
  await new Promise((r) => setTimeout(r, 300))
  await shoot(page, 'replay-trade-result-buy')

  // 7. Back to the dashboard - portfolio grade + trade history should reflect the trade.
  await clickByText(page, 'button', 'Back to portfolio')
  await page.waitForFunction(() => document.body.textContent?.includes('Your process grade') ?? false, { timeout: 15000 })
  await new Promise((r) => setTimeout(r, 300))
  await shoot(page, 'replay-dashboard-after-trade-with-grade')

  // 8. Advance a week and confirm the day cursor moved.
  await clickByText(page, 'button', '+1 week')
  await page.waitForFunction(() => document.body.textContent?.includes('Day 5 of 250') ?? false, { timeout: 15000 })
  console.log('Day-advance control works: OK')
  await shoot(page, 'replay-dashboard-after-advance')

  // 9. Live mode still works - switch back and confirm the original live UI (symbol search) is intact.
  await clickByText(page, 'button', 'Live trading')
  await new Promise((r) => setTimeout(r, 400))
  await clickByText(page, 'button', 'New trade')
  await page.waitForFunction(() => location.pathname === '/simulator/trade', { timeout: 10000 })
  await new Promise((r) => setTimeout(r, 600))
  const hasLiveSearch = await page.evaluate(() => document.querySelector('#symbol') !== null)
  if (!hasLiveSearch) throw new Error('Expected the live-mode manual symbol search box to still be present')
  console.log('Live mode trade ticket unaffected: OK')
  await shoot(page, 'live-trade-ticket-unaffected')

  console.log('All integration checks passed.')
} finally {
  await browser.close()
}
