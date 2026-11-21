import type { HomeLaneRow, HomePatchChange } from './home.js'
import { isLive, type ProMatch } from './pro_matches.js'

/**
 * The three cards under the home's search, from what the page already gets: the pro game of the
 * moment, the patch's changes, and one lane figure. Each card is left out when its data is
 * missing, and the next one takes its place.
 */

/** The patch's changes as the card lists them: buffs, nerfs, then other changes if room is left. */
export interface PatchChanges {
  up: HomePatchChange[]
  down: HomePatchChange[]
  mix: HomePatchChange[]
}

/** Places gained in its role since the patch before (negative: lost); null when not known. */
export const placesGained = (c: HomePatchChange) =>
  c.rank != null && c.prevRank != null ? c.prevRank - c.rank : null

/**
 * The patch's changes for the home's card, `limit` lines: buffs then nerfs, both sides shown when
 * the notes have both (the nerfs up to half), adjusted champions only in the room left. On each
 * side the champions the change moved most in their role come first (the biggest climbs among the
 * buffs, the biggest falls among the nerfs), the notes' order after them.
 */
export function patchChanges(changes: HomePatchChange[] = [], limit = 4): PatchChanges {
  const by = (kind: HomePatchChange['kind'], sign: 1 | -1) =>
    changes
      .filter((c) => c.kind === kind)
      .map((c, i) => ({ c, i, g: placesGained(c) }))
      .sort((a, b) =>
        a.g === null || b.g === null
          ? (a.g === null ? 1 : 0) - (b.g === null ? 1 : 0) || a.i - b.i
          : sign * (b.g - a.g) || a.i - b.i
      )
      .map((x) => x.c)
  const up = by('up', 1)
  const down = by('down', -1)
  const mix = [...by('mix', 1), ...by('new', 1)]
  const downShown = Math.min(down.length, up.length ? Math.max(1, Math.floor(limit / 2)) : limit)
  const upShown = Math.min(up.length, limit - downShown)
  const downAll = Math.min(down.length, limit - upShown)
  const left = limit - upShown - downAll
  return { up: up.slice(0, upShown), down: down.slice(0, downAll), mix: mix.slice(0, left) }
}

/** The pro game a card shows: the one being played, else the next, else the last result. */
export function headlineGame(games: ProMatch[], result: ProMatch | null | undefined) {
  return games.find((g) => isLive(g)) ?? games[0] ?? result ?? null
}

export type HomeCard =
  | { key: 'game'; game: ProMatch }
  | { key: 'changes'; changes: PatchChanges; patch: string }
  | { key: 'bullies'; rows: HomeLaneRow[] }
  | { key: 'firstBlood'; rows: HomeLaneRow[] }

/** A list card needs this many lines to be worth its place. */
const MIN_ROWS = 3

/** The cards in their order, three at most: a missing one leaves its place to the next. */
export function homeCards(input: {
  game: ProMatch | null
  changes: PatchChanges | null
  /** The patch the changes are of, as players name it ("26.23"). */
  patch: string | null
  lanes: { bullies: HomeLaneRow[]; firstBlood: HomeLaneRow[] } | null | undefined
}): HomeCard[] {
  const cards: HomeCard[] = []
  if (input.game) cards.push({ key: 'game', game: input.game })
  const changes = input.changes
  const lines = changes ? changes.up.length + changes.down.length + changes.mix.length : 0
  if (changes && lines >= MIN_ROWS && input.patch)
    cards.push({ key: 'changes', changes, patch: input.patch })
  const lanes = input.lanes
  if (lanes && lanes.bullies.length >= MIN_ROWS)
    cards.push({ key: 'bullies', rows: lanes.bullies.slice(0, 5) })
  if (lanes && lanes.firstBlood.length >= MIN_ROWS)
    cards.push({ key: 'firstBlood', rows: lanes.firstBlood.slice(0, 5) })
  return cards.slice(0, 3)
}
