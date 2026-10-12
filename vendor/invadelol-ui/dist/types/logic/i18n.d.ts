/**
 * Strings. The English text is the key (`t('Win rate')`, `t('{n} games', { n })`), the same keys the
 * desktop app's locale files hold: the host passes its own `t`, and without one the package speaks
 * English. Every key the package uses is listed in `dist/keys.json`.
 */
export type Params = Record<string, string | number>;
export type Translate = (key: string, params?: Params) => string;
/** Fills `{name}` placeholders. */
export declare const fill: (s: string, params?: Params) => string;
/** The default `t`: English, placeholders filled. */
export declare const english: Translate;
/**
 * Marks English text that is translated later with `t(x)` (labels in tables and arrays), so key
 * extractors find it. Returns its argument unchanged.
 */
export declare const tk: <S extends string>(s: S) => S;
