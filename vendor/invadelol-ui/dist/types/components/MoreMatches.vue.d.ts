import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
/**
 * The end of a match list: older games load as it comes into view, one page after another while
 * it stays in view, with no pacing of its own (stored games are free; the server limits what it
 * must ask Riot for). `load` appends the next page in the host; it resolves `{ retryAfterMs }`
 * when the source held older games back (invade.lol's Riot budget): the list then ends quietly,
 * with no countdown, and a later reach of the end after that window asks once more. It throws on
 * failure (Try again). `more`: older games may exist. Key it by player.
 */
type __VLS_Props = {
    more: boolean;
    load: () => Promise<void | {
        retryAfterMs: number;
    }>;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
