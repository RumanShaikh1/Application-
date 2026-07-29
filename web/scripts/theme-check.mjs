// node scripts/theme-check.mjs
// Verifies day/night mode across the app: visits a set of representative
// pages/states in both light and dark mode and screenshots each. Requires
// the web dev server (5173) and API server (8787) to already be running.
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

async function setThemeBeforeLoad(page, theme) {
  await page.evaluateOnNewDocument((t) => {
    localStorage.setItem('marketpane.theme', t)
  }, theme)
}

const browser = await puppeteer.launch({ headless: true, args: ['--window-size=1280,900'] })

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })

  for (const theme of ['light', 'dark']) {
    await setThemeBeforeLoad(page, theme)

    // 1. Scenario list - cards, difficulty pills (lime/cobalt/vermilion), nav + toggle.
    await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 300))
    await shoot(page, `${theme}-list`)

    // 2. Scenario player, final stage - FactorSelect, ChoiceSelector, price chart (fixed-dark panel).
    await page.goto(`${baseUrl}/scenario/panic-selling-01`, { waitUntil: 'networkidle0', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 300))
    await clickButtonWithText(page, 'Reveal next')
    await new Promise((r) => setTimeout(r, 250))
    await clickButtonWithText(page, 'Reveal next')
    await new Promise((r) => setTimeout(r, 250))
    await shoot(page, `${theme}-player-final-stage`)

    // 3. Results page - score pill, criteria checklist, "what happened" chart card.
    await page.evaluate(() => {
      const radio = document.querySelector('[role="radio"]')
      if (radio instanceof HTMLElement) radio.focus()
    })
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Enter')
    await page.evaluate(() => {
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
      checkboxes.slice(0, 2).forEach((checkbox) => checkbox.click())
    })
    await clickButtonWithText(page, 'Submit decision')
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {})
    await new Promise((r) => setTimeout(r, 400))
    await shoot(page, `${theme}-results`)

    // 4. Progress page - populated attempt list, quality pills.
    await page.goto(`${baseUrl}/progress`, { waitUntil: 'networkidle0', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 300))
    await shoot(page, `${theme}-progress`)

    // 5. Simulator dashboard - portfolio card, buttons.
    await page.goto(`${baseUrl}/simulator`, { waitUntil: 'networkidle0', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 400))
    await shoot(page, `${theme}-simulator`)

    // 6. Trade cost comparator - form, cobalt "indicative estimate" chip.
    await page.goto(`${baseUrl}/tax`, { waitUntil: 'networkidle0', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 300))
    await shoot(page, `${theme}-tax`)

    // 7. 404 page - empty-state icon badge.
    await page.goto(`${baseUrl}/this-route-does-not-exist`, { waitUntil: 'networkidle0', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 200))
    await shoot(page, `${theme}-notfound`)
  }

  console.log('Done.')
} finally {
  await browser.close()
}
