/** What the desktop pipeline may spend by default: under a third of a development key. */
export const DEFAULT_DESKTOP_RIOT_BUDGET = 30

/** Riot's app limit window on the key (`100:120`): the budget counts over the same span. */
const WINDOW_MS = 120_000

/**
 * The share of the Riot key the desktop pipeline may spend (docs/desktop-sync.md §4.2): at most
 * `limit` calls per routing cluster in any two minutes, the window of the key's app limit. The rest
 * stays for the website, whose visitors wait on their answer. Per process, like the SDK's limiter.
 */
export class RiotBudget {
  private spent = new Map<string, number[]>()

  constructor(
    public limit: number,
    private now = () => Date.now()
  ) {}

  /** Counts one call in `cluster`, or false when the budget is spent. */
  take(cluster: string): boolean {
    const now = this.now()
    const recent = (this.spent.get(cluster) ?? []).filter((at) => now - at < WINDOW_MS)
    const allowed = recent.length < this.limit
    if (allowed) recent.push(now)
    this.spent.set(cluster, recent)
    return allowed
  }
}
