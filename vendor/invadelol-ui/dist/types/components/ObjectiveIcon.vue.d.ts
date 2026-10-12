import '../styles/base.css';
/** Map objectives as line glyphs (24 × 24, 1.8 stroke, same family as Icon). */
export type ObjectiveIconName = 'tower' | 'inhib' | 'dragon' | 'grubs' | 'herald' | 'baron';
type __VLS_Props = {
    name: ObjectiveIconName;
    size?: number;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
