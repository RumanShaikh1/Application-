// Loads the built unpacked extension into a real Chrome instance via
// Puppeteer, navigates to a real page, and screenshots the injected
// sidebar - the extension equivalent of the old Electron CDP screenshot
// loop (screenshot-electron.mjs), since there's no Electron window anymore.
import puppeteer from 'puppeteer'
import { mkdir, readdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const extensionPath = path.resolve(__dirname, '../dist')
const outDir = path.resolve(__dirname, '../../temporary screenshots')
await mkdir(outDir, { recursive: true })

const label = process.argv[2] ?? 'extension'
const targetUrl = process.argv[3] ?? 'https://finance.yahoo.com'

async function nextFileName() {
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
  await page.setViewport({ width: 1440, height: 900 })
  // Yahoo Finance never truly reaches network-idle (continuous ad pings),
  // so wait for DOM ready and then a fixed settle time instead.
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  // Content script runs at document_idle - give it a beat to mount + fetch fonts/CSS.
  await new Promise((resolve) => setTimeout(resolve, 3000))

  const filePath = await nextFileName()
  await page.screenshot({ path: filePath })
  console.log(`Saved ${filePath} (from ${page.url()})`)

  // Report back some quick facts so failures are diagnosable without a screenshot.
  const info = await page.evaluate(() => {
    const host = document.getElementById('marketpane-host')
    const shadow = host?.shadowRoot
    const tabButton = shadow?.querySelector('button[aria-controls="marketpane-sidebar-panel"]')
    return {
      hostPresent: Boolean(host),
      shadowRootAttached: Boolean(shadow),
      tabButtonPresent: Boolean(tabButton),
      tabButtonText: tabButton?.textContent ?? null
    }
  })
  console.log('content script state:', JSON.stringify(info, null, 2))
} finally {
  await browser.close()
}
