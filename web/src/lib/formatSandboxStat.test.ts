import { describe, expect, it } from 'vitest'
import {
  formatBeta,
  formatDebtToEquity,
  formatDividendYield,
  formatFiftyTwoWeekRange,
  formatMarketCap,
  formatPbRatio,
  formatPeRatio,
  formatRoe
} from './formatSandboxStat'
import type { SandboxFundamentals } from '@shared/types'

const BASE_FUNDAMENTALS: SandboxFundamentals = {
  peRatio: 23.193262,
  pbRatio: 1.9167871,
  roePercent: 9.8,
  marketCapCr: 1732833.08,
  dividendYieldPercent: 0.47,
  debtToEquity: 0.367,
  beta: 0.184,
  fiftyTwoWeekLow: 1249.8,
  fiftyTwoWeekHigh: 1611.8
}

const NULL_FUNDAMENTALS: SandboxFundamentals = {
  peRatio: null,
  pbRatio: null,
  roePercent: null,
  marketCapCr: 0,
  dividendYieldPercent: null,
  debtToEquity: null,
  beta: null,
  fiftyTwoWeekLow: 0,
  fiftyTwoWeekHigh: 0
}

const FORBIDDEN_VALUES = ['', '0', 'NaN', 'null', 'undefined']

describe('formatSandboxStat - null handling never leaks a blank/zero/NaN', () => {
  const nullFormatters: [string, (f: SandboxFundamentals) => { value: string; available: boolean }][] = [
    ['formatPeRatio', formatPeRatio],
    ['formatPbRatio', formatPbRatio],
    ['formatRoe', formatRoe],
    ['formatDividendYield', formatDividendYield],
    ['formatBeta', formatBeta]
  ]

  it.each(nullFormatters)('%s never returns an empty string, "0", "NaN", or "null" for a null input', (_name, formatter) => {
    const result = formatter(NULL_FUNDAMENTALS)
    expect(result.available).toBe(false)
    expect(FORBIDDEN_VALUES).not.toContain(result.value)
    expect(result.value.length).toBeGreaterThan(0)
  })

  it('formatDebtToEquity never leaks a blank/zero/NaN for a null input, non-bank sector', () => {
    const result = formatDebtToEquity(NULL_FUNDAMENTALS, 'Energy')
    expect(result.available).toBe(false)
    expect(FORBIDDEN_VALUES).not.toContain(result.value)
  })
})

describe('formatSandboxStat - distinguishes "not available" from a real 0', () => {
  it('formatBeta renders a real 0 beta as an available value, not "not available"', () => {
    const result = formatBeta({ ...BASE_FUNDAMENTALS, beta: 0 })
    expect(result.available).toBe(true)
    expect(result.value).toBe('0.00')
  })

  it('formatDebtToEquity renders a real 0 debt-to-equity as an available value', () => {
    const result = formatDebtToEquity({ ...BASE_FUNDAMENTALS, debtToEquity: 0 }, 'Consumer Cyclical')
    expect(result.available).toBe(true)
    expect(result.value).toBe('0.00')
  })

  it('formatDividendYield renders a real 0% yield as an available value, not "not available"', () => {
    const result = formatDividendYield({ ...BASE_FUNDAMENTALS, dividendYieldPercent: 0 })
    expect(result.available).toBe(true)
    expect(result.value).toBe('0.00%')
  })
})

describe('formatSandboxStat - debt-to-equity is sector-aware', () => {
  it('gives a bank-specific reason for a null debt-to-equity on a Financial Services company', () => {
    const result = formatDebtToEquity(NULL_FUNDAMENTALS, 'Financial Services')
    expect(result.available).toBe(false)
    expect(result.value).toBe('Not applicable for banks')
  })

  it('gives the generic reason for a null debt-to-equity on a non-bank company', () => {
    const result = formatDebtToEquity(NULL_FUNDAMENTALS, 'Energy')
    expect(result.available).toBe(false)
    expect(result.value).toBe('Not available for this period')
  })

  it('shows the real ratio when present, even for a Financial Services company', () => {
    const result = formatDebtToEquity({ ...BASE_FUNDAMENTALS, debtToEquity: 1.2 }, 'Financial Services')
    expect(result.available).toBe(true)
    expect(result.value).toBe('1.20')
  })
})

describe('formatSandboxStat - real values format correctly', () => {
  it('formatPeRatio rounds to one decimal', () => {
    expect(formatPeRatio(BASE_FUNDAMENTALS)).toEqual({ value: '23.2', available: true })
  })

  it('formatRoe appends a percent sign', () => {
    expect(formatRoe(BASE_FUNDAMENTALS)).toEqual({ value: '9.8%', available: true })
  })

  it('formatMarketCap is always available (never null in the type) and formats with the crore suffix', () => {
    expect(formatMarketCap(BASE_FUNDAMENTALS)).toEqual({ value: '₹17,32,833 cr', available: true })
  })

  it('formatFiftyTwoWeekRange is always available and formats both bounds as currency', () => {
    const result = formatFiftyTwoWeekRange(BASE_FUNDAMENTALS)
    expect(result.available).toBe(true)
    expect(result.value).toContain('-')
  })
})
