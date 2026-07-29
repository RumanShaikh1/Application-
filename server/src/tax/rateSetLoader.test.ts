import { describe, expect, it } from 'vitest'
import { getRateSetForDate, listRateSets } from './rateSetLoader.js'

describe('rateSetLoader', () => {
  it('loads at least the two rate sets shipped with this task', () => {
    const rateSets = listRateSets()
    expect(rateSets.map((r) => r.id)).toEqual(expect.arrayContaining(['2024-04-01', '2024-07-23']))
  })

  it('picks the pre-Budget rate set for a transaction just before 23 July 2024', () => {
    const rateSet = getRateSetForDate('2024-07-22')
    expect(rateSet?.id).toBe('2024-04-01')
  })

  it('picks the post-Budget rate set exactly on its effective date and after', () => {
    expect(getRateSetForDate('2024-07-23')?.id).toBe('2024-07-23')
    expect(getRateSetForDate('2025-01-01')?.id).toBe('2024-07-23')
  })

  it('returns undefined for a date before every loaded rate set', () => {
    expect(getRateSetForDate('1999-01-01')).toBeUndefined()
  })
})
