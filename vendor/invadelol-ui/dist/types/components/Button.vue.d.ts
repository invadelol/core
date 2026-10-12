import '../styles/base.css';
import '../styles/primitives.css';
/** A button: `primary` is the one violet action of a view; `ghost` sits in toolbars; `danger` deletes. */
type __VLS_Props = {
    variant?: 'default' | 'primary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    iconOnly?: boolean;
    type?: 'button' | 'submit';
};
declare var __VLS_1: {};
type __VLS_Slots = {} & {
    default?: (props: typeof __VLS_1) => any;
};
declare const __VLS_base: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {
    variant: "danger" | "default" | "primary" | "ghost";
    size: "sm" | "md" | "lg";
    iconOnly: boolean;
    type: "button" | "submit";
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const __VLS_export: __VLS_WithSlots<typeof __VLS_base, __VLS_Slots>;
declare const _default: typeof __VLS_export;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
