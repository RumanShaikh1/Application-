// node scripts/theme-check-round2b.mjs
// Small follow-up to round 2: forces dark mode explicitly (rather than
// relying on whatever state a prior script left the toggle in) for the two
// routes round 2's toggle test accidentally screenshotted in light mode.
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
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  await page.evaluateOnNewDocument(() => localStorage.setItem('marketpane.theme', 'dark'))

  await page.goto(`${baseUrl}/simulator/trade`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 400))
  await shoot(page, 'dark-simulator-trade-actual')

  await page.goto(`${baseUrl}/tax/fy-overview`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 400))
  await shoot(page, 'dark-tax-fy-overview-actual')

  console.log('Done.')
} finally {
  await browser.close()
}
