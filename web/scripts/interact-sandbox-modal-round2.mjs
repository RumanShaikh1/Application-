// node scripts/interact-sandbox-modal-round2.mjs
// Round 2: the actual Tab-cycle wrap-around (not just "focus starts inside"),
// and that body scroll is locked while the modal is open and restored after.
import puppeteer from 'puppeteer'

const baseUrl = process.env.WEB_BASE_URL ?? 'http://localhost:5173'
const browser = await puppeteer.launch({ headless: true, args: ['--window-size=1280,900'] })

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  await page.goto(`${baseUrl}/sandbox`, { waitUntil: 'networkidle0', timeout: 30000 })

  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Reliance Industries'))
    button?.click()
  })
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 })
  await new Promise((r) => setTimeout(r, 400))

  const overflowWhileOpen = await page.evaluate(() => document.body.style.overflow)
  if (overflowWhileOpen !== 'hidden') throw new Error(`Expected body scroll locked while open, got overflow="${overflowWhileOpen}"`)
  console.log('Body scroll locked while modal is open: OK')

  // Shift+Tab from the first focusable element (the close button, which
  // received initial focus) must wrap to the LAST focusable element in the dialog.
  const closeButtonIsFirstFocus = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Close')
  if (!closeButtonIsFirstFocus) throw new Error('Expected the close button to hold initial focus')

  await page.keyboard.down('Shift')
  await page.keyboard.press('Tab')
  await page.keyboard.up('Shift')
  const afterShiftTab = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]')
    const focusable = Array.from(dialog.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'))
    return { isLast: document.activeElement === focusable[focusable.length - 1], focusableCount: focusable.length }
  })
  if (!afterShiftTab.isLast) throw new Error(`Expected Shift+Tab from the first element to wrap to the last of ${afterShiftTab.focusableCount} focusable elements`)
  console.log(`Shift+Tab wrapped from first to last focusable element (of ${afterShiftTab.focusableCount}): OK`)

  // Tab forward from there should wrap back to the first (the close button).
  await page.keyboard.press('Tab')
  const wrappedToFirst = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Close')
  if (!wrappedToFirst) throw new Error('Expected Tab from the last element to wrap back to the close button')
  console.log('Tab wrapped from last back to first: OK')

  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelector('[role="dialog"]') === null, { timeout: 5000 })
  const overflowAfterClose = await page.evaluate(() => document.body.style.overflow)
  if (overflowAfterClose === 'hidden') throw new Error('Expected body scroll to be restored after closing')
  console.log('Body scroll restored after close: OK')

  console.log('All round-2 modal checks passed.')
} finally {
  await browser.close()
}
