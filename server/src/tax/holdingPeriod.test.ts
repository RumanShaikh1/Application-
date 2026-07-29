import { describe, expect, it } from 'vitest'
import { addMonths, daysUntilLongTerm, isLongTerm, longTermEligibleDate } from './holdingPeriod.js'

describe('addMonths', () => {
  it('adds whole months normally', () => {
    expect(addMonths('2024-03-15', 12)).toBe('2025-03-15')
    expect(addMonths('2024-01-05', 1)).toBe('2024-02-05')
  })

  it('clamps to the last day of a shorter target month instead of overflowing', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29') // 2024 is a leap year
    expect(addMonths('2023-01-31', 1)).toBe('2023-02-28') // 2023 is not
  })
})

describe('isLongTerm / longTermEligibleDate', () => {
  it('selling exactly on the N-month anniversary is still short-term', () => {
    expect(longTermEligibleDate('2023-06-15', 12)).toBe('2024-06-16')
    expect(isLongTerm('2023-06-15', '2024-06-15', 12)).toBe(false)
  })

  it('selling the day after the anniversary is long-term', () => {
    expect(isLongTerm('2023-06-15', '2024-06-16', 12)).toBe(true)
  })

  it('selling well before the cutoff is short-term; well after is long-term', () => {
    expect(isLongTerm('2024-01-01', '2024-06-01', 12)).toBe(false)
    expect(isLongTerm('2020-01-01', '2024-01-01', 12)).toBe(true)
  })
})

describe('daysUntilLongTerm', () => {
  it('counts down to the eligible date', () => {
    // eligible date = addMonths('2024-01-01', 12) + 1 day = 2025-01-02;
    // 2024-01-01 -> 2025-01-02 spans the 2024 leap day, so it's 367 days, not 365/366.
    expect(daysUntilLongTerm('2024-01-01', '2024-01-01', 12)).toBe(367)
  })

  it('returns 0 once already long-term, never negative', () => {
    expect(daysUntilLongTerm('2020-01-01', '2024-01-01', 12)).toBe(0)
    expect(daysUntilLongTerm('2023-06-15', '2024-06-16', 12)).toBe(0)
  })

  it('returns 0 on the day it becomes eligible', () => {
    expect(daysUntilLongTerm('2023-06-15', '2024-06-16', 12)).toBe(0)
  })

  it('returns 1 the day before it becomes eligible', () => {
    expect(daysUntilLongTerm('2023-06-15', '2024-06-15', 12)).toBe(1)
  })
})
