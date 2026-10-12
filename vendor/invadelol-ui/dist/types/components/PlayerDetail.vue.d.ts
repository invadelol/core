import type { MatchDetail, PlayerView } from '../logic/types';
import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
/**
 * One player's game, opened under their scoreboard row: the build (items, spells, skill order,
 * runes), the score with what it is made of and their numbers against the best of the game, and
 * the lane against its opponent (leads at 10 and 15 minutes, pings). What the source does not
 * record (a skill order without a timeline, pings from the League client) is left out.
 */
type __VLS_Props = {
    detail: MatchDetail;
    player: PlayerView;
    me?: PlayerView;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
