import type { Position } from '../logic/types';
import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
/** Positions played on Summoner's Rift over the loaded games. A row filters the feed to that role. */
type __VLS_Props = {
    lanes: [Position, number][];
};
type __VLS_ModelProps = {
    'role': Position | '';
};
type __VLS_PublicProps = __VLS_Props & __VLS_ModelProps;
declare const __VLS_export: import("vue").DefineComponent<__VLS_PublicProps, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    "update:role": (value: "" | Position) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_PublicProps> & Readonly<{
    "onUpdate:role"?: ((value: "" | Position) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
