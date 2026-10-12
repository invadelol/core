/**
 * Older games, page by page (infinite scroll), under one rule in every host and server: pages of
 * {@link PAGE_SIZE} games, {@link PAGE_BURST} of them right away, then one every
 * {@link PAGE_EVERY_MS}, so nobody drains the Riot key by scrolling.
 *
 * The rule is a GCRA (a token bucket kept as one number): `tat`, the time the bucket is full again,
 * moves one interval per page and may run at most `PAGE_BURST` intervals ahead of now. A view that
 * stays idle earns its pages back at the same rate. The server keeps the same number in Redis.
 */
export declare const PAGE_SIZE = 15;
export declare const PAGE_BURST = 3;
export declare const PAGE_EVERY_MS = 120000;
/**
 * Whether a page may load at `now` with the state `tat` (0 for a new view): the state after it,
 * or how long to wait (ms) with the state unchanged.
 */
export declare function nextPage(tat: number, now: number): {
    wait: number;
    tat: number;
};
/** One view's pager. `now` is injectable for tests. */
export declare function pager(now?: () => number): {
    /** Ms before the next page may load (0: now). */
    wait: () => number;
    /** Counts a page that loaded. */
    take(): void;
    /** The source said to wait `ms` (its own count, a server's): the next page waits as long. */
    hold(ms: number): void;
};
export type Pager = ReturnType<typeof pager>;
