import '../styles/base.css';
/**
 * A straight-segment line: the player's series in brand, an
 * optional dashed baseline (what a delta is computed against) and an optional shaded band over
 * the last points (what "last 5" means). Stretches to its box; strokes keep their width. With
 * `area` it is a sparkline instead: a smooth line over a soft fade, nothing else. With `span` the
 * height stands for at least that range and the line keeps headroom, so ordinary noise reads as
 * the gentle variation it is instead of filling the box.
 */
type __VLS_Props = {
    values: number[];
    height?: number;
    baseline?: number | null;
    /** Shade the last N points. */
    band?: number;
    area?: boolean;
    /** The least range the height stands for, in the values' unit (CS/min: 2). */
    span?: number;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {
    area: boolean;
    span: number;
    height: number;
    baseline: number | null;
    band: number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
