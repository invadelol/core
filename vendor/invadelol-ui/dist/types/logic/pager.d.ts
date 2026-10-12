/**
 * Older games, page by page (infinite scroll). Pages hold {@link PAGE_SIZE} games and load as fast
 * as the list is scrolled: games a host or server already stores cost nothing. Only a page the
 * server must ask Riot for is limited, and that limit is the server's (invade.lol keeps it per
 * player and address). When the server holds older games back, the list just ends there, without
 * a countdown: {@link endOfList} lets a later reach of the end ask once more, after the server's
 * window, with no timer.
 */
export declare const PAGE_SIZE = 15;
/** One list's end. `now` is injectable for tests. */
export declare function endOfList(now?: () => number): {
    /** Whether reaching the end now asks for the next page (never before the source's window). */
    ask: () => boolean;
    /** Whether the source held older games back: the list ends quietly (it may ask again later). */
    held: () => boolean;
    /** The source held older games back for `ms`: the end stays quiet until a later reach after it. */
    hold(ms: number): void;
    /** A page loaded: the end asks freely again. */
    clear(): void;
};
export type EndOfList = ReturnType<typeof endOfList>;
