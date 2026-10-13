/**
 * Data that stays on screen until its replacement has arrived. A view that reloads when a filter
 * changes keeps what it shows while the next answer loads, then swaps in one go: no empty frame,
 * no skeleton, no half-updated mix, no layout jump. Only the first load has nothing to show.
 */
import { type Ref, type WatchSource } from 'vue';
/** How long an answer may take before a view hints that it is loading (ms). */
export declare const QUIET_DELAY = 200;
/**
 * True once `source` has been true for `delay` ms, false as soon as it is false: a loading hint
 * that fast answers never show (a slight dim, a thin line), so switching quickly stays still.
 */
export declare function useDelayedFlag(source: WatchSource<boolean>, delay?: number): Readonly<Ref<boolean>>;
export interface StableData<K, T> {
    /** The last value that arrived (`undefined` before the first). It stays while the next one loads. */
    data: Readonly<Ref<T | undefined>>;
    /** The key `data` belongs to: labels drawn from it always match the data shown. */
    key: Readonly<Ref<K | undefined>>;
    /** Something has arrived: until then a view shows its first-load state. */
    ready: Readonly<Ref<boolean>>;
    /** An answer for a newer key is on its way. */
    pending: Readonly<Ref<boolean>>;
    /** `pending` for longer than `delay`: time for a quiet hint. Fast answers never set it. */
    busy: Readonly<Ref<boolean>>;
    /** The latest key failed (`data` keeps the last value that arrived); the next success clears it. */
    error: Readonly<Ref<unknown>>;
    /** Loads the latest key again (Retry, a refresh), keeping `data` meanwhile. */
    reload: () => Promise<void>;
}
export interface StableOptions<K> {
    /** How long an answer may take before `busy` turns on (ms). */
    delay?: number;
    /** Whether two keys ask for the same data (a repeat is not loaded again). Default: equal values,
     *  or arrays and plain objects with equal entries. */
    same?: (a: K, b: K) => boolean;
}
export declare function sameKey(a: unknown, b: unknown): boolean;
/**
 * Loads `load(key)` for each `key` the source gives and keeps the last answer on screen until the
 * next one is in. The latest key wins (answers for older keys are dropped). `load` may answer at
 * once (a cache hit, a value computed from data already there): the swap then happens in the same
 * render, with no pending state at all.
 *
 *     const ranks = useStableData(rank, (id) => loadRank(id))
 *     // ranks.data: the file shown; ranks.key: its rank; ranks.busy: dim it a little
 */
export declare function useStableData<K, T>(source: WatchSource<K>, load: (key: K) => T | PromiseLike<T>, options?: StableOptions<K>): StableData<K, T>;
