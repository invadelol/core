import { type TeamVerdict } from '../logic/team';
import '../styles/base.css';
import '../styles/primitives.css';
/**
 * How the player's teammates played (`teamRating`), as a badge beside the earned ones: good for
 * the player in the win colour, bad in the loss colour, stronger at either end, an average team
 * in plain ink. The tooltip says what the label means for this result.
 */
type __VLS_Props = {
    verdict: TeamVerdict;
    win: boolean;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
