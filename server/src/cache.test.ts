import { describe, expect, it, vi } from 'vitest'
import { TtlCache } from './cache.js'

describe('TtlCache', () => {
  it('caches a fresh value and does not refetch within the TTL', async () => {
    let currentTime = 0
    const cache = new TtlCache<number>(1000, () => currentTime)
    const fetcher = vi.fn().mockResolvedValue(42)

    const first = await cache.get('a', fetcher)
    currentTime += 500
    const second = await cache.get('a', fetcher)

    expect(first).toBe(42)
    expect(second).toBe(42)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('refetches once the TTL has expired', async () => {
    let currentTime = 0
    const cache = new TtlCache<number>(1000, () => currentTime)
    const fetcher = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2)

    const first = await cache.get('a', fetcher)
    currentTime += 1001
    const second = await cache.get('a', fetcher)

    expect(first).toBe(1)
    expect(second).toBe(2)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('caches different keys independently', async () => {
    let currentTime = 0
    const cache = new TtlCache<number>(1000, () => currentTime)
    const fetcherA = vi.fn().mockResolvedValue(1)
    const fetcherB = vi.fn().mockResolvedValue(2)

    await cache.get('a', fetcherA)
    await cache.get('b', fetcherB)
    await cache.get('a', fetcherA)

    expect(fetcherA).toHaveBeenCalledTimes(1)
    expect(fetcherB).toHaveBeenCalledTimes(1)
  })

  it('clear() forces every key to refetch', async () => {
    let currentTime = 0
    const cache = new TtlCache<number>(1000, () => currentTime)
    const fetcher = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2)

    await cache.get('a', fetcher)
    cache.clear()
    const second = await cache.get('a', fetcher)

    expect(second).toBe(2)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
