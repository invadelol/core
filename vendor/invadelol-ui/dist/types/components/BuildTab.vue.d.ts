import type { MatchDetail, PlayerView } from '../logic/types';
import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
/**
 * One player's kit: the rune page with the runes not taken dimmed and its stat shards (where the
 * source keeps them), final items and summoner spells, and the facts no other tab shows (wards,
 * crowd control, objectives, sprees, leads at 15). A fact the source does not record is left out.
 * Above them, the build path: every visit to the shop with its time, sold items greyed, where the
 * source keeps the purchases. The skill order is in the player's scoreboard detail.
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
