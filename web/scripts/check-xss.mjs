import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: true })
try {
  const page = await browser.newPage()
  let alertFired = false
  page.on('dialog', async (dialog) => {
    alertFired = true
    await dialog.dismiss()
  })
  const consoleErrors = []
  page.on('pageerror', (err) => consoleErrors.push(String(err)))

  await page.goto('http://localhost:5173/scenario/noise-headline-01', { waitUntil: 'networkidle0', timeout: 30000 })

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

  const xssPayload = '<script>window.__xss=true</script><img src=x onerror="window.__xss2=true"> "; DROP TABLE users; --  ‮'
  await page.evaluate((text) => {
    const textarea = document.getElementById('rationale')
    if (textarea instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      setter.call(textarea, text)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }, xssPayload)

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    buttons.find((b) => b.textContent?.includes('Submit decision'))?.click()
  })
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {})
  await new Promise((r) => setTimeout(r, 500))

  const xssTriggered = await page.evaluate(() => Boolean(window.__xss || window.__xss2))
  const bodyHTML = await page.content()
  const containsLiveScriptTag = bodyHTML.includes('<script>window.__xss')

  console.log('URL after submit:', page.url())
  console.log('alertFired:', alertFired)
  console.log('xssTriggered (window flags set):', xssTriggered)
  console.log('page/console errors:', consoleErrors)
  console.log('rendered page contains a LIVE (unescaped) <script>window.__xss tag:', containsLiveScriptTag)
} finally {
  await browser.close()
}
