/** A rune page laid out as the client draws it: every rune of both trees, the chosen ones lit. */
/** Slots of each rune tree (keystones first), to show a page with the runes not taken dimmed. */
export declare const RUNE_SLOTS: Record<number, number[][]>;
/** The stat shard rows: offense, flex, defense. */
export declare const SHARD_ROWS: number[][];
export interface RuneSlot {
    id: number;
    on: boolean;
}
export interface RuneTreeView {
    tree: number;
    /** The primary tree starts with its keystones; the secondary has its three lower rows. */
    rows: RuneSlot[][];
    /** The primary tree's first row is its keystones. */
    keystones: boolean;
}
export interface RunePageView {
    primary: RuneTreeView;
    secondary: RuneTreeView;
    /** One row per shard slot; empty when the page has no shards. */
    shards: RuneSlot[][];
}
/**
 * The page as rows of slots. `p` and `s` start with the tree id, then the chosen runes; `m` holds
 * one shard per row. A tree missing from `trees` (`RUNE_SLOTS` by default), one added after it,
 * shows its chosen runes only, one per row, all lit.
 */
export declare function runePageView(page: {
    p: number[];
    s: number[];
    m: number[];
}, trees?: Record<number, number[][]>, shards?: number[][]): RunePageView;
