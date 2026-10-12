import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
/**
 * The profile page's frame: the header band on top, then the side panels beside the feed (the
 * feed is the page's subject). Narrow: the side panels go above the feed in two balanced columns.
 * Without side panels the content takes the whole width (another section of the profile).
 * Pass `loading` for the page's own loading shapes instead of the slots.
 */
type __VLS_Props = {
    loading?: boolean;
};
declare var __VLS_6: {}, __VLS_8: {}, __VLS_10: {};
type __VLS_Slots = {} & {
    header?: (props: typeof __VLS_6) => any;
} & {
    side?: (props: typeof __VLS_8) => any;
} & {
    default?: (props: typeof __VLS_10) => any;
};
declare const __VLS_base: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const __VLS_export: __VLS_WithSlots<typeof __VLS_base, __VLS_Slots>;
declare const _default: typeof __VLS_export;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
