import type { MatchDetail, PlayerView, TimelineView } from '../logic/types';
import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
/**
 * The game as a story told on one rail. By default it is the selected player's story (their
 * kills, deaths and assists, what they took, and the map-changing objectives as quiet context);
 * "Whole game" tells everyone's. Three chapters (laning, mid, late), each opening with what that
 * stretch came to; kills a few seconds apart fold into one fight with its score. Hovering an
 * event shows the state of the game at that second. Colour is the side an event counts for, seen
 * from the viewed player (blue yours, red theirs).
 */
type __VLS_Props = {
    detail: MatchDetail;
    timeline: TimelineView;
    selected: number;
    me?: PlayerView;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    select: (index: number) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onSelect?: ((index: number) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
