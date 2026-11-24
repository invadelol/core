import '../styles/base.css';
import type { Badge } from '../logic/types';
/**
 * Earned tags of one player in one game: the rarest shown whole (glyph + name, violet hairline),
 * the others as small glyph tiles whose name is on hover. Rarest first (`topBadges` order), so the
 * one in front is the one worth telling. MVP / ACE live in the score column, not here.
 */
type __VLS_Props = {
    badges: readonly Badge[] | null | undefined;
    max?: number;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {
    max: number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
