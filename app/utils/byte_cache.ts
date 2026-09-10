/** Bounded LRU for binary assets. Expiry and eviction never require background timers. */
export class ByteCache<T> {
  private entries = new Map<string, { value: T; size: number; expires: number }>()
  private bytes = 0

  constructor(
    private maxBytes: number,
    private maxEntries: number,
    private now = Date.now
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key)
    if (!entry) return
    if (entry.expires <= this.now()) {
      this.delete(key)
      return
    }
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.value
  }

  set(key: string, value: T, size: number, ttlMs: number) {
    this.delete(key)
    if (size > this.maxBytes || ttlMs <= 0) return
    this.entries.set(key, { value, size, expires: this.now() + ttlMs })
    this.bytes += size
    while (this.bytes > this.maxBytes || this.entries.size > this.maxEntries) {
      this.delete(this.entries.keys().next().value!)
    }
  }

  private delete(key: string) {
    const entry = this.entries.get(key)
    if (entry) this.bytes -= entry.size
    this.entries.delete(key)
  }
}
