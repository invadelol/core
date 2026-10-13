import type { MatchDetail } from '../logic/types';
import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
/**
 * "Why did this game go this way?" The row right above already says the result, queue, duration
 * and the player's own numbers, so the detail does not repeat them: tabs, the game's patch and
 * start on the same line, and its favorite star, then the tab. `selected` (index into `players`)
 * is shared by the tabs that are about one player and starts on the viewed player.
 *
 * The host loads the game: `detail` null while it loads (the detail's own shapes), `error` a
 * message when it could not (with Try again, `retry`). A host that already has the scoreboard
 * (invade.lol's match list) passes it with `loading` while the rest comes: the tabs that need the
 * timeline wait for it, and nothing says the game has none.
 *
 * Slot `actions`: the host's own small buttons at the end of the tab line (invade.lol's Copy link
 * and match page), `iv-btn sm ghost` with an icon. On a phone each keeps its icon: put its words
 * in a `<span>` and give it a `title`.
 */
type __VLS_Props = {
    detail: MatchDetail | null;
    /** The viewed player (whose profile the list belongs to). */
    puuid: string;
    error?: string | null;
    /** invade.lol's id of the game, kept with a favorite. */
    matchId?: string | null;
    /** `detail` is a partial game; the full one (with its timeline, if any) is on its way. */
    loading?: boolean;
};
declare var __VLS_21: {};
type __VLS_Slots = {} & {
    actions?: (props: typeof __VLS_21) => any;
};
declare const __VLS_base: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    retry: () => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onRetry?: (() => any) | undefined;
}>, {
    matchId: string | null;
    loading: boolean;
    error: string | null;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const __VLS_export: __VLS_WithSlots<typeof __VLS_base, __VLS_Slots>;
declare const _default: typeof __VLS_export;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
