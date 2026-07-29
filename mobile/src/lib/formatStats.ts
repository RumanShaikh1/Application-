// Decision Replay scenarios are always framed in INR and always in
// normalised "Day N" time, never a real calendar date - see
// shared/types.ts's OHLCPoint comment. Pure functions, ported unchanged
// from web/src/lib/formatStats.ts - Intl.NumberFormat works the same way
// under Hermes as it does in a browser.

export function formatPrice(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
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
