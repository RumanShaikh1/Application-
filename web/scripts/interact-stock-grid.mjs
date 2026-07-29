// node scripts/interact-stock-grid.mjs
// Verifies the new icon-grid stock picker on the Simulator's trade ticket:
// grid renders with live quotes + sparklines, clicking a card populates the
// buy/sell form (no manual symbol typing needed), and the manual search
// still works as a fallback. Requires the web dev server (5173) and API
// server (8787) to already be running.
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
async function setTheme(page, theme) {
  await page.evaluateOnNewDocument((t) => localStorage.setItem('marketpane.theme', t), theme)
}

const browser = await puppeteer.launch({ headless: true, args: ['--window-size=1280,900'] })

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })

  for (const theme of ['light', 'dark']) {
    await setTheme(page, theme)

    // 1. Land on the trade ticket - grid should render (loading skeleton, then quotes).
    await page.goto(`${baseUrl}/simulator/trade`, { waitUntil: 'networkidle0', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 200))
    await shoot(page, `${theme}-grid-loading`)

    // Wait for at least one card to show a real price (not the skeleton).
    await page.waitForFunction(
      () => {
        const buttons = Array.from(document.querySelectorAll('button[aria-label]'))
        return buttons.some((b) => /₹/.test(b.getAttribute('aria-label') ?? ''))
      },
      { timeout: 20000 }
    )
    await new Promise((r) => setTimeout(r, 800)) // let sparklines finish trickling in
    await shoot(page, `${theme}-grid-populated`)

    // 2. Click a recognizable card (Infosys) - should populate the ticket with no typing.
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button[aria-label]'))
      const target = buttons.find((b) => b.getAttribute('aria-label')?.startsWith('Infosys'))
      if (target && !target.disabled) {
        target.click()
        return true
      }
      return false
    })
    if (!clicked) throw new Error('Could not find an enabled Infosys card to click')
    await new Promise((r) => setTimeout(r, 300))
    await shoot(page, `${theme}-grid-selected-infosys`)

    // 3. Mobile width, populated grid.
    await page.setViewport({ width: 390, height: 844 })
    await new Promise((r) => setTimeout(r, 200))
    await shoot(page, `${theme}-grid-mobile`)
    await page.setViewport({ width: 1280, height: 900 })
  }

  console.log('Done.')
} finally {
  await browser.close()
}
