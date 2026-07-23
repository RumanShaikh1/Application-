export function formatPrice(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
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

/** Compact large numbers, e.g. 4813633880064 -> "$4.81T". */
export function formatMarketCap(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 2
  }).format(value)
}
