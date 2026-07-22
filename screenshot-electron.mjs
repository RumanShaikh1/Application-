// Screenshots the actual running Electron window (not a plain-browser proxy)
// by attaching to its Chrome DevTools Protocol endpoint. Start the app with
// `npx electron-vite dev --remoteDebuggingPort 9222` first.
import puppeteer from 'puppeteer'
import { mkdir, readdir } from 'fs/promises'
import path from 'path'

const label = process.argv[2]
const cdpPort = process.argv[3] ?? '9222'

const outDir = path.resolve('./temporary screenshots')
await mkdir(outDir, { recursive: true })

const existing = await readdir(outDir)
const nextNumber =
  existing.reduce((max, name) => {
    const match = name.match(/^screenshot-(\d+)/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0) + 1

const fileName = `screenshot-${nextNumber}${label ? `-${label}` : ''}.png`
const filePath = path.join(outDir, fileName)

const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${cdpPort}` })

try {
  const pages = await browser.pages()
  const page = pages.find((p) => p.url().startsWith('http://localhost')) ?? pages[0]
  if (!page) throw new Error('No Electron renderer page found on the CDP endpoint.')
  await page.setViewport({ width: 1440, height: 900 })
  await new Promise((resolve) => setTimeout(resolve, 300))
  await page.screenshot({ path: filePath })
  console.log(`Saved ${filePath} (from ${page.url()})`)
} finally {
  await browser.disconnect()
}
