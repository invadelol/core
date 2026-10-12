/**
 * The data model every view reads: one shape for both products. The desktop app fills it from the
 * League client and its local database (its Rust side serialises these as camelCase), invade.lol
 * from its API (`fromCoreMatch`). A value a source cannot give is `null`, never a made-up zero.
 */
/** `TOP` `JUNGLE` `MID` `ADC` `SUPPORT`. */
export type Position = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT';
/** Queue filter of a match list (ids of `QUEUE_FILTERS`). */
export type QueueFilter = 'all' | 'solo' | 'flex' | 'normal' | 'aram' | 'arena';
export interface Rank {
    /** `IRON` … `CHALLENGER`. */
    tier: string;
    /** `I` … `IV`; empty for apex tiers. */
    division: string;
    lp: number;
    wins: number;
    /** 0 when unknown (another player's client hides losses). */
    losses: number;
    provisional: boolean;
    /** Last season's final tier, `''` if none. */
    previous: string;
}
export interface Totals {
    games: number;
    wins: number;
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    /** Seconds played. */
    seconds: number;
}
export interface ChampTotals extends Totals {
    championId: number;
}
export interface Recent extends Totals {
    /** Newest first: `true` = win. */
    results: boolean[];
    /** +3 = three wins in a row, -2 = two losses. */
    streak: number;
    /** [lane, games], most played first. */
    lanes: [string, number][];
    champions: ChampTotals[];
    /** Ranked solo/duo games among them. */
    ranked: number;
}
export interface Mastery {
    championId: number;
    championLevel: number;
    championPoints: number;
    /** Epoch ms. */
    lastPlayTime: number;
}
export interface PlayerCard {
    puuid: string;
    gameName: string;
    tagLine: string;
    icon: number;
    level: number;
    private: boolean;
    solo: Rank | null;
    flex: Rank | null;
    recent: Recent;
    /** Most points first. */
    mastery: Mastery[];
    /** Built from saved data because the live source could not answer. */
    offline: boolean;
}
export interface LpPoint {
    /** Epoch ms. */
    t: number;
    queue: 'solo' | 'flex';
    tier: string;
    division: string;
    lp: number;
    wins: number;
    losses: number;
    /** Continuous ladder value: Iron IV 0 LP = 0, +100 per division, Master+ from 2800. */
    value: number;
}
export interface ChampRow {
    championId: number;
    games: number;
    wins: number;
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    seconds: number;
    damage: number;
    gold: number;
    vision: number;
}
export interface ProfileView {
    card: PlayerCard;
    /** The viewer is this player (signed in to this account right now). */
    isSelf: boolean;
    /** One of the viewer's own accounts. */
    isOwn: boolean;
    champions: ChampRow[];
    lanes: [Position, number][];
    /** Oldest first (own accounts only). */
    lp: LpPoint[];
}
/** A teammate the player queued with. */
export interface Mate {
    puuid: string;
    gameName: string;
    tagLine: string;
    icon: number;
    games: number;
    wins: number;
    /** Epoch ms of the last game together. */
    last: number;
}
export interface PlayedWith {
    mates: Mate[];
    /** How many of the player's recent full games were looked at. */
    games: number;
}
export type Badge = 'mvp' | 'ace' | 'carry_damage' | 'tank' | 'vision' | 'cc' | 'objectives' | 'first_blood' | 'triple' | 'quadra' | 'penta' | 'deathless' | 'lane_won';
export interface ScoreRow {
    gameId: number;
    /** 0‥10 (shown ×10, see `score100`). */
    score: number;
    /** 1 = best of the game. */
    rank: number;
    tag: 'mvp' | 'ace' | '';
    /** Champion id of the lane opponent, when the positions could be assigned. */
    opponent?: number | null;
    /** Kill participation 0‥1. */
    kp?: number | null;
    /** Earned badges other than MVP / ACE. */
    badges?: Badge[];
}
export interface MatchSummary {
    gameId: number;
    /** `EUW1_7998180573`: how invade.lol knows the game. */
    matchId: string | null;
    creation: number;
    duration: number;
    queueId: number;
    mapId: number;
    championId: number;
    win: boolean;
    remake: boolean;
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    csMin: number;
    gold: number;
    damage: number;
    vision: number;
    level: number;
    items: number[];
    spells: number[];
    keystone: number;
    primaryStyle: number;
    subStyle: number;
    lane: Position | null;
    /** Arena placement, 0 elsewhere. */
    placement: number;
    score: ScoreRow | null;
}
export interface MatchPage {
    games: MatchSummary[];
    more: boolean;
}
export interface TeamView {
    teamId: number;
    win: boolean;
    bans: number[];
    kills: number;
    deaths: number;
    assists: number;
    gold: number;
    damage: number;
    towers: number;
    inhibitors: number;
    dragons: number;
    barons: number;
    heralds: number;
    /** Null when the source does not count them. */
    grubs: number | null;
    dragonTypes: string[];
    /** Null when the source does not say. */
    firstBlood: boolean | null;
    firstTower: boolean | null;
    firstDragon: boolean | null;
    firstBaron: boolean | null;
    firstInhibitor: boolean | null;
}
export interface PlayerView {
    participantId: number;
    teamId: number;
    win: boolean;
    puuid: string;
    gameName: string;
    tagLine: string;
    championId: number;
    level: number;
    spells: number[];
    /** Keystone, 3 primary runes, 2 secondary runes. */
    perks: number[];
    /** Primary and secondary tree. */
    styles: number[];
    items: number[];
    kills: number;
    deaths: number;
    assists: number;
    kp: number;
    cs: number;
    csMin: number;
    gold: number;
    goldShare: number;
    damage: number;
    physical: number;
    magic: number;
    trueDamage: number;
    damageShare: number;
    damageTaken: number;
    /** The values below are null when the source does not record them (invade.lol's stored games). */
    mitigated: number | null;
    healing: number | null;
    vision: number;
    wardsPlaced: number;
    wardsKilled: number;
    controlWards: number;
    ccTime: number | null;
    objectiveDamage: number;
    turretDamage: number;
    doubles: number | null;
    triples: number | null;
    quadras: number | null;
    pentas: number | null;
    largestSpree: number | null;
    largestMulti: number | null;
    firstBlood: boolean;
    position: Position | null;
    /** Participant id of the lane opponent. */
    opponent: number | null;
    /** Leads over the lane opponent at 15:00 (needs a timeline and a 15-minute game). */
    gold15: number | null;
    xp15: number | null;
    cs15: number | null;
    /** Invade score 0‥10, null for remakes or when unscored. */
    score: number | null;
    /** 1 = best of the game, 0 = unranked. */
    rank: number;
    badges: Badge[];
    augments: number[];
    placement: number;
}
export interface Kill {
    t: number;
    killer: number;
    victim: number;
    assists: number[];
    x: number;
    y: number;
}
export interface Objective {
    t: number;
    kind: 'dragon' | 'baron' | 'herald' | 'grubs' | 'monster' | 'tower' | 'inhibitor';
    sub: string;
    team: number;
    lane: string;
    killer: number;
}
export interface TimelineView {
    /** Seconds per frame (one per minute, last at the end). */
    t: number[];
    /** `gold[i]` belongs to `players[i]`. */
    gold: number[][];
    xp: number[][];
    cs: number[][];
    level: number[][];
    /** Blue minus red. */
    goldDiff: number[];
    xpDiff: number[];
    kills: Kill[];
    objectives: Objective[];
}
export interface MatchDetail {
    gameId: number;
    creation: number;
    duration: number;
    queueId: number;
    mapId: number;
    version: string;
    remake: boolean;
    teams: TeamView[];
    /** Ordered by participant id. */
    players: PlayerView[];
    timeline: TimelineView | null;
    /** Built from invade.lol's copy of the game. */
    fromCore: boolean;
}
