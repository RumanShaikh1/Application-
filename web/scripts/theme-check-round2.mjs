// node scripts/theme-check-round2.mjs
// Round 2: verifies the toggle button itself (click interaction, not just a
// pre-set preference), mobile widths, and two routes round 1 didn't cover.
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

const browser = await puppeteer.launch({ headless: true, args: ['--window-size=1280,900'] })

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })

  async function currentThemeLabel() {
    return page.evaluate(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  }

  async function clickToggle() {
    const clicked = await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('aria-label')?.startsWith('Switch to'))
      if (button instanceof HTMLElement) {
        button.click()
        return true
      }
      return false
    })
    if (!clicked) throw new Error('Theme toggle button not found')
  }

  // 1. Fresh load, no stored preference - follows the system/browser default
  // (this headless environment defaults to dark, which is itself proof the
  // system-preference fallback works).
  await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 300))
  const initialTheme = await currentThemeLabel()
  console.log('Initial theme (system default):', initialTheme)
  await shoot(page, `toggle-before-click-${initialTheme}`)

  // 2. Click the toggle button itself (not a pre-set localStorage value) - must flip.
  await clickToggle()
  await new Promise((r) => setTimeout(r, 400))
  const afterClick = await currentThemeLabel()
  if (afterClick === initialTheme) throw new Error(`Toggle click did not change theme (still ${afterClick})`)
  console.log('Theme after click:', afterClick)
  await shoot(page, `toggle-after-click-${afterClick}`)

  // 3. Reload - the click should have persisted via localStorage.
  await page.reload({ waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 300))
  const afterReload = await currentThemeLabel()
  if (afterReload !== afterClick) throw new Error(`Theme did not persist across reload (expected ${afterClick}, got ${afterReload})`)
  await shoot(page, `toggle-persisted-after-reload-${afterReload}`)

  // 4. Click again to flip back, confirm the label/icon flips too.
  await clickToggle()
  await new Promise((r) => setTimeout(r, 400))
  const afterSecondClick = await currentThemeLabel()
  if (afterSecondClick !== initialTheme) throw new Error(`Second click did not return to the original theme (expected ${initialTheme}, got ${afterSecondClick})`)
  await shoot(page, `toggle-back-to-${afterSecondClick}`)

  // 5. Mobile width, both themes, scenario list.
  await page.setViewport({ width: 390, height: 844 })
  await new Promise((r) => setTimeout(r, 200))
  await shoot(page, `mobile-${await currentThemeLabel()}-list`)
  await clickToggle()
  await new Promise((r) => setTimeout(r, 400))
  await shoot(page, `mobile-${await currentThemeLabel()}-list`)
  await page.setViewport({ width: 1280, height: 900 })

  // 6. Two routes round 1 didn't cover - simulator trade ticket, tax FY overview.
  await page.goto(`${baseUrl}/simulator/trade`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 400))
  await shoot(page, 'dark-simulator-trade')

  await page.goto(`${baseUrl}/tax/fy-overview`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 400))
  await shoot(page, 'dark-tax-fy-overview')

  console.log('Done.')
} finally {
  await browser.close()
}
