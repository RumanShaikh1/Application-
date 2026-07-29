// node scripts/screenshot-landing.mjs <label> [width] [height]
// Visits "/" twice on a fresh profile so the first-run redirect to /learn
// (which only fires once) is already consumed, then screenshots the actual
// landing page.
import puppeteer from 'puppeteer'
import { mkdir, readdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../../temporary screenshots')
await mkdir(outDir, { recursive: true })

const label = process.argv[2] ?? 'landing'
const width = Number(process.argv[3] ?? 1280)
const height = Number(process.argv[4] ?? 1100)
const baseUrl = process.env.WEB_BASE_URL ?? 'http://localhost:5173'

async function nextFileName() {
  const existing = await readdir(outDir)
  const nextNumber =
    existing.reduce((max, name) => {
      const match = name.match(/^screenshot-(\d+)/)
      return match ? Math.max(max, Number(match[1])) : max
    }, 0) + 1
  return path.join(outDir, `screenshot-${nextNumber}-${label}.png`)
}

const browser = await puppeteer.launch({ headless: true, args: [`--window-size=${width},${height}`] })

try {
  const page = await browser.newPage()
  await page.setViewport({ width, height })
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0', timeout: 30000 })
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((resolve) => setTimeout(resolve, 400))

  const filePath = await nextFileName()
  await page.screenshot({ path: filePath, fullPage: true })
  console.log(`Saved ${filePath} (from ${page.url()})`)
} finally {
  await browser.close()
}
