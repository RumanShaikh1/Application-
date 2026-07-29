import puppeteer from 'puppeteer'

async function clickButtonWithText(page, text) {
  const clicked = await page.evaluate((t) => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const target = buttons.find((b) => b.textContent?.includes(t))
    if (target) {
      target.click()
      return true
    }
    return false
  }, text)
  if (!clicked) throw new Error(`No button found containing text: "${text}"`)
}

async function typeInto(page, selector, text) {
  await page.evaluate(
    (sel, value) => {
      const el = document.querySelector(sel)
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
      setter.call(el, value)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    },
    selector,
    text
  )
}

const browser = await puppeteer.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })

  // Place a trade first so the dashboard actually has a holdings table to check.
  await page.goto('http://localhost:5173/simulator/trade', { waitUntil: 'networkidle0', timeout: 30000 })
  await typeInto(page, '#symbol', 'TCS.NS')
  await clickButtonWithText(page, 'Look up')
  await new Promise((r) => setTimeout(r, 1500))
  await page.evaluate(() => {
    const radio = document.querySelector('[role="radio"]')
    if (radio instanceof HTMLElement) radio.click()
  })
  await typeInto(page, '#quantity', '3')
  await typeInto(page, '#rationale', 'Checking table overflow behavior on the dashboard after a trade.')
  await clickButtonWithText(page, 'Place trade')
  await page.waitForFunction(() => document.body.textContent?.includes('Process score'), { timeout: 30000 })
  await clickButtonWithText(page, 'Back to portfolio')
  await page.waitForFunction(() => document.body.textContent?.includes('Trade history'), { timeout: 30000 })

  await page.setViewport({ width: 390, height: 844 })
  await new Promise((r) => setTimeout(r, 500))

  const info = await page.evaluate(() => {
    const table = document.querySelector('table')
    if (!table) return { tableFound: false }
    const scrollContainer = table.closest('.overflow-x-auto')
    return {
      tableFound: true,
      scrollContainerFound: Boolean(scrollContainer),
      scrollWidth: scrollContainer?.scrollWidth,
      clientWidth: scrollContainer?.clientWidth,
      isScrollable: scrollContainer ? scrollContainer.scrollWidth > scrollContainer.clientWidth : null,
      pageHasHorizontalOverflow: document.body.scrollWidth > document.documentElement.clientWidth + 1
    }
  })
  console.log(JSON.stringify(info, null, 2))
} finally {
  await browser.close()
}
