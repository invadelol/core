import type { HomeLaneRow, HomeMover, HomeMoves, HomePatchNotes } from './home.js'
import { isLive, type ProMatch } from './pro_matches.js'

/**
 * The three cards under the home's search, from what the page already gets: the pro game of the
 * moment, where the patch moved champions, and one lane figure. Each card is left out when its
 * data is missing, and the next one takes its place.
 */

export type ChangeKind = HomePatchNotes['changes'][number]['kind']

/** A champion's move in its role since the patch before, with what the notes did to it. */
export interface MoveRow extends HomeMover {
  /** Buffed, nerfed, adjusted or new in the patch's notes; null when the notes leave it out. */
  kind: ChangeKind | null
}

/** A move only reads when the champion is near the top of the role on one side of it. */
const NEAR_TOP = 20

/**
 * Where the patch moved champions: one line per champion (the role where it sits highest), the
 * champions the notes changed first, the biggest moves first; then climbs before falls.
 */
export function patchMoves(
  moves: HomeMoves | null | undefined,
  changes: HomePatchNotes['changes'] = [],
  limit = 5
): MoveRow[] {
  if (!moves) return []
  const kinds = new Map(changes.map((c) => [c.championId, c.kind]))
  const size = (m: HomeMover) => Math.abs(m.from - m.to)
  const near = (m: HomeMover) => Math.min(m.from, m.to) <= NEAR_TOP
  const best = new Map<number, HomeMover>()
  for (const role of moves.roles) {
    for (const m of [...role.up, ...role.down]) {
      const known = best.get(m.championId)
      const better =
        !known || (near(m) && !near(known)) || (near(m) === near(known) && size(m) > size(known))
      if (better) best.set(m.championId, m)
    }
  }
  const all = [...best.values()].sort((a, b) => size(b) - size(a))
  const changed = all.filter((m) => kinds.has(m.championId))
  const rest = all.filter((m) => !kinds.has(m.championId))
  return [...changed, ...rest]
    .slice(0, limit)
    .map((m) => ({ ...m, kind: kinds.get(m.championId) ?? null }))
    .sort((a, b) => {
      const up = (m: MoveRow) => (m.to < m.from ? 0 : 1)
      return up(a) - up(b) || size(b) - size(a)
    })
}

/** The pro game a card shows: the one being played, else the next, else the last result. */
export function headlineGame(games: ProMatch[], result: ProMatch | null | undefined) {
  return games.find((g) => isLive(g)) ?? games[0] ?? result ?? null
}

export type HomeCard =
  | { key: 'game'; game: ProMatch }
  | { key: 'moves'; rows: MoveRow[]; previousPatch: string }
  | { key: 'bullies'; rows: HomeLaneRow[] }
  | { key: 'firstBlood'; rows: HomeLaneRow[] }

/** A list card needs this many lines to be worth its place. */
const MIN_ROWS = 3

/** The cards in their order, three at most: a missing one leaves its place to the next. */
export function homeCards(input: {
  game: ProMatch | null
  moves: MoveRow[]
  previousPatch: string | null
  lanes: { bullies: HomeLaneRow[]; firstBlood: HomeLaneRow[] } | null | undefined
}): HomeCard[] {
  const cards: HomeCard[] = []
  if (input.game) cards.push({ key: 'game', game: input.game })
  if (input.moves.length >= MIN_ROWS && input.previousPatch)
    cards.push({ key: 'moves', rows: input.moves, previousPatch: input.previousPatch })
  const lanes = input.lanes
  if (lanes && lanes.bullies.length >= MIN_ROWS)
    cards.push({ key: 'bullies', rows: lanes.bullies.slice(0, 5) })
  if (lanes && lanes.firstBlood.length >= MIN_ROWS)
    cards.push({ key: 'firstBlood', rows: lanes.firstBlood.slice(0, 5) })
  return cards.slice(0, 3)
}
