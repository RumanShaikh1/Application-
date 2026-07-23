/**
 * Best-effort stock ticker detection on the current page. There is no
 * universal markup convention across finance sites, so this combines a
 * reliable Yahoo Finance-specific signal with generic text patterns that
 * are common across financial news/data sites in general. Ported from the
 * old Electron webview-preload's extractTickers().
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

export function watchTickers(onTickers: (symbols: string[]) => void): () => void {
  let lastSentKey = ''
  let scanTimer: ReturnType<typeof setTimeout> | null = null
  let observer: MutationObserver | null = null

  function scanAndSend(): void {
    const tickers = extractTickers()
    const key = tickers.join(',')
    if (key === lastSentKey) return
    lastSentKey = key
    onTickers(tickers)
  }

  function scheduleScan(): void {
    if (scanTimer) clearTimeout(scanTimer)
    scanTimer = setTimeout(scanAndSend, 800)
  }

  function start(): void {
    scanAndSend()
    if (document.body) {
      observer = new MutationObserver(scheduleScan)
      observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  } else {
    start()
  }

  return () => {
    if (scanTimer) clearTimeout(scanTimer)
    observer?.disconnect()
    document.removeEventListener('DOMContentLoaded', start)
  }
}
