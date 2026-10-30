import type { MatchDetail, MatchSummary, ScoreRow } from './types.js';
export type TeamRating = 'great' | 'good' | 'average' | 'bad' | 'poor';
export interface TeamVerdict {
    rating: TeamRating;
    /** A teammate was AFK: the rating is `poor` whatever the others did. */
    afk: boolean;
}
/**
 * The verdict on the four teammates of a game: `null` when it cannot be read (a remake, a game
 * without scores, a mode without five-player teams). `mates`: their scores 0‥10 as `ScoreRow`
 * carries them, `null` for an AFK one.
 */
export declare function teamRating(game: Pick<MatchSummary, 'win' | 'remake' | 'mapId'>, mates: readonly (number | null)[] | null | undefined): TeamVerdict | null;
/** The verdict of a match row: its score row's teammates. */
export declare const rowTeamRating: (game: MatchSummary, score: ScoreRow | null | undefined) => TeamVerdict | null;
/** The verdict on the teammates of `puuid` in an opened game; `null` when they have no score. */
export declare function detailTeamRating(d: MatchDetail, puuid: string): TeamVerdict | null;
/** Labels, and what each says for a win and a loss. */
export declare const TEAM_RATINGS: Record<TeamRating, {
    label: string;
    win: string;
    loss: string;
}>;
/** Tooltip line for an AFK teammate, and the line under every tooltip. */
export declare const TEAM_AFK: "A teammate was AFK for much of the game.";
export declare const TEAM_BASIS: "From your four teammates’ Invade scores, against games with the same result.";
/** The tooltip of a verdict: what it says, then what it is read from. */
export declare function teamTip(v: TeamVerdict, win: boolean, t: (key: string) => string): string;
