import '../styles/base.css';
/**
 * Map objectives as the League client's own glyphs, from its match history
 * (`rcp-fe-lol-match-history/right_icons_grub.png`), traced from their light fill and inlined in
 * `currentColor`. Each view box is cropped around its glyph so the six read at one optical size.
 */
export type ObjectiveIconName = 'tower' | 'inhib' | 'dragon' | 'grubs' | 'herald' | 'baron';
type __VLS_Props = {
    name: ObjectiveIconName;
    size?: number;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
