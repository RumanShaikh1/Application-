// node scripts/interact-simulator-sandbox-round2.mjs
// Round 2: confirms the trading-frequency grader fix shows correctly after
// a single day-0 trade, exercises a full sell-to-close flow (real close
// summary), and checks dark mode + mobile for the replay dashboard/ticket.
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
async function setTheme(page, theme) {
  await page.evaluateOnNewDocument((t) => localStorage.setItem('marketpane.theme', t), theme)
}

const browser = await puppeteer.launch({ headless: true, args: ['--window-size=1280,900'] })

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  await setTheme(page, 'dark')
  await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 30000 })
  await page.evaluate(() => localStorage.clear())
  await page.evaluate(() => localStorage.setItem('marketpane.theme', 'dark'))
  await page.evaluate(() => localStorage.setItem('marketpane.simulator.mode', 'replay'))

  // 1. Buy on day 0, check the grade section - the frequency dimension must NOT say "worth a look" after just one trade.
  await page.goto(`${baseUrl}/simulator/trade`, { waitUntil: 'networkidle0', timeout: 30000 })
  await page.waitForFunction(() => document.body.textContent?.includes('₹') ?? false, { timeout: 15000 })
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Reliance Industries'))
    button?.click()
  })
  await new Promise((r) => setTimeout(r, 300))
  await clickByText(page, 'button', 'Buy')
  await page.type('#sandbox-quantity', '10')
  await clickByText(page, 'button', 'It fits my goal')
  await clickByText(page, 'button', 'Place trade')
  await page.waitForFunction(() => document.body.textContent?.includes('Bought') ?? false, { timeout: 15000 })
  await clickByText(page, 'button', 'Back to portfolio')
  await page.waitForFunction(() => document.body.textContent?.includes('Your process grade') ?? false, { timeout: 15000 })
  await new Promise((r) => setTimeout(r, 300))

  const frequencyLevel = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('li'))
    const freqCard = cards.find((li) => li.textContent?.includes('trading days'))
    return freqCard?.querySelector('span')?.textContent ?? null
  })
  console.log('Trading-frequency level after 1 day-0 trade:', frequencyLevel)
  if (frequencyLevel !== 'Strong') throw new Error(`Expected "Strong" for trading frequency after a single trade, got "${frequencyLevel}"`)
  await shoot(page, 'dark-replay-dashboard-grade-fixed')

  // 2. Advance to the crash trough (day 56) and sell to fully close the position - real close summary.
  for (let i = 0; i < 11; i++) {
    await clickByText(page, 'button', '+1 week')
    await new Promise((r) => setTimeout(r, 150))
  }
  const dayText = await page.evaluate(() => document.body.textContent?.match(/Day (\d+) of 250/)?.[0] ?? '')
  console.log('Advanced to:', dayText)

  await clickByText(page, 'button', 'New trade')
  await page.waitForFunction(() => location.pathname === '/simulator/trade', { timeout: 10000 })
  await page.waitForFunction(() => document.body.textContent?.includes('₹') ?? false, { timeout: 15000 })
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Reliance Industries'))
    button?.click()
  })
  await new Promise((r) => setTimeout(r, 300))
  await clickByText(page, 'button', 'Sell')
  await page.type('#sandbox-quantity', '10')
  await shoot(page, 'dark-replay-sell-ticket-no-thesis-required')
  await clickByText(page, 'button', 'Place trade')
  await page.waitForFunction(() => document.body.textContent?.includes('Sold') ?? false, { timeout: 15000 })
  await new Promise((r) => setTimeout(r, 300))
  await shoot(page, 'dark-replay-sell-result-close-summary')

  const hasCloseSummary = await page.evaluate(() => document.body.textContent?.includes('a reflection, not a grade') ?? false)
  if (!hasCloseSummary) throw new Error('Expected the position-close reflection summary after fully selling out')
  console.log('Close summary shown on full sell: OK')

  // 3. Mobile width - replay dashboard.
  await clickByText(page, 'button', 'Back to portfolio')
  await page.waitForFunction(() => document.body.textContent?.includes('Your process grade') ?? false, { timeout: 15000 })
  await page.setViewport({ width: 390, height: 844 })
  await new Promise((r) => setTimeout(r, 400))
  await shoot(page, 'dark-replay-dashboard-mobile')

  console.log('All round-2 checks passed.')
} finally {
  await browser.close()
}
