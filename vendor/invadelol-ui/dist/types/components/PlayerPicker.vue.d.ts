import type { MatchDetail, PlayerView } from '../logic/types';
import '../styles/base.css';
import '../styles/detail.css';
/** Picks the player a detail tab is about: the viewed player's team first, the other after a gap. */
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
