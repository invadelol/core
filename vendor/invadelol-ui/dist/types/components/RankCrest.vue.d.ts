import '../styles/base.css';
/**
 * Riot's ranked crest for a tier. Small sizes use the flat mini crests bundled with the package
 * (sharp at 12–28px, offline); from 40px up the full emblem from the host (`assetUrl('rank', tier)`),
 * which falls back to the mini crest if it cannot load. A host without one gets the mini crest.
 */
type __VLS_Props = {
    tier?: string | null;
    size?: number;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {
    tier: string | null;
    size: number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
