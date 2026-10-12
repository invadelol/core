import type { PlayedWith } from '../logic/types';
/**
 * The people this player queues with: teammates seen in at least two of their latest full games.
 * A row links to that player's profile. Renders nothing until the host has the list.
 */
type __VLS_Props = {
    data: PlayedWith | null;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
