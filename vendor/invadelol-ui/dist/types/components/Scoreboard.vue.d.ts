import type { MatchDetail } from '../logic/types';
import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
/**
 * Both teams in one table, the viewed player's team first. The team line carries the result
 * word in its colour (the only result colour), the viewed player's team rating on their side,
 * objectives with counts, bans and totals; each
 * player row follows the table spec, the viewed player's row in brand. A name links to that
 * player (through the host's `linkTo` / `onOpen`). A row opens that player's game under it
 * (`PlayerDetail`), one at a time: a click anywhere on it but a link, or its chevron button.
 */
type __VLS_Props = {
    detail: MatchDetail;
    puuid: string;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
