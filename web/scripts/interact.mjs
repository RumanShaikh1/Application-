// node scripts/interact.mjs
// Drives the full Decision Replay loop in a real headless browser and
// screenshots each meaningful state - the web/ equivalent of the
// extension's scripts/interact.mjs. Requires the web dev server (npm run
// dev, port 5173) and the API server (server/, port 8787) to already be
// running.
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
  console.log(`Saved ${filePath} (from ${page.url()})`)
}

async function clickButtonWithText(page, text) {
  const clicked = await page.evaluate((t) => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const target = buttons.find((b) => b.textContent?.includes(t))
    if (target) {
      target.click()
      return true
    }
    return false
  }, text)
  if (!clicked) throw new Error(`No button found containing text: "${text}"`)
}

async function clickFirstLinkMatching(page, hrefPrefix) {
  const clicked = await page.evaluate((prefix) => {
    const links = Array.from(document.querySelectorAll('a'))
    const target = links.find((a) => a.getAttribute('href')?.startsWith(prefix))
    if (target) {
      target.click()
      return true
    }
    return false
  }, hrefPrefix)
  if (!clicked) throw new Error(`No link found with href starting with: "${hrefPrefix}"`)
}

async function elementInfo(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)
    return el ? { text: el.textContent, tag: el.tagName } : null
  }, selector)
}

const browser = await puppeteer.launch({ headless: true, args: ['--window-size=1280,900'] })

try {
  const page = await browser.newPage()

  // 1. Scenario list, desktop.
  await page.setViewport({ width: 1280, height: 900 })
  await page.goto(`${baseUrl}/scenarios`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 300))
  await shoot(page, 'list-desktop')

  // 2. Scenario list, mobile width.
  await page.setViewport({ width: 390, height: 844 })
  await new Promise((r) => setTimeout(r, 200))
  await shoot(page, 'list-mobile')
  await page.setViewport({ width: 1280, height: 900 })

  // 3. Open a scenario (panic-selling-01 has 3 stages).
  await page.goto(`${baseUrl}/scenario/panic-selling-01`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 300))
  await shoot(page, 'player-stage0')

  // 4. Reveal remaining stages via mouse click.
  await clickButtonWithText(page, 'Reveal next')
  await new Promise((r) => setTimeout(r, 300))
  await shoot(page, 'player-stage1')

  await clickButtonWithText(page, 'Reveal next')
  await new Promise((r) => setTimeout(r, 300))
  await shoot(page, 'player-stage2-final-with-choices')

  // 5. The submit button is disabled with no choice picked - clicking it is a no-op.
  await clickButtonWithText(page, 'Submit decision')
  await new Promise((r) => setTimeout(r, 200))
  await shoot(page, 'player-no-choice-button-disabled')

  // 6. Keyboard-only: focus the first radio, arrow to a choice, Enter to confirm.
  await page.evaluate(() => {
    const radio = document.querySelector('[role="radio"]')
    if (radio instanceof HTMLElement) radio.focus()
  })
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  const selectedInfo = await page.evaluate(() => {
    const selected = document.querySelector('[role="radio"][aria-checked="true"]')
    return selected ? selected.textContent : null
  })
  console.log('Keyboard-selected choice:', selectedInfo)
  await shoot(page, 'player-keyboard-choice-selected')

  // 7. Now a choice is picked but no factors are - submitting should trigger
  // the new inline factorError message instead of proceeding.
  await clickButtonWithText(page, 'Submit decision')
  await new Promise((r) => setTimeout(r, 200))
  await shoot(page, 'player-factor-validation-error')

  // 8. Check two of the factor checkboxes (mouse - the checkboxes themselves
  // are native inputs, Tab/Space already work for free) and fill the now-
  // optional rationale field to exercise both signals together.
  await page.evaluate(() => {
    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
    checkboxes.slice(0, 2).forEach((checkbox) => checkbox.click())
  })
  await page.evaluate(() => {
    const textarea = document.querySelector('#rationale')
    if (textarea) textarea.focus()
  })
  await page.keyboard.type('The drop tracks a broad market-wide sell-off, and the stock has recovered from similarly sized pullbacks before.')
  await shoot(page, 'player-factors-selected-and-rationale-filled')

  // 9. Submit via mouse click and land on results.
  await clickButtonWithText(page, 'Submit decision')
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {})
  await new Promise((r) => setTimeout(r, 500))
  await shoot(page, 'results-desktop')

  await page.setViewport({ width: 390, height: 844 })
  await new Promise((r) => setTimeout(r, 200))
  await shoot(page, 'results-mobile')
  await page.setViewport({ width: 1280, height: 900 })

  // 10. Progress page should now show one completed attempt.
  await page.goto(`${baseUrl}/progress`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 300))
  await shoot(page, 'progress-populated')

  // 11. Unknown route -> 404 page.
  await page.goto(`${baseUrl}/this-route-does-not-exist`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 200))
  await shoot(page, 'notfound-404')

  // 12. Unknown scenario id -> the player's own error state (StatusState 'error' + Retry).
  await page.goto(`${baseUrl}/scenario/does-not-exist`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 400))
  await shoot(page, 'player-error-state')

  console.log('Done.')
} finally {
  await browser.close()
}
