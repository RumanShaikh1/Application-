import puppeteer from 'puppeteer'
import { mkdir, readdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../../temporary screenshots')
await mkdir(outDir, { recursive: true })

async function nextFileName(label) {
  const existing = await readdir(outDir)
  const nextNumber =
    existing.reduce((max, name) => {
      const match = name.match(/^screenshot-(\d+)/)
      return match ? Math.max(max, Number(match[1])) : max
    }, 0) + 1
  return path.join(outDir, `screenshot-${nextNumber}-${label}.png`)
}

const browser = await puppeteer.launch({ headless: true, args: ['--window-size=1280,900'] })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  await page.goto('http://localhost:5173/scenario/panic-selling-01', { waitUntil: 'networkidle0', timeout: 30000 })

  // Reveal all stages via the "Reveal next" button.
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      buttons.find((b) => b.textContent?.includes('Reveal next'))?.click()
    })
    await new Promise((r) => setTimeout(r, 400))
  }

  // Select a choice (enables the submit button) but leave rationale blank.
  await page.evaluate(() => {
    const radio = document.querySelector('[role="radio"]')
    if (radio instanceof HTMLElement) radio.click()
  })
  await new Promise((r) => setTimeout(r, 150))

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    buttons.find((b) => b.textContent?.includes('Submit decision'))?.click()
  })
  await new Promise((r) => setTimeout(r, 200))

  const errorText = await page.evaluate(() => document.getElementById('rationale-error')?.textContent ?? null)
  console.log('rationale-error text:', errorText)

  const filePath = await nextFileName('rationale-empty-validation')
  await page.screenshot({ path: filePath, fullPage: true })
  console.log(`Saved ${filePath}`)
} finally {
  await browser.close()
}
