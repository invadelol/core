/** LP won or lost per ranked game, matched from LP snapshots (the desktop app records them for own accounts). */
import type { LpPoint, MatchSummary } from './types.js';
/**
 * A pair of consecutive snapshots of one queue gives a game its LP change only when it cannot be
 * anything else: exactly one game was played between them (wins + losses grew by one, with the
 * game's result), and exactly one loaded game of that queue started after the first snapshot and
 * ended before the second. Anything ambiguous (several games per snapshot, dodges, decay, season
 * resets) is left out rather than guessed.
 */
export declare function lpByGame(points: readonly LpPoint[], games: readonly MatchSummary[]): Map<number, number>;
