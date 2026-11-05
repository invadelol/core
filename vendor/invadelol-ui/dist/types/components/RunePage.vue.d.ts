import '../styles/base.css';
/**
 * A rune page: `p`/`s` start with the tree id followed by the picked runes, `m` = stat shards.
 * `compact`: the page as the client draws it, both trees in full with the chosen runes lit and the
 * others quiet, the shards as their own icons. `trees` overrides the tree layout it draws from.
 */
type __VLS_Props = {
    page: {
        p: number[];
        s: number[];
        m: number[];
    };
    compact?: boolean;
    trees?: Record<number, number[][]>;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {
    compact: boolean;
    trees: Record<number, number[][]>;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
