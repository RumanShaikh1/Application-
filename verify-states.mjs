import puppeteer from 'puppeteer'
import { mkdir, readdir } from 'fs/promises'
import path from 'path'

const outDir = path.resolve('./temporary screenshots')
await mkdir(outDir, { recursive: true })

let counter = (
  await readdir(outDir).then((files) =>
    files.reduce((max, name) => {
      const match = name.match(/^screenshot-(\d+)/)
      return match ? Math.max(max, Number(match[1])) : max
    }, 0)
  )
) + 1

async function shot(page, label) {
  const fileName = `screenshot-${counter}-${label}.png`
  await page.screenshot({ path: path.join(outDir, fileName) })
  console.log(`Saved ${fileName}`)
  counter += 1
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1440, height: 900 } })

try {
  const page = await browser.newPage()
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('CONSOLE ERROR:', msg.text())
  })

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' })
  await wait(300)

  // --- 1. Empty states (default) ---
  await shot(page, 'right-pane-empty-states')

  // --- 2. Translator: force a guaranteed success, trigger highlight -> loading -> populated ---
  await page.evaluate(() => {
    Math.random = () => 0.99 // stays above the 0.12 failure threshold
  })
  await page.evaluate(() => window.__devEmitHighlight('Nasdaq rallied 2.3% as chip stocks surged on strong earnings'))
  await wait(150)
  await shot(page, 'translator-loading')
  await wait(700)
  await shot(page, 'translator-populated-beginner')

  // --- 3. Persona switch: Gamer ---
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button[role="radio"]'))
    const gamerBtn = buttons.find((b) => b.textContent?.trim() === 'Gamer')
    gamerBtn?.click()
  })
  await wait(750)
  await shot(page, 'translator-populated-gamer')

  // --- 4. Persona switch: Mechanical Engineer ---
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button[role="radio"]'))
    const engineerBtn = buttons.find((b) => b.textContent?.includes('Mechanical'))
    engineerBtn?.click()
  })
  await wait(750)
  await shot(page, 'translator-populated-engineer')

  // --- 5. Translator: force failure, trigger highlight -> error state ---
  await page.evaluate(() => {
    Math.random = () => 0.01 // below the 0.12 failure threshold -> guaranteed failure
  })
  await page.evaluate(() => window.__devEmitHighlight('Bitcoin fell 4% amid broader crypto volatility'))
  await wait(750)
  await shot(page, 'translator-error')

  // Retry with Math.random restored to succeed this time
  await page.evaluate(() => {
    Math.random = () => 0.99
  })
  await page.evaluate(() => {
    const retryBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Retry')
    retryBtn?.click()
  })
  await wait(750)
  await shot(page, 'translator-retry-recovered')

  // --- 6. Simulator: buy-form validation error (empty/invalid quantity) ---
  await page.evaluate(() => {
    Math.random = () => 0.99 // ensure feed connects successfully first
  })
  await wait(900) // feed connect delay
  await page.type('#buy-shares', '0')
  await page.click('button[type="submit"]')
  await wait(150)
  await shot(page, 'simulator-buy-validation-error')

  // --- 7. Simulator: successful buy -> populated position ---
  await page.evaluate(() => {
    const input = document.querySelector('#buy-shares')
    input.value = ''
  })
  await page.type('#buy-shares', '10')
  await page.click('button[type="submit"]')
  await wait(700)
  await shot(page, 'simulator-buy-success-populated')

  // --- 8. Full page scroll capture of the right pane in its final populated state ---
  await page.setViewport({ width: 1440, height: 1100 })
  await wait(200)
  await shot(page, 'full-populated-tall')
} finally {
  await browser.close()
}
