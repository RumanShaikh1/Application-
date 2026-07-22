import { ipcRenderer } from 'electron'

/**
 * Runs inside the guest page loaded by <webview>. Captures text the user
 * highlights on the page and forwards it to the Electron main process,
 * which relays it on to the top-level renderer (the Translator pane).
 *
 * This file must stay fully self-contained (no imports from shared modules).
 * <webview> guests are sandboxed by default, and a sandboxed preload's
 * require() only resolves a small built-in allowlist - it cannot load the
 * extra chunk Rollup would otherwise split a shared import into, which
 * throws at load time and silently kills this whole script before any
 * listener attaches.
 */
const WEBVIEW_HIGHLIGHT_CHANNEL = 'webview:highlight'
const WEBVIEW_TICKERS_CHANNEL = 'webview:tickers'

let lastSentText = ''
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function readSelection(): string {
  const selection = window.getSelection()
  return selection ? selection.toString().trim() : ''
}

function sendIfChanged(text: string): void {
  if (text && text !== lastSentText) {
    lastSentText = text
    ipcRenderer.send(WEBVIEW_HIGHLIGHT_CHANNEL, text, window.location.href)
  }
}

// Selection is finalized on mouseup - send immediately.
window.addEventListener('mouseup', () => {
  sendIfChanged(readSelection())
})

// selectionchange fires continuously while dragging, so debounce it.
// It also fires when a selection is cleared (click elsewhere) - reset
// lastSentText in that case so re-highlighting the same words re-fires.
document.addEventListener('selectionchange', () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    const text = readSelection()
    if (!text) {
      lastSentText = ''
      return
    }
    sendIfChanged(text)
  }, 200)
})

/**
 * Best-effort stock ticker detection on the current page. There is no
 * universal markup convention across finance sites, so this combines a
 * reliable Yahoo Finance-specific signal with generic text patterns that
 * are common across financial news/data sites in general.
 */
const NON_TICKER_ACRONYMS = new Set([
  'CEO', 'CFO', 'CTO', 'COO', 'IPO', 'ETF', 'GDP', 'USA', 'USD', 'EUR', 'GBP',
  'JPY', 'INR', 'US', 'UK', 'EU', 'AI', 'PE', 'EPS', 'YOY', 'Q1', 'Q2', 'Q3',
  'Q4', 'FY', 'SEC', 'FDA', 'FED'
])

function isPlausibleTicker(symbol: string): boolean {
  return symbol.length >= 1 && symbol.length <= 6 && !NON_TICKER_ACRONYMS.has(symbol)
}

function extractTickers(): string[] {
  const found = new Set<string>()

  // Yahoo Finance (and some other sites) tag live-price widgets with the
  // ticker directly in a data attribute - the most reliable signal available.
  document.querySelectorAll('[data-symbol]').forEach((element) => {
    const symbol = element.getAttribute('data-symbol')?.toUpperCase() ?? ''
    if (/^[A-Z.-]{1,10}$/.test(symbol) && isPlausibleTicker(symbol)) {
      found.add(symbol)
    }
  })

  const text = document.body?.innerText ?? ''

  // Cashtags, e.g. "$AAPL"
  for (const match of text.matchAll(/\$([A-Z]{1,5})\b/g)) {
    if (isPlausibleTicker(match[1])) found.add(match[1])
  }

  // Exchange-qualified mentions, e.g. "(NASDAQ: NVDA)"
  for (const match of text.matchAll(/\((?:NASDAQ|NYSE|NSE|BSE)\s*:\s*([A-Z]{1,10})\)/g)) {
    if (isPlausibleTicker(match[1])) found.add(match[1])
  }

  // A ticker immediately followed by a signed percentage, e.g. "NVDA +1.97%",
  // which is how most finance sites render inline ticker/price widgets.
  for (const match of text.matchAll(/\b([A-Z]{1,5})\s+[+-]\d+(?:\.\d+)?%/g)) {
    if (isPlausibleTicker(match[1])) found.add(match[1])
  }

  return Array.from(found).slice(0, 6)
}

let lastSentTickersKey = ''

function scanAndSendTickers(): void {
  const tickers = extractTickers()
  const key = tickers.join(',')
  if (key === lastSentTickersKey) return
  lastSentTickersKey = key
  ipcRenderer.send(WEBVIEW_TICKERS_CHANNEL, tickers)
}

let tickerScanTimer: ReturnType<typeof setTimeout> | null = null

function scheduleTickerScan(): void {
  if (tickerScanTimer) clearTimeout(tickerScanTimer)
  tickerScanTimer = setTimeout(scanAndSendTickers, 800)
}

function startTickerWatch(): void {
  scanAndSendTickers()
  if (document.body) {
    new MutationObserver(scheduleTickerScan).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    })
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startTickerWatch)
} else {
  startTickerWatch()
}
