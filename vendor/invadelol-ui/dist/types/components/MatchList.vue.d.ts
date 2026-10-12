import type { MatchSummary, Position, QueueFilter, ScoreRow } from '../logic/types';
/**
 * The feed: one filter bar, one summary line of what it shows (record, KDA, form), then the
 * games grouped by day (or by champion). A row opens the host's `detail` slot right below it
 * (`{ game }`: the host loads the game and renders `MatchDetail`).
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
    more?: boolean;
    loadingMore?: boolean;
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
    more: () => any;
    retry: () => any;
    "update:queue": (value: QueueFilter) => any;
    "update:champion": (value: number) => any;
    "update:role": (value: "" | Position) => any;
    "update:order": (value: "champion" | "recent") => any;
}, string, import("vue").PublicProps, Readonly<__VLS_PublicProps> & Readonly<{
    onMore?: (() => any) | undefined;
    onRetry?: (() => any) | undefined;
    "onUpdate:queue"?: ((value: QueueFilter) => any) | undefined;
    "onUpdate:champion"?: ((value: number) => any) | undefined;
    "onUpdate:role"?: ((value: "" | Position) => any) | undefined;
    "onUpdate:order"?: ((value: "champion" | "recent") => any) | undefined;
}>, {
    lp: ReadonlyMap<number, number>;
    error: string;
    private: boolean;
    more: boolean;
    loadingMore: boolean;
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
