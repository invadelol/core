import type { MatchDetail, Ping, PlayerView, ScoreCategory, TeamView, TimelineView } from './types.js';
/**
 * Colours are relative to the viewed player: them in brand, their team in the "good for you"
 * blue, the other team in red. Sides stay names ("Blue side"), never colours.
 */
export declare function lineColor(p: PlayerView, me: PlayerView | undefined): string;
/** `ally` / `enemy` of a team or player, from the viewed player's side. */
export declare const relation: (teamId: number, me: PlayerView | undefined) => "ally" | "enemy";
/** Side name of a team (Arena duos have none). */
export declare const side: (teamId: number) => "" | "blue" | "red";
export declare const riotId: (p: Pick<PlayerView, "gameName" | "tagLine">) => string;
/** Teams with their players, the viewed player's team first (Arena: by placement). */
export declare function teamsOf(d: MatchDetail, me: PlayerView | undefined): {
    team: TeamView;
    players: PlayerView[];
    placement: number;
}[];
/** Slots of each rune tree (keystones first), to show a page with the runes not taken dimmed. */
export declare const RUNE_SLOTS: Record<number, number[][]>;
/** Whether the timeline carries any event to tell (stored games from before events were kept do not). */
export declare const hasEvents: (d: MatchDetail) => boolean;
/** The parts of a score, in the order they are read, with their names. */
export declare const SCORE_PARTS: Record<ScoreCategory, string>;
export declare const SCORE_CATEGORIES: ScoreCategory[];
/** Ping kinds with their in-game names. */
export declare const PINGS: Record<Ping, string>;
declare const SKILL_KEYS: readonly ["Q", "W", "E", "R"];
export type SkillKey = (typeof SKILL_KEYS)[number];
/** Q/W/E/R × 18 levels: each cell holds the level the point was spent at, else null. */
export declare function skillMatrix(skills: number[]): Record<SkillKey, (number | null)[]>;
/** The basic skills in the order they were first taken: `['E', 'Q', 'W']`. */
export declare function skillPriority(skills: number[]): SkillKey[];
/** Gold, CS and XP leads over a player's lane opponent at a minute, when the game lasted that long. */
export declare function laneLead(t: TimelineView, i: number, j: number, minute: number): {
    minute: number;
    gold: number;
    cs: number;
    xp: number;
} | null;
/**
 * Whether the role-quest slot (`roleBoundItem`) holds a real item: not empty, not a quest token
 * (12xx), not the support's ward stand-in (2055). A bot laner's finished boots move there.
 */
export declare const roleSlot: (id: number | undefined) => id is number;
export {};
