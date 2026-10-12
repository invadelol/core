/**
 * Figures for display. Locale-aware functions take the UI language last (`en` by default); views
 * call them through `useFormat()`, which passes the host's language.
 */
/** Locale-aware number: `num(1234.5, 1, 'fr')` → "1 234,5". */
export declare function num(n: number, digits?: number, locale?: string): string;
export declare function mmss(seconds: number): string;
/** 2340 -> "+2.3k", -800 -> "-800" */
export declare function signedGold(n: number, locale?: string): string;
export declare function pct(x: number, locale?: string): string;
/** 1532 -> "1.5k", 240000 -> "240k", 12 -> "12" */
export declare function compact(n: number, locale?: string): string;
/** Placement as an ordinal in the UI language: "3rd" (en), "3e" (fr), "#3" elsewhere. */
export declare function ordinal(n: number, locale?: string): string;
/** Invade score for display: the engine scores 0‥10, every surface shows 0‥100. */
export declare const score100: (s: number) => number;
/** KDA ratio: "3.25", "∞" without deaths. */
export declare const kdaRatio: (k: number, d: number, a: number, locale?: string) => string;
/** "+19", "−21", "±0" with a real minus sign. */
export declare const signedLp: (n: number) => string;
/** "3 days ago", "2 h ago"… from an epoch-millisecond time. */
export declare function ago(ms: number, locale?: string): string;
/** Day header for grouped game lists: "Today", "Yesterday", else "Monday 21 September" in the UI language. */
export declare function dayLabel(ms: number, todayLabel: string, yesterdayLabel: string, locale?: string): string;
/** Local calendar day of an epoch-ms time, for grouping. */
export declare const dayKey: (ms: number) => string;
