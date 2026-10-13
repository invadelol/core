import '../styles/base.css';
/**
 * The performance indicator: a dial open at the bottom, the Invade score (0‥100) in its centre and
 * the placement (MVP, ACE, 3rd…) in the opening. The arc is the score; its colour slides from red
 * (worst) through a muted Invade violet (an average game, ~40 on the score's real scale) to blue,
 * so most games read calm and only the extremes stand out. 80 and up is gold with a soft glow, 90
 * and up a brighter gold that glows a little more (a few games in a thousand). The figure stays
 * white (the text colour), gold from 80; MVP is gold. The arc draws in with the view's first paint
 * only: a dial that appears later in the same view (a filter, an appended page, a late score) is
 * simply there, so switching a filter never replays it.
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
