import type { LpPoint, PlayerCard } from '../logic/types';
import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
/**
 * LP history (the desktop app records a snapshot of its own accounts whenever the rank
 * changes). Plots the continuous ladder value, so a promotion is a rise and not a drop to 0 LP;
 * one point per change, straight segments, division lines labelled with the rank in its tier
 * colour. Hovering reads a point; at rest the panel says how far the line went.
 */
type __VLS_Props = {
    points: LpPoint[];
    card: Pick<PlayerCard, 'solo' | 'flex'>;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
