/**
 * Generic in-memory TTL cache. One instance per (provider method, TTL) pair -
 * see providers/CachingProvider.ts. `now` is injectable so tests can control
 * time directly instead of sleeping real milliseconds.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>()

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now
  ) {}

  async get(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.entries.get(key)
    if (cached && cached.expiresAt > this.now()) {
      return cached.value
    }
    const value = await fetcher()
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs })
    return value
  }

  clear(): void {
    this.entries.clear()
  }
}
