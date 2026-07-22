import puppeteer from 'puppeteer'
import { mkdir } from 'fs/promises'
import path from 'path'

const url = process.argv[2]
const label = process.argv[3]

if (!url) {
  console.error('Usage: node screenshot.mjs <url> [label]')
  process.exit(1)
}

const outDir = path.resolve('./temporary screenshots')
await mkdir(outDir, { recursive: true })

const existing = (await import('fs')).readdirSync(outDir)
const nextNumber =
  existing.reduce((max, name) => {
    const match = name.match(/^screenshot-(\d+)/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0) + 1

const fileName = `screenshot-${nextNumber}${label ? `-${label}` : ''}.png`
const filePath = path.join(outDir, fileName)

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 }
})

try {
  const page = await browser.newPage()
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise((resolve) => setTimeout(resolve, 400))
  await page.screenshot({ path: filePath })
  console.log(`Saved ${filePath}`)
} finally {
  await browser.close()
}
