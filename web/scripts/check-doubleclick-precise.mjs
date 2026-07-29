import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: true })
try {
  const page = await browser.newPage()
  const failedRequests = []
  page.on('requestfailed', (req) => failedRequests.push(req.url()))
  page.on('response', (res) => {
    if (res.status() === 404) failedRequests.push(`404: ${res.url()}`)
  })

  await page.goto('http://localhost:5173/scenario/panic-selling-01', { waitUntil: 'networkidle0', timeout: 30000 })
  console.log('404/failed requests on initial load:', failedRequests)

  const countStageCards = async () =>
    page.evaluate(() => Array.from(document.querySelectorAll('h2.mb-2, .text-xs.font-semibold.uppercase')).length)

  const before = await page.evaluate(() =>
    Array.from(document.querySelectorAll('div')).filter((d) => d.textContent?.trim() === 'Headline' || d.textContent?.trim() === 'Fundamentals').length
  )

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const btn = buttons.find((b) => b.textContent?.includes('Reveal next'))
    btn?.click()
    btn?.click()
    btn?.click()
  })
  await new Promise((r) => setTimeout(r, 1000))

  // Count how many distinct stage-kind labels appear (Fundamentals, Headline, Price update) -
  // with 3 total stages and 1 already shown, clicking "reveal next" 3x should
  // land on stage index 1 exactly once, not skip to 2 or 3, and not append duplicates.
  const kindLabels = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.uppercase')).map((el) => el.textContent?.trim())
  )
  console.log('Stage kind labels currently rendered:', kindLabels)

  const isFinalStageVisible = await page.evaluate(() => document.body.textContent?.includes('What do you do?'))
  console.log('Jumped straight to final stage (choices visible) after 3 rapid clicks from stage 0:', isFinalStageVisible)
} finally {
  await browser.close()
}
