import '../styles/base.css';
/**
 * Riot's ranked crest for a tier: the flat mini crest bundled with the package (sharp at any size,
 * offline), or with `emblem` the full emblem from the host (`assetUrl('rank', tier)`) for the few
 * places designed around it. The emblem is a 1280×720 frame whose wings reach far past the crest,
 * so it gets a box of its own, wider than tall and faded at the edges, never over the text beside
 * it. An image that fails or is not that frame (a proxy placeholder) leaves the mini crest.
 * `size` is the crest's size; a host may override the emblem's with `--iv-crest`.
 *
 * A new tier (a queue switch, a filter) keeps the crest on screen until the next one is decoded,
 * then swaps in one frame: it never blanks or fades on a change. Only the first emblem fades in.
 */
type __VLS_Props = {
    tier?: string | null;
    size?: number;
    emblem?: boolean;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {
    tier: string | null;
    size: number;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
