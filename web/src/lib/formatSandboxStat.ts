import { formatPrice } from './formatStats'
import type { SandboxFundamentals } from '@shared/types'

const BANK_SECTOR = 'Financial Services'
const GENERIC_UNAVAILABLE_REASON = 'Not available for this period'
const BANK_DEBT_TO_EQUITY_REASON = 'Not applicable for banks'

export interface FormattedStat {
  /** Always a real string to render - never '', '0', 'NaN', or 'null'. */
  value: string
  /** False whenever the underlying figure is null/unavailable, so the UI can style a "not available" card differently from a real value - including a real 0, which is never confused with unavailability. */
  available: boolean
}

function ratio(value: number | null, digits: number): FormattedStat {
  return value != null ? { value: value.toFixed(digits), available: true } : { value: GENERIC_UNAVAILABLE_REASON, available: false }
}

function percent(value: number | null, digits: number): FormattedStat {
  return value != null ? { value: `${value.toFixed(digits)}%`, available: true } : { value: GENERIC_UNAVAILABLE_REASON, available: false }
}

export function formatPeRatio(fundamentals: SandboxFundamentals): FormattedStat {
  return ratio(fundamentals.peRatio, 1)
}

export function formatPbRatio(fundamentals: SandboxFundamentals): FormattedStat {
  return ratio(fundamentals.pbRatio, 1)
}

export function formatRoe(fundamentals: SandboxFundamentals): FormattedStat {
  return percent(fundamentals.roePercent, 1)
}

export function formatDividendYield(fundamentals: SandboxFundamentals): FormattedStat {
  return percent(fundamentals.dividendYieldPercent, 2)
}

export function formatBeta(fundamentals: SandboxFundamentals): FormattedStat {
  return ratio(fundamentals.beta, 2)
}

export function formatMarketCap(fundamentals: SandboxFundamentals): FormattedStat {
  return { value: `₹${fundamentals.marketCapCr.toLocaleString('en-IN', { maximumFractionDigits: 0 })} cr`, available: true }
}

export function formatFiftyTwoWeekRange(fundamentals: SandboxFundamentals): FormattedStat {
  return { value: `${formatPrice(fundamentals.fiftyTwoWeekLow)} - ${formatPrice(fundamentals.fiftyTwoWeekHigh)}`, available: true }
}

/**
 * Debt-to-equity is the one stat that needs the company's sector: for banks
 * and other financial-services companies, deposits (not leverage) drive the
 * balance sheet, so the ratio isn't a meaningful risk signal at all - a null
 * there is the *correct* real-world answer, not a data gap, and the UI must
 * say so rather than showing the same generic "not available" it would show
 * for an actual missing figure on a non-bank.
 */
export function formatDebtToEquity(fundamentals: SandboxFundamentals, sector: string): FormattedStat {
  if (fundamentals.debtToEquity != null) return { value: fundamentals.debtToEquity.toFixed(2), available: true }
  return { value: sector === BANK_SECTOR ? BANK_DEBT_TO_EQUITY_REASON : GENERIC_UNAVAILABLE_REASON, available: false }
}
