/** Helpers shared by the match detail views. */
import type { MatchDetail, PlayerView, TeamView } from './types.js';
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
