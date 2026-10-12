import type { MatchDetail, PlayerView } from '../logic/types';
/**
 * One player's kit: the rune page with the runes not taken dimmed, final items and summoner
 * spells, and the facts no other tab shows (wards, crowd control, objectives, sprees, leads at
 * 15). A fact the source does not record is left out. Match histories keep no purchase or skill
 * order for these games.
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
