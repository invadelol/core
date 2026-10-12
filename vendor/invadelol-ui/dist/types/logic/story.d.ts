/**
 * The game as a story, shared by the Timeline and the Gold tabs: every kill and objective in order
 * with its tags (first blood, multi-kills), fights (kills a few seconds apart), the three phases of
 * the game, and the state of the game at any second (kill score, gold lead). Pure data: the
 * wording lives in the components.
 */
import type { Kill, MatchDetail, Objective, PlayerView, TimelineView } from './types.js';
/** Kills chained less than this many seconds apart are one fight. */
export declare const FIGHT_GAP = 15;
/** Laning ends when turret plating falls; the late game starts at 25 minutes. */
export declare const PHASES: readonly [{
    readonly id: "early";
    readonly from: 0;
    readonly to: number;
}, {
    readonly id: "mid";
    readonly from: number;
    readonly to: number;
}, {
    readonly id: "late";
    readonly from: number;
    readonly to: number;
}];
export type PhaseId = (typeof PHASES)[number]['id'];
export interface KillEvent {
    kind: 'kill';
    key: string;
    t: number;
    kill: Kill;
    /** Team the kill counts for: the killer's, or the victim's enemies when executed. */
    team: number;
    /** 1 = first blood; 2‥5 = the kill that made a double … penta. */
    first: boolean;
    multi: number;
    /** Index into `fights`, or -1 when the kill stands alone. */
    fight: number;
}
export interface ObjectiveEvent {
    kind: 'objective';
    key: string;
    t: number;
    obj: Objective;
    team: number;
    /** Same objective merged (three voidgrubs in one go = 3). */
    count: number;
}
export type GameEvent = KillEvent | ObjectiveEvent;
export interface Fight {
    start: number;
    end: number;
    /** Kills per team id. */
    kills: Map<number, number>;
}
export interface Story {
    events: GameEvent[];
    fights: Fight[];
    /** Participant id → player. */
    byId: Map<number, PlayerView>;
}
export declare function storyOf(detail: MatchDetail, timeline: TimelineView): Story;
/** Whether a player took part in an event: killed, died, assisted, or took the objective. */
export declare function involves(e: GameEvent, pid: number): boolean;
/** Objectives worth showing as context in a single player's story: the map-changing ones. */
export declare const isEpic: (e: GameEvent) => boolean;
/** Kill score (per team id) after everything up to and including second `t`. */
export declare function scoreAt(story: Story, t: number): Map<number, number>;
/**
 * A per-frame series read at second `t`, linearly between the two frames around it (frames are
 * one minute apart, so a fight at 12:40 reads two thirds of the way to the 13:00 frame).
 */
export declare function valueAt(times: number[], values: number[], t: number): number;
/** Gold lead of `team` (blue minus red as the client gives it, flipped for red). */
export declare const leadFor: (timeline: TimelineView, team: number) => number[];
