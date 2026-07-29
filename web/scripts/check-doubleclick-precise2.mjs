import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.goto('http://localhost:5173/scenario/panic-selling-01', { waitUntil: 'networkidle0', timeout: 30000 })

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const btn = buttons.find((b) => b.textContent?.includes('Reveal next'))
    btn?.click()
    btn?.click()
    btn?.click()
  })
  await new Promise((r) => setTimeout(r, 1000))

  const bodyText = await page.evaluate(() => document.body.textContent ?? '')
  console.log('Contains error text about stage not found:', bodyText.includes('was not found'))
  console.log('Contains Retry button:', bodyText.includes('Retry'))
  console.log('Contains "Loading the next piece":', bodyText.includes('Loading the next piece'))
  console.log('Full body text snippet:', bodyText.slice(0, 1500))
} finally {
  await browser.close()
}
