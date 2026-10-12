import '../styles/base.css';
/**
 * A straight-segment line: the player's series in brand, an
 * optional dashed baseline (what a delta is computed against) and an optional shaded band over
 * the last points (what "last 5" means). Stretches to its box; strokes keep their width.
 */
type __VLS_Props = {
    values: number[];
    height?: number;
    baseline?: number | null;
    /** Shade the last N points. */
    band?: number;
    area?: boolean;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {
    area: boolean;
    height: number;
    baseline: number | null;
    band: number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
