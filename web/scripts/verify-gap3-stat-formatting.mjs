// One-off: verifies Gap 3's fix in the real rendered app - a bank's
// debt-to-equity shows "Not applicable for banks" (not a blank/dash/0), and
// a non-bank's null ROE shows the honest generic reason, never a blank.
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
  await page.screenshot({ path: filePath, fullPage: false })
  console.log(`Saved ${filePath}`)
}
async function clickInfoFor(page, companyName) {
  const clicked = await page.evaluate((name) => {
    const button = Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('aria-label')?.includes(name))
    if (button instanceof HTMLElement) {
      button.click()
      return true
    }
    return false
  }, companyName)
  if (!clicked) throw new Error(`Could not find an info button for "${companyName}"`)
}

const browser = await puppeteer.launch({ headless: true, args: ['--window-size=1280,900'] })

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  await page.evaluateOnNewDocument(() => localStorage.setItem('marketpane.simulator.mode', 'replay'))
  await page.goto(`${baseUrl}/simulator/trade`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 500))

  // HDFC Bank - debt-to-equity is null in the fixture, sector Financial Services.
  await clickInfoFor(page, 'HDFC Bank')
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 })
  await new Promise((r) => setTimeout(r, 400))
  const hdfcText = await page.evaluate(() => document.querySelector('[role="dialog"]')?.textContent ?? '')
  console.log('HDFC Bank modal contains "Not applicable for banks":', hdfcText.includes('Not applicable for banks'))
  console.log('HDFC Bank modal contains a bare "0" or blank debt-to-equity value:', /Debt-to-equity[^a-zA-Z]*(?:₹|0\.00(?!%))/.test(hdfcText))
  await shoot(page, 'gap3-hdfcbank-not-applicable-banks')
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelector('[role="dialog"]') === null, { timeout: 5000 })

  // Reliance Industries - roePercent is null in the fixture, sector Energy (not a bank).
  await clickInfoFor(page, 'Reliance Industries')
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 })
  await new Promise((r) => setTimeout(r, 400))
  const relianceText = await page.evaluate(() => document.querySelector('[role="dialog"]')?.textContent ?? '')
  console.log('Reliance modal contains "Not available for this period":', relianceText.includes('Not available for this period'))
  await shoot(page, 'gap3-reliance-roe-not-available')
  await page.keyboard.press('Escape')

  console.log('Gap 3 verification complete.')
} finally {
  await browser.close()
}
