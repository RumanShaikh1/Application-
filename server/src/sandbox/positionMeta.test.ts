import { describe, expect, it } from 'vitest'
import { findPositionMeta, updatePositionMeta } from './positionMeta.js'
import type { SandboxPositionMeta } from '../../../shared/types.js'

describe('updatePositionMeta - opening a new position', () => {
  it('adds a new entry with the given entryDay and thesisTag', () => {
    const result = updatePositionMeta([], 'RELIANCE.NS', 'buy', 10, 'fits_mission_goal', 5)
    expect(result).toEqual([{ symbol: 'RELIANCE.NS', entryDay: 10, thesisTag: 'fits_mission_goal' }])
  })

  it('throws if opening a new position without a thesisTag', () => {
    expect(() => updatePositionMeta([], 'RELIANCE.NS', 'buy', 10, undefined, 5)).toThrow(/thesisTag is required/)
  })
})

describe('updatePositionMeta - adding to an existing position', () => {
  it('keeps the original entryDay and thesisTag, even with a different thesisTag passed in', () => {
    const existing: SandboxPositionMeta[] = [{ symbol: 'RELIANCE.NS', entryDay: 10, thesisTag: 'fits_mission_goal' }]
    const result = updatePositionMeta(existing, 'RELIANCE.NS', 'buy', 50, 'trending_up', 15)
    expect(result).toEqual(existing)
  })

  it('leaves other symbols entries untouched', () => {
    const existing: SandboxPositionMeta[] = [
      { symbol: 'RELIANCE.NS', entryDay: 10, thesisTag: 'fits_mission_goal' },
      { symbol: 'TCS.NS', entryDay: 20, thesisTag: 'looks_cheap' }
    ]
    const result = updatePositionMeta(existing, 'RELIANCE.NS', 'buy', 50, undefined, 15)
    expect(result).toEqual(existing)
  })
})

describe('updatePositionMeta - selling', () => {
  it('removes the entry when the resulting quantity is zero (position fully closed)', () => {
    const existing: SandboxPositionMeta[] = [
      { symbol: 'RELIANCE.NS', entryDay: 10, thesisTag: 'fits_mission_goal' },
      { symbol: 'TCS.NS', entryDay: 20, thesisTag: 'looks_cheap' }
    ]
    const result = updatePositionMeta(existing, 'RELIANCE.NS', 'sell', 60, undefined, 0)
    expect(result).toEqual([{ symbol: 'TCS.NS', entryDay: 20, thesisTag: 'looks_cheap' }])
  })

  it('keeps the entry unchanged on a partial sell (resulting quantity > 0)', () => {
    const existing: SandboxPositionMeta[] = [{ symbol: 'RELIANCE.NS', entryDay: 10, thesisTag: 'fits_mission_goal' }]
    const result = updatePositionMeta(existing, 'RELIANCE.NS', 'sell', 60, undefined, 5)
    expect(result).toEqual(existing)
  })
})

describe('findPositionMeta', () => {
  it('finds an entry by symbol', () => {
    const metas: SandboxPositionMeta[] = [{ symbol: 'RELIANCE.NS', entryDay: 10, thesisTag: 'fits_mission_goal' }]
    expect(findPositionMeta(metas, 'RELIANCE.NS')).toEqual(metas[0])
  })

  it('returns undefined for an unknown symbol', () => {
    expect(findPositionMeta([], 'RELIANCE.NS')).toBeUndefined()
  })
})
