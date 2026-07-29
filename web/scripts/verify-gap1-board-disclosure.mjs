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

const browser = await puppeteer.launch({ headless: true, args: ['--window-size=1280,900'] })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  await page.evaluateOnNewDocument(() => localStorage.setItem('marketpane.simulator.mode', 'replay'))
  await page.goto(`${baseUrl}/simulator/trade`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 700))
  const hasBanner = await page.evaluate(() => document.body.textContent?.includes('Fundamentals shown are recent') ?? false)
  console.log('Board shows the fundamentals/price mismatch disclosure:', hasBanner)
  const filePath = await nextFileName('gap1-board-disclosure')
  await page.screenshot({ path: filePath, fullPage: false })
  console.log(`Saved ${filePath}`)
} finally {
  await browser.close()
}
