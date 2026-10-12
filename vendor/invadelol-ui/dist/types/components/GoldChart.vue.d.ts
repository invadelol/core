import type { MatchDetail, PlayerView, TimelineView } from '../logic/types';
/**
 * All ten players over the game, on one chart. Lines are faint by default; the selected player
 * (brand) and their lane opponent are pinned, and the line nearest the pointer lights up with a
 * tooltip. The legend on the right is a live readout: every value follows the minute under the
 * pointer (or the end of the game), each with a bar on the lobby's scale at that minute, so the
 * comparison is read without hunting. Below the lines, the epic objectives and the team lead on
 * the same time axis explain the swings. Arrow keys move through the minutes.
 */
type __VLS_Props = {
    detail: MatchDetail;
    timeline: TimelineView;
    selected: number;
    me?: PlayerView;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
