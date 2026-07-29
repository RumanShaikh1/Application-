// node scripts/interact-sandbox-modal.mjs
// Verifies the reworked Sandbox: clicking a stock icon opens a MODAL in
// place (no route/URL change) with statistics + a real price graph, focus
// moves into the dialog, Escape and backdrop click both close it and
// restore focus to the trigger, and the not-yet-analyzed case degrades
// honestly inside the modal too. Requires the web dev server (5173) and
// API server (8787) to already be running.
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
async function setTheme(page, theme) {
  await page.evaluateOnNewDocument((t) => localStorage.setItem('marketpane.theme', t), theme)
}
async function clickCardByName(page, name) {
  const clicked = await page.evaluate((n) => {
    const button = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes(n))
    if (button) {
      button.click()
      return true
    }
    return false
  }, name)
  if (!clicked) throw new Error(`Could not find a card for "${name}"`)
}

const browser = await puppeteer.launch({ headless: true, args: ['--window-size=1280,900'] })

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })

  for (const theme of ['light', 'dark']) {
    await setTheme(page, theme)
    await page.goto(`${baseUrl}/sandbox`, { waitUntil: 'networkidle0', timeout: 30000 })
    const urlBeforeClick = page.url()

    // 1. Click Reliance - a modal should appear, URL must NOT change.
    await clickCardByName(page, 'Reliance Industries')
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 })
    await new Promise((r) => setTimeout(r, 500))
    if (page.url() !== urlBeforeClick) throw new Error(`Expected no URL change, went from ${urlBeforeClick} to ${page.url()}`)
    console.log(`${theme}: modal opened with no URL change - OK`)
    await shoot(page, `${theme}-sandbox-modal-open-fully-analyzed`)

    // 2. Focus should have moved into the dialog (the close button).
    const focusIsInsideDialog = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]')
      return dialog?.contains(document.activeElement) ?? false
    })
    if (!focusIsInsideDialog) throw new Error('Expected focus to move into the dialog on open')
    console.log(`${theme}: focus moved into the dialog on open - OK`)

    // 3. Escape closes it and restores focus to the trigger card.
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => document.querySelector('[role="dialog"]') === null, { timeout: 5000 })
    const focusRestoredLabel = await page.evaluate(() => document.activeElement?.textContent ?? '')
    if (!focusRestoredLabel.includes('Reliance Industries')) throw new Error(`Expected focus restored to the Reliance card, got: "${focusRestoredLabel}"`)
    console.log(`${theme}: Escape closed the modal and restored focus to the trigger - OK`)
    await shoot(page, `${theme}-sandbox-modal-closed-focus-restored`)

    // 4. Backdrop click also closes it - click far to the left at
    // mid-height, clearly outside both the centered max-w-xl dialog and the
    // header (not (10,10), which overlaps the header logo).
    await clickCardByName(page, 'Reliance Industries')
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 })
    await page.mouse.click(30, 450)
    await page.waitForFunction(() => document.querySelector('[role="dialog"]') === null, { timeout: 5000 })
    console.log(`${theme}: backdrop click closed the modal - OK`)

    // 5. A not-yet-analyzed company (HDFC Bank) - real graph + stats, honest placeholder for the rest.
    await clickCardByName(page, 'HDFC Bank')
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 })
    await new Promise((r) => setTimeout(r, 500))
    const hasHonestPlaceholder = await page.evaluate(() => document.body.textContent?.includes("hasn't been authored yet") ?? false)
    if (!hasHonestPlaceholder) throw new Error('Expected an honest "not yet authored" placeholder for HDFC Bank')
    await shoot(page, `${theme}-sandbox-modal-not-yet-analyzed`)
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => document.querySelector('[role="dialog"]') === null, { timeout: 5000 })

    // 6. Mobile width.
    await page.setViewport({ width: 390, height: 844 })
    await clickCardByName(page, 'Reliance Industries')
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 })
    await new Promise((r) => setTimeout(r, 500))
    await shoot(page, `${theme}-sandbox-modal-mobile`)
    await page.keyboard.press('Escape')
    await page.setViewport({ width: 1280, height: 900 })
  }

  console.log('All sandbox modal checks passed.')
} finally {
  await browser.close()
}
