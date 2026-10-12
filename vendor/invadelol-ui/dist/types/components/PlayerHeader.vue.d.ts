import type { MatchSummary, ProfileView } from '../logic/types';
import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
/**
 * Who the player is and where they stand, in one band: icon, Riot ID, level and last game, and
 * both ranks with Riot's crest. The splash of their most played champion sits behind the right
 * half of the band only, faded with straight masks.
 */
type __VLS_Props = {
    profile: ProfileView;
    games: MatchSummary[];
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
