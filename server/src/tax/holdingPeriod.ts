/**
 * Calendar-month-correct date math for the listed-equity long-term cutoff.
 * Deliberately NOT a naive 365-day count - Indian tax practice defines
 * "long term" for listed equity as holding for MORE than N calendar
 * months, which is not the same as N*30 or N*365 days once leap years and
 * variable month lengths are involved. All dates are ISO "YYYY-MM-DD"
 * strings, parsed/compared in UTC throughout so results never depend on
 * the server's local timezone.
 */

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Adds calendar months, clamping to the last day of the target month (Jan 31 + 1 month = Feb 28/29, never "March 3"). */
export function addMonths(iso: string, months: number): string {
  const date = parseIsoDate(iso)
  const day = date.getUTCDate()
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
  const daysInResultMonth = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(day, daysInResultMonth))
  return toIsoDate(result)
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return toIsoDate(date)
}

/** ISO YYYY-MM-DD strings sort correctly lexicographically - no Date objects needed to compare them. */
export function compareIsoDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * The first date on which a sale is long-term. Selling exactly on the
 * N-month anniversary is still short-term (held "12 months", not "more
 * than 12 months") - long-term starts the day after.
 */
export function longTermEligibleDate(buyDate: string, cutoffMonths: number): string {
  return addDays(addMonths(buyDate, cutoffMonths), 1)
}

export function isLongTerm(buyDate: string, sellDate: string, cutoffMonths: number): boolean {
  return compareIsoDates(sellDate, longTermEligibleDate(buyDate, cutoffMonths)) >= 0
}

/** Days from referenceDate until the position becomes long-term. 0 if it already is (never negative). */
export function daysUntilLongTerm(buyDate: string, referenceDate: string, cutoffMonths: number): number {
  const eligibleDate = longTermEligibleDate(buyDate, cutoffMonths)
  if (compareIsoDates(referenceDate, eligibleDate) >= 0) return 0
  const diffMs = parseIsoDate(eligibleDate).getTime() - parseIsoDate(referenceDate).getTime()
  return Math.round(diffMs / (24 * 60 * 60 * 1000))
}
