import { describe, expect, it } from 'vitest'
import { extractTickersFromContent, resolveExchangeQualifiedSymbol } from './tickerDetector'

describe('resolveExchangeQualifiedSymbol', () => {
  it('appends .NS for an NSE-qualified symbol', () => {
    expect(resolveExchangeQualifiedSymbol('NSE', 'RELIANCE')).toBe('RELIANCE.NS')
  })

  it('appends .BO for a BSE-qualified symbol', () => {
    expect(resolveExchangeQualifiedSymbol('BSE', 'TATASTEEL')).toBe('TATASTEEL.BO')
  })

  it('leaves a NASDAQ-qualified symbol bare', () => {
    expect(resolveExchangeQualifiedSymbol('NASDAQ', 'NVDA')).toBe('NVDA')
  })

  it('leaves an NYSE-qualified symbol bare', () => {
    expect(resolveExchangeQualifiedSymbol('NYSE', 'KO')).toBe('KO')
  })

  it('rejects a base symbol that is not plausible (too long)', () => {
    expect(resolveExchangeQualifiedSymbol('NSE', 'THISISWAYTOOLONGABASESYMBOL')).toBeNull()
  })

  it('rejects a base symbol that is a known non-ticker acronym', () => {
    expect(resolveExchangeQualifiedSymbol('NSE', 'NAV')).toBeNull()
  })
})

describe('extractTickersFromContent - exchange-qualified mentions', () => {
  it('resolves (NSE: RELIANCE) to RELIANCE.NS', () => {
    expect(extractTickersFromContent('Shares of (NSE: RELIANCE) rose today.', [])).toEqual(['RELIANCE.NS'])
  })

  it('resolves (BSE: TATASTEEL) to TATASTEEL.BO', () => {
    expect(extractTickersFromContent('(BSE: TATASTEEL) fell on weak guidance.', [])).toEqual(['TATASTEEL.BO'])
  })

  it('leaves (NASDAQ: NVDA) unchanged', () => {
    expect(extractTickersFromContent('(NASDAQ: NVDA) hit a new high.', [])).toEqual(['NVDA'])
  })

  it('handles multiple exchange-qualified mentions with mixed suffixes', () => {
    const text = 'Compare (NSE: INFY) against (NASDAQ: MSFT) and (BSE: WIPRO).'
    expect(extractTickersFromContent(text, []).sort()).toEqual(['INFY.NS', 'MSFT', 'WIPRO.BO'].sort())
  })
})

describe('extractTickersFromContent - data-symbol attributes', () => {
  it('keeps an already-suffixed data-symbol unchanged (no double suffix)', () => {
    expect(extractTickersFromContent('', ['INFY.NS'])).toEqual(['INFY.NS'])
  })

  it('keeps a long already-suffixed Indian data-symbol unchanged', () => {
    expect(extractTickersFromContent('', ['BHARTIARTL.NS'])).toEqual(['BHARTIARTL.NS'])
  })

  it('keeps a bare US data-symbol unchanged', () => {
    expect(extractTickersFromContent('', ['AAPL'])).toEqual(['AAPL'])
  })
})

describe('extractTickersFromContent - false-positive acronyms', () => {
  it.each(['SIP', 'NAV', 'AUM', 'NPA'])('does not emit %s from a "WORD +1.2%%" context', (word) => {
    expect(extractTickersFromContent(`${word} +1.2% this month.`, [])).toEqual([])
  })

  it('still emits a real ticker in the same "WORD +1.2%" context', () => {
    expect(extractTickersFromContent('NVDA +1.97% today.', [])).toEqual(['NVDA'])
  })
})

describe('extractTickersFromContent - cashtags', () => {
  it('detects a cashtag', () => {
    expect(extractTickersFromContent('Watching $AAPL closely.', [])).toEqual(['AAPL'])
  })

  it('does not detect a cashtag for a blocklisted acronym', () => {
    expect(extractTickersFromContent('Fund flows into $NAV this week.', [])).toEqual([])
  })
})

describe('extractTickersFromContent - result shape', () => {
  it('deduplicates repeated mentions of the same resolved symbol', () => {
    const text = '(NSE: RELIANCE) ... later, (NSE: RELIANCE) again.'
    expect(extractTickersFromContent(text, [])).toEqual(['RELIANCE.NS'])
  })

  it('caps results at 6 symbols', () => {
    const text = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF', 'GGG']
      .map((symbol) => `${symbol} +1.0%`)
      .join(' ')
    expect(extractTickersFromContent(text, [])).toHaveLength(6)
  })
})
