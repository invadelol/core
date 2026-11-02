import { type StatIconName } from './StatIcon.vue';
import '../styles/base.css';
import '../styles/primitives.css';
/**
 * A stat's name after its Riot icon. When the name no longer fits its cell (a narrow window, a
 * long translation) it hides, still read by screen readers, and the icon stays alone with the
 * name in a tooltip: on hover with a mouse, on a tap on touch. Labels of one `group` (see
 * `provideStatGroups`) hide together. `bare` always shows the icon alone.
 */
type __VLS_Props = {
    stat: StatIconName;
    label: string;
    size?: number;
    group?: string;
    bare?: boolean;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {
    size: number;
    group: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
