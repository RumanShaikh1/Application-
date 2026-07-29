import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: true })
try {
  const page = await browser.newPage()
  const pageErrors = []
  const consoleWarnings = []
  page.on('pageerror', (err) => pageErrors.push(String(err)))
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') consoleWarnings.push(`[${msg.type()}] ${msg.text()}`)
  })

  console.log('--- Test 1: rapid double-click on "Reveal next" (synchronous double dispatch) ---')
  await page.goto('http://localhost:5173/scenario/panic-selling-01', { waitUntil: 'networkidle0', timeout: 30000 })
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const btn = buttons.find((b) => b.textContent?.includes('Reveal next'))
    // Fire two click events in the SAME synchronous tick, before React can
    // re-render and remove the button.
    btn?.click()
    btn?.click()
  })
  await new Promise((r) => setTimeout(r, 800))
  const stageCardCount = await page.evaluate(() => document.querySelectorAll('[class*="animate-fade-in"]').length)
  const stageIndices = await page.evaluate(() => {
    // Read the stage headers rendered (Headline/Fundamentals/Price update/Filing labels) to count actual stage cards.
    return Array.from(document.querySelectorAll('h2, div')).length // rough
  })
  console.log('Rendered without crash. Page errors so far:', pageErrors)

  console.log('--- Test 2: fresh direct navigation to /scenario/:id/results (no router state) ---')
  await page.goto('http://localhost:5173/scenario/panic-selling-01/results', { waitUntil: 'networkidle0', timeout: 30000 })
  const emptyStateText = await page.evaluate(() => document.body.textContent?.includes('No result to show'))
  console.log('Shows graceful empty state on fresh /results load:', emptyStateText)

  console.log('--- Test 3: refresh mid-scenario (reload on stage 2) ---')
  await page.goto('http://localhost:5173/scenario/panic-selling-01', { waitUntil: 'networkidle0', timeout: 30000 })
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    buttons.find((b) => b.textContent?.includes('Reveal next'))?.click()
  })
  await new Promise((r) => setTimeout(r, 400))
  await page.reload({ waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 400))
  const afterReloadHasRevealNext = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    return Boolean(buttons.find((b) => b.textContent?.includes('Reveal next')))
  })
  console.log('After reload mid-scenario, restarts cleanly at stage 0 (Reveal next visible again):', afterReloadHasRevealNext)

  console.log('--- Test 4: browser back button after reaching results ---')
  await page.goto('http://localhost:5173/scenario/panic-selling-01', { waitUntil: 'networkidle0', timeout: 30000 })
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      buttons.find((b) => b.textContent?.includes('Reveal next'))?.click()
    })
    await new Promise((r) => setTimeout(r, 400))
  }
  await page.evaluate(() => {
    const radio = document.querySelector('[role="radio"]')
    if (radio instanceof HTMLElement) radio.click()
  })
  await page.evaluate((text) => {
    const textarea = document.getElementById('rationale')
    if (textarea instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      setter.call(textarea, text)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }, 'The drop is market-wide and within historical norms, so holding is reasonable here.')
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    buttons.find((b) => b.textContent?.includes('Submit decision'))?.click()
  })
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {})
  console.log('On results:', page.url())
  await page.goBack({ waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 500))
  console.log('After back button:', page.url())
  const backPageErrors = [...pageErrors]
  console.log('No crash after back navigation. Page errors:', backPageErrors)

  console.log('--- Test 5: extreme viewports ---')
  await page.setViewport({ width: 280, height: 600 })
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 30000 })
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  console.log('At 280px width, horizontal overflow present:', hasHorizontalOverflow)

  await page.setViewport({ width: 2560, height: 1440 })
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 30000 })
  const maxWidthConstrained = await page.evaluate(() => {
    const main = document.querySelector('main')
    return main ? main.getBoundingClientRect().width < 2000 : null
  })
  console.log('At 2560px width, content column is constrained (not full-bleed):', maxWidthConstrained)

  console.log('--- Final: all page/console errors observed across every test ---')
  console.log('pageErrors:', pageErrors)
  console.log('consoleWarnings:', consoleWarnings)
} finally {
  await browser.close()
}
