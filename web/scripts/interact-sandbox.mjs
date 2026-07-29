// node scripts/interact-sandbox.mjs
// Verifies the new Sandbox stock list + detail pages: the board renders all
// 20 real companies, clicking one navigates to a dedicated detail page (not
// an inline expansion), the fully-analyzed case (Reliance) shows stats +
// strengths/weaknesses + checkpoint timeline, and the not-yet-analyzed case
// degrades honestly. Requires the web dev server (5173) and API server
// (8787) to already be running.
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
async function setTheme(page, theme) {
  await page.evaluateOnNewDocument((t) => localStorage.setItem('marketpane.theme', t), theme)
}

const browser = await puppeteer.launch({ headless: true, args: ['--window-size=1280,900'] })

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })

  for (const theme of ['light', 'dark']) {
    await setTheme(page, theme)

    // 1. Sandbox list page - all 20 companies.
    await page.goto(`${baseUrl}/sandbox`, { waitUntil: 'networkidle0', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 400))
    await shoot(page, `${theme}-sandbox-list`)

    const cardCount = await page.evaluate(() => document.querySelectorAll('a[href^="/sandbox/stocks/"]').length)
    if (cardCount !== 20) throw new Error(`Expected 20 company cards, found ${cardCount}`)
    console.log(`${theme}: list shows ${cardCount} companies - OK`)

    // 2. Click Reliance - must navigate to a NEW page (URL change), not expand
    // inline. This is a client-side (React Router) route change, not a real
    // browser navigation, so poll the URL rather than waitForNavigation.
    const urlBefore = page.url()
    await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('a')).find((a) => a.textContent?.includes('Reliance Industries'))
      link?.click()
    })
    await page.waitForFunction(() => location.pathname.includes('/sandbox/stocks/RELIANCE.NS'), { timeout: 10000 })
    const urlAfter = page.url()
    if (urlAfter === urlBefore || !urlAfter.includes('/sandbox/stocks/RELIANCE.NS')) {
      throw new Error(`Expected navigation to a Reliance detail page, stayed at ${urlAfter}`)
    }
    console.log(`${theme}: clicking a card navigated to ${urlAfter} - OK`)
    await new Promise((r) => setTimeout(r, 500))
    await shoot(page, `${theme}-sandbox-detail-reliance-fully-analyzed`)

    // 3. A not-yet-analyzed company (HDFC Bank) - stats still shown, honest placeholder for the rest.
    await page.goto(`${baseUrl}/sandbox/stocks/HDFCBANK.NS`, { waitUntil: 'networkidle0', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 300))
    const hasHonestPlaceholder = await page.evaluate(() => document.body.textContent?.includes("hasn't been authored yet") ?? false)
    if (!hasHonestPlaceholder) throw new Error('Expected an honest "not yet authored" placeholder for HDFC Bank')
    await shoot(page, `${theme}-sandbox-detail-not-yet-analyzed`)

    // 4. Mobile width, list + detail.
    await page.setViewport({ width: 390, height: 844 })
    await page.goto(`${baseUrl}/sandbox`, { waitUntil: 'networkidle0', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 300))
    await shoot(page, `${theme}-sandbox-list-mobile`)
    await page.goto(`${baseUrl}/sandbox/stocks/RELIANCE.NS`, { waitUntil: 'networkidle0', timeout: 30000 })
    await new Promise((r) => setTimeout(r, 300))
    await shoot(page, `${theme}-sandbox-detail-mobile`)
    await page.setViewport({ width: 1280, height: 900 })
  }

  console.log('All sandbox UI checks passed.')
} finally {
  await browser.close()
}
