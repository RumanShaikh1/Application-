import puppeteer from 'puppeteer'
import { mkdir, readdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const extensionPath = path.resolve(__dirname, '../dist')
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

const browser = await puppeteer.launch({
  headless: false,
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--window-size=1440,900']
})

try {
  const page = await browser.newPage()
  page.on('pageerror', (err) => console.log('[page error]', err.message))
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto('https://finance.yahoo.com', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await new Promise((resolve) => setTimeout(resolve, 3000))

  await page.evaluate(() => {
    const host = document.getElementById('marketpane-host')
    const button = host?.shadowRoot?.querySelector('button[aria-controls="marketpane-sidebar-panel"]')
    button?.click()
  })
  await new Promise((resolve) => setTimeout(resolve, 1000))

  const clicked = await page.evaluate(() => {
    const host = document.getElementById('marketpane-host')
    const shadow = host?.shadowRoot
    const buttons = Array.from(shadow?.querySelectorAll('button') ?? [])
    const symbolBtn = buttons.find((b) => b.querySelector('p.font-display'))
    symbolBtn?.click()
    return symbolBtn?.querySelector('p.font-display')?.textContent ?? null
  })
  console.log('clicked symbol:', clicked)
  await new Promise((resolve) => setTimeout(resolve, 1500))

  // Reveal the price chart too, on the ink surface.
  await page.evaluate(() => {
    const host = document.getElementById('marketpane-host')
    const shadow = host?.shadowRoot
    const buttons = Array.from(shadow?.querySelectorAll('button') ?? [])
    const showChart = buttons.find((b) => b.textContent?.trim() === 'Show price chart')
    showChart?.click()
  })
  await new Promise((resolve) => setTimeout(resolve, 1500))

  const filePath = await nextFileName('stock-detail-chart')
  await page.screenshot({ path: filePath })
  console.log(`Saved ${filePath}`)
} finally {
  await browser.close()
}
