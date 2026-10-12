import type { Mastery, MatchDetail, MatchSummary, Objective, Ping, PlayedWith, Position, ProfileView, Rank, ScoreCategory } from './types.js';
/** Pings per kind (`allInPings`…), on Riot's games. */
export type CorePings = Partial<Record<`${Ping}Pings`, number>>;
export interface CoreParticipant extends CorePings {
    puuid: string;
    gameName: string;
    tagLine: string;
    championId: number;
    teamId: number;
    /** ClickHouse's Bool arrives as 0 / 1. */
    win: boolean | number;
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    level: number;
    champLevel: number;
    items: number[];
    spells: number[];
    perks: {
        primary: number;
        sub: number;
        keystone: number;
    };
    visionScore: number;
    damageTaken: number;
    totalDamageDealtToChampions: number;
    physicalDamageDealtToChampions: number;
    magicDamageDealtToChampions: number;
    trueDamageDealtToChampions: number;
    damageDealtToObjectives: number;
    damageDealtToTurrets: number;
    visionWardsBoughtInGame: number;
    /** Riot's `TOP` `JUNGLE` `MIDDLE` `BOTTOM` `UTILITY`, empty in roleless modes. */
    position: string;
    goldEarned: number;
    wardsPlaced: number;
    wardsKilled: number;
    /** Jungle monsters among `cs`. */
    neutralMinionsKilled: number;
    /** The icon the player had in this game, when stored. */
    profileIconId?: number;
}
export interface CoreTimelineEntry {
    participantId: number;
    puuid: string;
    teamId: number;
    frameMs: number;
    level: number;
    xp: number;
    goldTotal: number;
    cs: number;
    jungleCs: number;
    perks?: {
        primaryStyle: number;
        secondaryStyle: number;
        keystone: number;
        runes: number[];
        /** 0 when not recorded (games from the desktop app). */
        statPerks?: {
            offense: number;
            flex: number;
            defense: number;
        };
    };
    /** Skill slots (1 Q … 4 R) in the order they were levelled, repeated on each frame. */
    skillOrder?: number[];
}
export interface CoreEvent {
    /** Seconds into the game. */
    t: number;
    kind: 'kill' | Objective['kind'];
    sub: string;
    lane: string;
    team: number;
    killer: number;
    victim: number;
    assists: number[];
    x: number;
    y: number;
}
export interface CoreMatch {
    matchId: string;
    /** Epoch ms; ClickHouse's UInt64 arrives as a string. */
    gameStartMs: number | string;
    /** Seconds. */
    duration: number;
    queueId: number;
    mapId: number;
    patch: string;
    t1Win: number;
    t2Win: number;
    t1Towers: number;
    t2Towers: number;
    t1Inhibs: number;
    t2Inhibs: number;
    t1Dragons: number;
    t2Dragons: number;
    t1Barons: number;
    t2Barons: number;
    t1Heralds: number;
    t2Heralds: number;
    t1Bans: number[];
    t2Bans: number[];
    participants: CoreParticipant[];
    timeline?: CoreTimelineEntry[];
    events?: CoreEvent[];
    /** What a game from the desktop app could not report (`pings: false`: its zeros are not counts). */
    completeness?: {
        pings: boolean;
    } | null;
}
export interface CoreRank {
    queueType: string;
    tier: string;
    division: string;
    leaguePoints: number;
    wins: number;
    /** Null when the rank came from another player's client, which hides losses. */
    losses: number | null;
}
/** A row of the rank history: when it was read. */
export interface CoreRankSnapshot extends CoreRank {
    /** ISO date. */
    fetchedAt: string;
}
export interface CoreSummoner {
    puuid: string;
    gameName: string;
    tagLine: string;
    profileIconId: number | null;
    summonerLevel: number | null;
}
/** What invade.lol knows of a player: its summoner, ranks, mastery and the games loaded so far. */
export interface CoreProfile {
    summoner: CoreSummoner;
    /** Current ranks per queue and every rank read, newest first. Null while unknown. */
    ranks: {
        current: CoreRank[];
        history: CoreRankSnapshot[];
    } | null;
    mastery: Mastery[];
    /** The loaded games, newest first (`summaryOf` each stored match). */
    games: MatchSummary[];
}
export interface FromCoreOptions {
    /** Invade score per puuid, 0‥100 (invade.lol's `lobbyScores`). Ranks, MVP and ACE follow from it. */
    scores?: Record<string, number>;
    /** Earned badges per puuid (invade.lol's `earnedBadges` keys); unknown keys are dropped. */
    badges?: Record<string, readonly string[]>;
    /** What each score is made of (invade.lol's `scoreLobby`): 0‥100 per category, and its weight in %. */
    parts?: Record<string, {
        categories: Record<ScoreCategory, number>;
        weights: Record<ScoreCategory, number>;
    }>;
}
/** Riot's `teamPosition` (`MIDDLE`, `UTILITY`…) as a position; null in modes without lanes. */
export declare const positionOf: (riot: string | null | undefined) => Position | null;
/** `EUW1_7998180573` → 7998180573. */
export declare const gameIdOf: (matchId: string) => number;
/** One stored match as the detail views read it. */
export declare function fromCoreMatch(match: CoreMatch, opts?: FromCoreOptions): MatchDetail;
/** One player's game as a match row, from its detail (either source). Null when they are not in it. */
export declare function summaryOf(d: MatchDetail, puuid: string, matchId?: string | null): MatchSummary | null;
/** A rank as invade.lol serves it. Unknown losses stay 0, which the views read as "not known". */
export declare const rankFromCore: (r: CoreRank) => Rank;
/**
 * A profile as invade.lol knows it. Champions, roles and recent form are read from the loaded
 * games, as the app does (the table grows as older games load); the LP line from the stored rank
 * history. invade.lol has no signed-in viewer, so nobody is "you" here.
 */
export declare function profileFromCore({ summoner, ranks, mastery, games }: CoreProfile): ProfileView;
/**
 * The people a player queues with, from their loaded games: teammates seen in at least two of the
 * latest 40 full games, the eight most frequent (the desktop app's rule). Names and icons are the
 * ones of the last game together.
 */
export declare function playedWithFromCore(matches: readonly CoreMatch[], puuid: string): PlayedWith;
