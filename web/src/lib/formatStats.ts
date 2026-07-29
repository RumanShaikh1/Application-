// Decision Replay scenarios are always framed in INR (Indian-market
// education product) and always in normalised "Day N" time, never a real
// calendar date - see shared/types.ts's OHLCPoint comment. The simulator
// trades real symbols, which can carry their own currency (StockStats.currency)
// - `currency` defaults to INR so every existing Decision Replay call site
// keeps working unchanged.
export function formatPrice(value: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

export function formatPercent(value: number): string {
  const formatted = `${Math.abs(value).toFixed(2)}%`
  return value >= 0 ? `+${formatted}` : `-${formatted}`
}

export function formatDay(day: number): string {
  return `Day ${day}`
}

/** Empty string for an unparseable/missing date, never "NaN" - used to compare the sandbox fundamentals snapshot's year against the price window's year (see SandboxFundamentalsSnapshot.windowId in shared/types.ts). */
export function yearOf(dateString: string | undefined): string {
  if (!dateString) return ''
  const year = new Date(dateString).getFullYear()
  return Number.isNaN(year) ? '' : String(year)
}
