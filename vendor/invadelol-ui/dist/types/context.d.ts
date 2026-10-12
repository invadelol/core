/**
 * What the host gives the views: strings, the UI language, where images live, where links go and,
 * optionally, a favorites store. Both hosts resolve images to invade.lol's `/cdn` proxy; the app
 * navigates in place, the website to real URLs. Every option has a default, so a view renders (in
 * English, without images) even with nothing provided.
 */
import { type App, type Ref } from 'vue';
import { type Translate } from './logic/i18n';
import * as f from './logic/format';
import type { MatchSummary } from './logic/types';
/** Images the views draw. `rank` is the full crest of a tier (`gold`); small crests are bundled. */
export type AssetKind = 'champion' | 'splash' | 'item' | 'spell' | 'rune' | 'runeStyle' | 'profileIcon' | 'rank';
/** Things with a display name. */
export type NameKind = 'champion' | 'item' | 'spell' | 'rune' | 'runeStyle';
/** Where a link goes. */
export type LinkTarget = {
    kind: 'player';
    puuid: string;
    gameName?: string;
    tagLine?: string;
} | {
    kind: 'match';
    gameId: number;
    matchId?: string | null;
    puuid?: string;
} | {
    kind: 'champion';
    id: number;
};
/** A game saved to favorites: what its row shows offline, and the ids that open it again. */
export type GameFavorite = Pick<MatchSummary, 'gameId' | 'matchId' | 'queueId' | 'championId' | 'win' | 'remake' | 'kills' | 'deaths' | 'assists' | 'creation' | 'duration'> & {
    key: string;
    kind: 'game';
    label: string;
    puuid: string;
};
export interface InvadeUiOptions {
    /** Translates an English key and fills `{name}` placeholders. Reactive if the host's is. */
    t?: Translate;
    /** UI language (`en`, `fr`…), for numbers, dates and ordinals. */
    locale?: Ref<string> | string;
    /** Image URL of an asset; `undefined` draws an empty well. */
    assetUrl?: (kind: AssetKind, id: number | string) => string | undefined;
    /** Display name of a champion, item, spell or rune. */
    name?: (kind: NameKind, id: number) => string | undefined;
    /** `href` of a link target; without one the link renders as a button. */
    linkTo?: (target: LinkTarget) => string | undefined;
    /** Handles a click on a link (in-app navigation, a router visit); the default navigation is then prevented. */
    onOpen?: (target: LinkTarget, event: MouseEvent) => void;
    /** The viewer's own puuid (marks "You" in a scoreboard). */
    viewer?: Ref<string | null | undefined> | string | null;
    /** Favorites: a star on rows and the match detail when provided. `has` may be reactive. */
    favorites?: {
        has: (key: string) => boolean;
        toggle: (favorite: GameFavorite) => void;
    };
}
export interface InvadeUi {
    t: Translate;
    locale: Ref<string>;
    assetUrl: (kind: AssetKind, id: number | string) => string | undefined;
    name: (kind: NameKind, id: number) => string;
    linkTo: (target: LinkTarget) => string | undefined;
    onOpen: InvadeUiOptions['onOpen'];
    viewer: Ref<string | null | undefined>;
    favorites: InvadeUiOptions['favorites'];
}
/** Installs the host's options for every view of `app`. */
export declare function provideInvadeUi(app: App, options: InvadeUiOptions): void;
/** The same, as a plugin: `app.use(createInvadeUi({ … }))`. */
export declare const createInvadeUi: (options: InvadeUiOptions) => {
    install: (app: App) => void;
};
/** The host's options (defaults when none were provided). */
export declare const useInvadeUi: () => InvadeUi;
/**
 * Formatting in the host's language. Each function reads the language when called, so templates
 * re-render when it changes.
 */
export declare function useFormat(): {
    num: (n: number, digits?: number) => string;
    pct: (x: number) => string;
    compact: (n: number) => string;
    signedGold: (n: number) => string;
    ordinal: (n: number) => string;
    kdaRatio: (k: number, d: number, a: number) => string;
    ago: (ms: number) => string;
    dayLabel: (ms: number) => string;
    date: (ms: number, opts: Intl.DateTimeFormatOptions) => string;
    mmss: typeof f.mmss;
    score100: (s: number) => number;
    signedLp: (n: number) => string;
};
/** The key and contents of a game favorite. */
export declare function gameFavorite(puuid: string, label: string, g: Omit<GameFavorite, 'key' | 'kind' | 'label' | 'puuid'>): GameFavorite;
/** Names and image URLs of game things, through the host's resolvers. */
export declare const useNames: () => {
    champName: (id: number) => string;
    champIcon: (id: number) => string | undefined;
    runeName: (id: number) => string;
    styleName: (id: number) => string;
    spellName: (id: number) => string;
    runeIcon: (id: number) => string | undefined;
    styleIcon: (id: number) => string | undefined;
    spellIcon: (id: number) => string | undefined;
    itemIcon: (id: number) => string | undefined;
};
