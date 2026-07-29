// Verifies the soft-gate contract end to end on two separate fresh
// profiles: (1) finishing the curriculum removes the landing-page reminder
// and revisiting "/" never redirects back to /learn; (2) clicking "Skip for
// now" also stops the auto-redirect, but the reminder banner stays (since
// the curriculum wasn't actually completed) - the site never nags, but never
// pretends a skip was completion either.
import puppeteer from 'puppeteer'

const baseUrl = process.env.WEB_BASE_URL ?? 'http://localhost:5173'

async function clickButtonWithText(page, text) {
  const clicked = await page.evaluate((t) => {
    const button = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes(t))
    if (button) {
      button.click()
      return true
    }
    return false
  }, text)
  if (!clicked) throw new Error(`No button found containing text: "${text}"`)
}

async function clickLinkWithText(page, text) {
  const clicked = await page.evaluate((t) => {
    const link = Array.from(document.querySelectorAll('a')).find((a) => a.textContent?.includes(t))
    if (link) {
      link.click()
      return true
    }
    return false
  }, text)
  if (!clicked) throw new Error(`No link found containing text: "${text}"`)
}

async function fastForwardThroughCurriculum(page) {
  for (let part = 0; part < 5; part++) {
    await page.evaluate(() => {
      const radio = document.querySelector('[role="radio"]')
      if (radio instanceof HTMLElement) radio.click()
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
      checkboxes.slice(0, 2).forEach((cb) => cb.click())
    })
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('button'))
        .filter((b) => b.textContent?.includes('Check answer'))
        .forEach((b) => b.click())
    })
    await new Promise((r) => setTimeout(r, 150))
    const isLast = part === 4
    if (!isLast) {
      await clickButtonWithText(page, `Continue to Part ${part + 2}`)
      await new Promise((r) => setTimeout(r, 150))
    }
  }
}

const browser = await puppeteer.launch({ headless: true, args: ['--window-size=1280,900'] })

try {
  // Scenario 1: complete the whole thing. Each scenario gets its own
  // incognito-style browser context - browser.newPage() alone would share
  // one localStorage across all three scenarios, which isn't what "three
  // fresh profiles" is supposed to test.
  const context1 = await browser.createBrowserContext()
  const page1 = await context1.newPage()
  await page1.setViewport({ width: 1280, height: 900 })
  await page1.goto(`${baseUrl}/learn`, { waitUntil: 'networkidle0', timeout: 30000 })
  await fastForwardThroughCurriculum(page1)
  await clickLinkWithText(page1, 'Back to home')
  await new Promise((r) => setTimeout(r, 300))
  const hasReminderAfterComplete = await page1.evaluate(() => document.body.textContent?.includes('New here? Start with the basics.'))
  console.log('[complete] url after "Back to home":', page1.url())
  console.log('[complete] reminder banner still shown:', hasReminderAfterComplete)

  await page1.goto(`${baseUrl}/`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 300))
  console.log('[complete] url after revisiting "/":', page1.url())

  // Scenario 2: skip instead of completing, on a separate fresh profile.
  const context2 = await browser.createBrowserContext()
  const page2 = await context2.newPage()
  await page2.setViewport({ width: 1280, height: 900 })
  await page2.goto(`${baseUrl}/`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 300))
  console.log('[skip] url after first "/" visit (should auto-redirect):', page2.url())

  await page2.evaluate(() => {
    const link = Array.from(document.querySelectorAll('a')).find((a) => a.textContent?.includes('Skip for now'))
    if (link instanceof HTMLElement) link.click()
  })
  await new Promise((r) => setTimeout(r, 300))
  console.log('[skip] url after clicking "Skip for now":', page2.url())
  const hasReminderAfterSkip = await page2.evaluate(() => document.body.textContent?.includes('New here? Start with the basics.'))
  console.log('[skip] reminder banner shown on landing:', hasReminderAfterSkip)

  await page2.goto(`${baseUrl}/`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 300))
  console.log('[skip] url after revisiting "/" again (should NOT redirect):', page2.url())

  // Deep link never blocked, even mid-way through (fresh 3rd profile, never visited /learn at all).
  const context3 = await browser.createBrowserContext()
  const page3 = await context3.newPage()
  await page3.setViewport({ width: 1280, height: 900 })
  await page3.goto(`${baseUrl}/simulator`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 300))
  console.log('[deep-link] url after visiting /simulator directly on a brand-new profile:', page3.url())
} finally {
  await browser.close()
}
