// Drives the beginner curriculum end to end on a fresh profile: wrong
// answer -> feedback -> retry -> correct answer -> unlock -> continue,
// through all 5 parts (including the two multi-select questions), then the
// completion screen. Screenshots each meaningful state.
import puppeteer from 'puppeteer'
import { mkdir, readdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../../temporary screenshots')
await mkdir(outDir, { recursive: true })
const baseUrl = process.env.WEB_BASE_URL ?? 'http://localhost:5173'

async function nextFileName(label) {
  const existing = await readdir(outDir)
  const nextNumber =
    existing.reduce((max, name) => {
      const match = name.match(/^screenshot-(\d+)/)
      return match ? Math.max(max, Number(match[1])) : max
    }, 0) + 1
  return path.join(outDir, `screenshot-${nextNumber}-${label}.png`)
}

async function shoot(page, label) {
  const filePath = await nextFileName(label)
  await page.screenshot({ path: filePath, fullPage: true })
  console.log(`Saved ${filePath} (from ${page.url()})`)
}

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

// Picks the FIRST option's radio/checkbox within the Nth "Quick check" question
// card on the page (0-indexed) - used to submit a deliberately wrong answer.
async function selectFirstOptionInQuestion(page, questionIndex, multiSelect) {
  await page.evaluate(
    (index, isMulti) => {
      const cards = Array.from(document.querySelectorAll('section')).find((s) => s.textContent?.includes('Quick check'))
      const questionCards = cards ? Array.from(cards.querySelectorAll(':scope > div')) : []
      const card = questionCards[index]
      if (!card) throw new Error(`No question card at index ${index}`)
      const input = isMulti ? card.querySelector('input[type="checkbox"]') : card.querySelector('[role="radio"]')
      if (input instanceof HTMLElement) input.click()
    },
    questionIndex,
    multiSelect
  )
}

const browser = await puppeteer.launch({ headless: true, args: ['--window-size=1280,1400'] })

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 1400 })
  await page.goto(`${baseUrl}/learn`, { waitUntil: 'networkidle0', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 300))

  // Part 1: submit a wrong answer first, see feedback, retry, then submit correct.
  await selectFirstOptionInQuestion(page, 0, false) // option "a" IS correct for part 1's question, so pick a different one to force wrong
  // Deselect by picking option b/c instead - re-run with an explicit id-based click.
  await page.evaluate(() => {
    const radios = document.querySelectorAll('[role="radio"]')
    const wrong = radios[1] // second option is a distractor for every question in this content
    if (wrong instanceof HTMLElement) wrong.click()
  })
  await clickButtonWithText(page, 'Check answer')
  await new Promise((r) => setTimeout(r, 200))
  await shoot(page, 'learn-part1-wrong-answer')

  await clickButtonWithText(page, 'Try again')
  await page.evaluate(() => {
    const radios = document.querySelectorAll('[role="radio"]')
    const correct = radios[0] // option "a" is correct for every single-select question in this content
    if (correct instanceof HTMLElement) correct.click()
  })
  await clickButtonWithText(page, 'Check answer')
  await new Promise((r) => setTimeout(r, 200))
  await shoot(page, 'learn-part1-correct-unlocked')

  await clickButtonWithText(page, 'Continue to Part 2')
  await new Promise((r) => setTimeout(r, 200))

  // Part 2: single question, answer correctly straight away.
  await page.evaluate(() => {
    const radio = document.querySelector('[role="radio"]')
    if (radio instanceof HTMLElement) radio.click()
  })
  await clickButtonWithText(page, 'Check answer')
  await new Promise((r) => setTimeout(r, 200))
  await shoot(page, 'learn-part2-correct')
  await clickButtonWithText(page, 'Continue to Part 3')
  await new Promise((r) => setTimeout(r, 200))

  // Part 3: one single-select + one multi-select question.
  await shoot(page, 'learn-part3-multiselect-visible')
  await page.evaluate(() => {
    const radio = document.querySelector('[role="radio"]')
    if (radio instanceof HTMLElement) radio.click()
  })
  await page.evaluate(() => {
    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
    // First question's checkboxes belong to the multi-select; correct ids are "a" and "b" (first two).
    checkboxes.slice(0, 2).forEach((cb) => cb.click())
  })
  const checkButtons = await page.$$eval('button', (buttons) => buttons.filter((b) => b.textContent?.includes('Check answer')).length)
  console.log('Part 3 "Check answer" buttons found:', checkButtons)
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button'))
      .filter((b) => b.textContent?.includes('Check answer'))
      .forEach((b) => b.click())
  })
  await new Promise((r) => setTimeout(r, 200))
  await shoot(page, 'learn-part3-both-correct')
  await clickButtonWithText(page, 'Continue to Part 4')
  await new Promise((r) => setTimeout(r, 200))

  // Part 4: same shape as part 3.
  await page.evaluate(() => {
    const radio = document.querySelector('[role="radio"]')
    if (radio instanceof HTMLElement) radio.click()
  })
  await page.evaluate(() => {
    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
    checkboxes.slice(0, 2).forEach((cb) => cb.click())
  })
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button'))
      .filter((b) => b.textContent?.includes('Check answer'))
      .forEach((b) => b.click())
  })
  await new Promise((r) => setTimeout(r, 200))
  await clickButtonWithText(page, 'Continue to Part 5')
  await new Promise((r) => setTimeout(r, 200))

  // Part 5: final question, then completion screen.
  await page.evaluate(() => {
    const radio = document.querySelector('[role="radio"]')
    if (radio instanceof HTMLElement) radio.click()
  })
  await clickButtonWithText(page, 'Check answer')
  await new Promise((r) => setTimeout(r, 300))
  await shoot(page, 'learn-part5-complete-screen')

  // Step indicator should now show all 5 segments as completed (lime).
  await page.setViewport({ width: 390, height: 1400 })
  await new Promise((r) => setTimeout(r, 200))
  await shoot(page, 'learn-complete-mobile')

  console.log('Done.')
} finally {
  await browser.close()
}
