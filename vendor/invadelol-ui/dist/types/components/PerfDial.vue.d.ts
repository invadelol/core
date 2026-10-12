import '../styles/base.css';
/**
 * The performance indicator: a dial open at the bottom, the Invade score (0‥100) in its centre and
 * the placement (MVP, ACE, 3rd…) in the opening. The arc is the score; its colour slides from red
 * (worst) through a muted Invade violet (middle) to blue (best), so most games read calm and only
 * the extremes stand out. The figure stays white (the text colour); MVP is gold. The arc draws in once.
 * `sm` (scoreboards, compact rows): a smaller dial, no placement. `score: null`: not scored yet.
 */
type __VLS_Props = {
    score: number | null;
    rank?: number;
    tag?: '' | 'mvp' | 'ace';
    size?: 'md' | 'sm';
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {
    rank: number;
    size: "sm" | "md";
    tag: "" | "mvp" | "ace";
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
