/**
 * A champion portrait (square art), cropped slightly so Riot's baked border disappears. `level`
 * draws the small level badge bottom-right; `dim` is for bans. An unknown champion renders an
 * empty well of the same size.
 */
type __VLS_Props = {
    id?: number | null;
    size?: number;
    level?: number | null;
    dim?: boolean;
    title?: string;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {
    level: number | null;
    id: number | null;
    size: number;
    title: string;
    dim: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
