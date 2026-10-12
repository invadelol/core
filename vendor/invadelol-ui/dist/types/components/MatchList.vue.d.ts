import type { MatchSummary, Position, QueueFilter, ScoreRow } from '../logic/types';
import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
/**
 * The feed: one filter bar, one summary line of what it shows (record, KDA, form), then the
 * games grouped by day (or by champion). A row opens the host's `detail` slot right below it
 * (`{ game }`: the host loads the game and renders `MatchDetail`). With `loadMore`, older games
 * load as the end comes into view (`MoreMatches`, paced per player).
 */
type __VLS_Props = {
    /** Whose games these are (favorites). */
    puuid: string;
    games: MatchSummary[];
    scores: ReadonlyMap<number, ScoreRow>;
    /** LP change per game id, when known (own accounts). */
    lp?: ReadonlyMap<number, number>;
    status: 'loading' | 'ready' | 'error';
    /** What went wrong, shown with Try again (`retry`). */
    error?: string;
    /** The history is private: says so instead of an error or an empty list. */
    private?: boolean;
    /** Older games may exist (`loadMore` asks for them). */
    more?: boolean;
    /** Loads the next page of older games into `games` (see `MoreMatches`). */
    loadMore?: () => Promise<void | {
        wait: number;
    }>;
    /** A game to open and scroll to once it is in the list (a deep link). */
    focus?: number | null;
};
type __VLS_Slots = {
    detail?: (props: {
        game: MatchSummary;
    }) => unknown;
};
type __VLS_ModelProps = {
    'queue': QueueFilter;
    'champion': number;
    'role': Position | '';
    'order': 'recent' | 'champion';
};
type __VLS_PublicProps = __VLS_Props & __VLS_ModelProps;
declare const __VLS_base: import("vue").DefineComponent<__VLS_PublicProps, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    retry: () => any;
    "update:queue": (value: QueueFilter) => any;
    "update:champion": (value: number) => any;
    "update:role": (value: "" | Position) => any;
    "update:order": (value: "champion" | "recent") => any;
}, string, import("vue").PublicProps, Readonly<__VLS_PublicProps> & Readonly<{
    onRetry?: (() => any) | undefined;
    "onUpdate:queue"?: ((value: QueueFilter) => any) | undefined;
    "onUpdate:champion"?: ((value: number) => any) | undefined;
    "onUpdate:role"?: ((value: "" | Position) => any) | undefined;
    "onUpdate:order"?: ((value: "champion" | "recent") => any) | undefined;
}>, {
    lp: ReadonlyMap<number, number>;
    more: boolean;
    error: string;
    private: boolean;
    loadMore: () => Promise<void | {
        wait: number;
    }>;
    focus: number | null;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
declare const __VLS_export: __VLS_WithSlots<typeof __VLS_base, __VLS_Slots>;
declare const _default: typeof __VLS_export;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
