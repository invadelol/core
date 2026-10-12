import type { MatchDetail, PlayerView } from '../logic/types';
/**
 * Every number of the game, compared. Three reads, from quickest to deepest:
 * 1. What stood out for the selected player: the few stats where they ranked best in the lobby
 *    (or on their team), and the one where they ranked worst, each with its rank. Facts only.
 * 2. Two duels on one axis: the player against their lane opponent, and team against team.
 * 3. The full table: one column per player, one row per stat, the best value of each row in
 *    bold, the selected player's column lit; the row under the pointer shows its spread as small
 *    bars. A click on a column selects that player for every tab.
 * A stat the source does not record (damage mitigated on invade.lol) is left out everywhere.
 */
type __VLS_Props = {
    detail: MatchDetail;
    selected: number;
    me?: PlayerView;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    select: (index: number) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onSelect?: ((index: number) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
