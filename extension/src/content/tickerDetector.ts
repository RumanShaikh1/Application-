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
  'Q4', 'FY', 'SEC', 'FDA', 'FED',
  // India-specific acronyms that collide with the "WORD +1.2%" percent
  // pattern on Indian finance pages (mutual-fund/bank/regulator jargon that
  // reads like a ticker in that shape).
  'NAV', 'AUM', 'SIP', 'REIT', 'CPI', 'MF', 'NPA', 'RBI', 'GST', 'NBFC'
])

/** Yahoo requires the exchange suffix to disambiguate an Indian listing from a same-lettered US one - RELIANCE without it resolves to nothing, or worse, an unrelated US ticker. NASDAQ/NYSE mentions are deliberately absent here: those tickers are queried bare, same as today. */
const EXCHANGE_SUFFIXES: Record<string, string> = {
  NSE: '.NS',
  BSE: '.BO'
}

// The regexes below each cap their own capture length; these are the
// plausibility ceilings applied on top, and they intentionally differ per
// signal - unlike the single shared 6-char cap this replaces, which silently
// rejected real Indian symbols (RELIANCE, BHARTIARTL, ULTRACEMCO all run
// past 6 letters) while doing nothing useful for the already-short cashtag
// and percent-pattern signals.
const MAX_BARE_SYMBOL_LENGTH = 5
const MAX_EXCHANGE_QUALIFIED_BASE_LENGTH = 10
const MAX_DATA_SYMBOL_LENGTH = 15

/** Validates a bare, letters-only base symbol - before any exchange suffix is attached. */
function isPlausibleBaseSymbol(symbol: string, maxLength: number): boolean {
  return symbol.length >= 1 && symbol.length <= maxLength && !NON_TICKER_ACRONYMS.has(symbol)
}

/** data-symbol attributes may already carry a real suffix (Yahoo pages render e.g. "INFY.NS" directly) - dots/hyphens are part of the charset here, and the length ceiling is wider to fit base+suffix without rejecting a real long Indian symbol. */
function isPlausibleDataSymbol(symbol: string): boolean {
  return new RegExp(`^[A-Z.-]{1,${MAX_DATA_SYMBOL_LENGTH}}$`).test(symbol) && !NON_TICKER_ACRONYMS.has(symbol)
}

/**
 * Resolves an exchange-qualified mention's captured base symbol (e.g.
 * "RELIANCE" from "(NSE: RELIANCE)") to what the server actually needs to
 * query Yahoo with. Validates the base symbol first, then attaches the
 * suffix - the suffixed result is never re-validated against a bare-symbol
 * rule, since ".NS"/".BO" would fail a letters-only check by design.
 * Returns null if the base symbol itself isn't plausible.
 */
export function resolveExchangeQualifiedSymbol(exchange: string, baseSymbol: string): string | null {
  if (!isPlausibleBaseSymbol(baseSymbol, MAX_EXCHANGE_QUALIFIED_BASE_LENGTH)) return null
  const suffix = EXCHANGE_SUFFIXES[exchange]
  return suffix ? `${baseSymbol}${suffix}` : baseSymbol
}

/**
 * The pure string-matching core of ticker detection - no DOM access, so
 * it's directly unit-testable. `extractTickers()` below is a thin wrapper
 * that reads the live page and delegates here.
 */
export function extractTickersFromContent(bodyText: string, dataSymbolAttributes: string[]): string[] {
  const found = new Set<string>()

  for (const raw of dataSymbolAttributes) {
    const symbol = raw.toUpperCase()
    if (isPlausibleDataSymbol(symbol)) found.add(symbol)
  }

  // Cashtags, e.g. "$AAPL"
  for (const match of bodyText.matchAll(/\$([A-Z]{1,5})\b/g)) {
    if (isPlausibleBaseSymbol(match[1], MAX_BARE_SYMBOL_LENGTH)) found.add(match[1])
  }

  // Exchange-qualified mentions, e.g. "(NASDAQ: NVDA)" or "(NSE: RELIANCE)" -
  // the exchange is captured (not discarded) so NSE/BSE can be suffixed.
  for (const match of bodyText.matchAll(/\((NASDAQ|NYSE|NSE|BSE)\s*:\s*([A-Z]{1,10})\)/g)) {
    const resolved = resolveExchangeQualifiedSymbol(match[1], match[2])
    if (resolved) found.add(resolved)
  }

  // A ticker immediately followed by a signed percentage, e.g. "NVDA +1.97%",
  // which is how most finance sites render inline ticker/price widgets.
  for (const match of bodyText.matchAll(/\b([A-Z]{1,5})\s+[+-]\d+(?:\.\d+)?%/g)) {
    if (isPlausibleBaseSymbol(match[1], MAX_BARE_SYMBOL_LENGTH)) found.add(match[1])
  }

  return Array.from(found).slice(0, 6)
}

function extractTickers(): string[] {
  const dataSymbolAttributes = Array.from(document.querySelectorAll('[data-symbol]'))
    .map((element) => element.getAttribute('data-symbol') ?? '')
    .filter(Boolean)
  const bodyText = document.body?.innerText ?? ''
  return extractTickersFromContent(bodyText, dataSymbolAttributes)
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
