// Drives interactions against the extension loaded on a real page, then
// screenshots the result - the extension equivalent of the Electron
// open-drawer.mjs scripts used earlier. Usage:
//   node scripts/interact.mjs <label> <action>
// action: "open" | "highlight" | "stock-detail"
import puppeteer from 'puppeteer'
import { mkdir, readdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const extensionPath = path.resolve(__dirname, '../dist')
const outDir = path.resolve(__dirname, '../../temporary screenshots')
await mkdir(outDir, { recursive: true })

const label = process.argv[2] ?? 'interact'
const action = process.argv[3] ?? 'open'
const targetUrl = process.argv[4] ?? 'https://finance.yahoo.com'

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
  page.on('pageerror', (err) => console.log('[page error]', err.message))
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await new Promise((resolve) => setTimeout(resolve, 3000))

  if (action === 'open') {
    await page.evaluate(() => {
      const host = document.getElementById('marketpane-host')
      const button = host?.shadowRoot?.querySelector('button[aria-controls="marketpane-sidebar-panel"]')
      button?.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  if (action === 'highlight') {
    // Select some real visible text on the page, then dispatch a synthetic
    // mouseup directly - a real page.mouse click would collapse the
    // JS-created selection before the listener ever saw it.
    const selected = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('p'))
      const target = candidates.find((p) => (p.textContent?.trim().length ?? 0) > 40 && p.offsetParent !== null)
      if (!target) return null
      const range = document.createRange()
      range.selectNodeContents(target)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }))
      return target.textContent?.trim().slice(0, 80)
    })
    console.log('selected text:', selected)
    // Real Gemini call in flight - give it real time to finish.
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }

  if (action === 'stock-detail') {
    const symbolClicked = await page.evaluate(() => {
      const host = document.getElementById('marketpane-host')
      const shadow = host?.shadowRoot
      const buttons = Array.from(shadow?.querySelectorAll('button') ?? [])
      const symbolBtn = buttons.find((b) => b.querySelector('p.font-display'))
      symbolBtn?.click()
      return symbolBtn?.querySelector('p.font-display')?.textContent ?? null
    })
    console.log('clicked symbol:', symbolClicked)
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  const filePath = await nextFileName()
  await page.screenshot({ path: filePath })
  console.log(`Saved ${filePath}`)
} finally {
  await browser.close()
}
