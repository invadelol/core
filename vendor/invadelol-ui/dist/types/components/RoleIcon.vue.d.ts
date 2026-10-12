/** Position glyphs (Riot's lane marks). Empty for no position (modes without lanes). */
import type { Position } from '../logic/types';
import '../styles/base.css';
type __VLS_Props = {
    lane: Position | null;
    size?: number;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {
    size: number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
