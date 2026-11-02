import '../styles/base.css';
/**
 * The League client's own stat glyphs, from its post-game scoreboard (`rcp-fe-lol-postgame`):
 * one filled path each, inlined in `currentColor`. Each view box is cropped around its glyph so
 * the six read at one optical size.
 */
export type StatIconName = 'kda' | 'damage' | 'taken' | 'gold' | 'cs' | 'vision';
type __VLS_Props = {
    name: StatIconName;
    size?: number;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
