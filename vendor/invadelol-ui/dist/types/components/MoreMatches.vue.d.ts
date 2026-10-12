import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
/**
 * The end of a match list: older games load as it comes into view, under the paging rule of
 * `logic/pager` (a few pages right away, then one every two minutes, counted per mounted list: key
 * it by player). While the rule holds a page back it says when the next one comes, and loads it
 * by itself if the end is still in view. `load` resolves `{ wait }` (ms) when the source refused
 * (a server's own count); it throws on failure (Try again). `more`: older games may exist.
 */
type __VLS_Props = {
    more: boolean;
    load: () => Promise<void | {
        wait: number;
    }>;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
