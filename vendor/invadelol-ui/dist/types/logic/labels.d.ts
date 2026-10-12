/** Names of things: ranks, queues, positions, badges and counted nouns. Each takes the host's `t`. */
import { type Translate } from './i18n.js';
import type { Badge, Position, QueueFilter, Rank, Totals } from './types.js';
export declare const TIERS: readonly ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];
/** "Gold II · 45 LP", "Master · 120 LP", "Unranked". */
export declare function rankLabel(r: Pick<Rank, 'tier' | 'division' | 'lp'> | null | undefined, withLp?: boolean, t?: Translate): string;
/** Short form for tight spaces: "G2", "M", "E4". */
export declare function rankShort(r: Pick<Rank, 'tier' | 'division'> | null | undefined): string;
/** Ordinal for comparing ranks: Iron IV = 0 … Diamond I = 27, Master+ by LP on top. */
export declare function rankValue(r: Pick<Rank, 'tier' | 'division' | 'lp'> | null | undefined): number | null;
/** CSS colour of a tier (rank names and crests only): a token, so it follows the theme. */
export declare function tierColor(tier: string | null | undefined): string;
export declare const tierRgb: (tier: string | null | undefined) => string | null;
export declare const winRate: (x: Pick<Totals, "games" | "wins">) => number;
export declare const kda: (x: Pick<Totals, "kills" | "deaths" | "assists">) => number;
/** Queue id → display name ("Ranked Solo/Duo"). */
export declare const queueName: (id: number, t?: Translate) => string;
/** Queue filters of match lists: queue ids per filter (`null`: every queue). */
export declare const QUEUE_FILTERS: readonly [{
    readonly id: "all";
    readonly label: "All queues";
    readonly queues: null;
}, {
    readonly id: "solo";
    readonly label: "Ranked Solo/Duo";
    readonly queues: readonly [420];
}, {
    readonly id: "flex";
    readonly label: "Ranked Flex";
    readonly queues: readonly [440];
}, {
    readonly id: "normal";
    readonly label: "Normal";
    readonly queues: readonly [400, 430, 480, 490];
}, {
    readonly id: "aram";
    readonly label: "ARAM";
    readonly queues: readonly [450, 720, 2400];
}, {
    readonly id: "arena";
    readonly label: "Arena";
    readonly queues: readonly [1700, 1710, 1750];
}];
/** Shorter names of the filters, where the context already says "queue" (a filter bar, a narrow row). */
export declare const QUEUE_SHORT: Partial<Record<QueueFilter, string>>;
/** A queue's short name for narrow rows: its filter's ("Solo/Duo", "Normal", "ARAM"…), else its own. */
export declare function queueShort(id: number, t?: Translate): string;
export declare const POSITIONS: Record<Position, string>;
export declare const positionName: (p: Position | null | undefined, t?: Translate) => string;
/** Earned badges: what the data says the player did best in that game. */
export declare const BADGES: Record<Badge, {
    label: string;
    tip: string;
}>;
export declare const topBadges: (list: readonly Badge[] | null | undefined, max?: number) => Badge[];
/** A count with its noun, singular for one: "1 game", "3 games". */
declare const COUNTS: {
    readonly games: readonly ["{n} game", "{n} games"];
    readonly wins: readonly ["{n} win", "{n} wins"];
    readonly kills: readonly ["{n} kill", "{n} kills"];
    readonly deaths: readonly ["{n} death", "{n} deaths"];
    readonly events: readonly ["{n} event", "{n} events"];
    readonly changes: readonly ["{n} change", "{n} changes"];
};
export type CountNoun = keyof typeof COUNTS;
export declare const count: (n: number, noun: CountNoun, t?: Translate) => string;
export {};
