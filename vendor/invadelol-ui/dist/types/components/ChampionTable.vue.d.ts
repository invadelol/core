import type { MatchSummary, ProfileView, ScoreRow } from '../logic/types';
/**
 * Champions over the loaded games (most played first), and the account's mastery as a second
 * view of the same panel. A row filters the feed to that champion; the selected one is lit.
 */
type __VLS_Props = {
    profile: ProfileView;
    games: MatchSummary[];
    scores: ReadonlyMap<number, ScoreRow>;
};
type __VLS_ModelProps = {
    'champion': number;
};
type __VLS_PublicProps = __VLS_Props & __VLS_ModelProps;
declare const __VLS_export: import("vue").DefineComponent<__VLS_PublicProps, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    "update:champion": (value: number) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_PublicProps> & Readonly<{
    "onUpdate:champion"?: ((value: number) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
