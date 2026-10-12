import type { Badge, MatchSummary, ScoreRow } from '../logic/types';
import '../styles/base.css';
import '../styles/primitives.css';
/**
 * One game in one line. The result is the row's left edge and tint, nothing else; figures stay
 * white. The whole row toggles the detail, which the parent renders right below it. Opponent,
 * kill participation and badges come from the score row when the parent does not pass them (they
 * are computed from the same full game).
 *
 * The row is its own size container: from ~560px to 1600px it drops the matchup, then farm, then
 * items, instead of squeezing every column.
 *
 * With `puuid` and a host favorites store, a star in the row's right padding saves the game. It is
 * the row button's sibling (a button cannot hold another), and hover is read on the wrapper so
 * pointing at the star keeps the row lit. An open row leaves the star to the detail's header.
 */
type __VLS_Props = {
    game: MatchSummary;
    /** None (unscored, or not yet): no dial, the column keeps its width. */
    score?: ScoreRow | null;
    /** LP gained or lost, when known. */
    lp?: number | null;
    /** Lane opponent's champion id, when known (default: from `score`). */
    opponent?: number | null;
    /** Kill participation 0‥1, when known (default: from `score`). */
    kp?: number | null;
    /** Earned badges; at most two are shown (default: from `score`). */
    badges?: Badge[];
    open?: boolean;
    /** 44px variant for lists beside other content (dashboard). */
    compact?: boolean;
    /** Whose game this is: shows the favorite star (with a host favorites store). */
    puuid?: string | null;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    toggle: () => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onToggle?: (() => any) | undefined;
}>, {
    score: ScoreRow | null;
    puuid: string | null;
    lp: number | null;
    kp: number | null;
    opponent: number | null;
    badges: Badge[];
    open: boolean;
    compact: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
