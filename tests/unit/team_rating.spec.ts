import { readFileSync } from 'node:fs'
import { test } from '@japa/runner'
import { rowTeamRating, summaryOf, teamRating } from '@invadelol/ui/logic'
import { detailOf } from '../../inertia/lib/match.js'
import type { Match, Participant } from '../../inertia/lib/types.js'

/* The team rating is read in @invadelol/ui from the teammates' scores, which each product sends:
   the desktop app from its own scorer (checked against the same fixture), the site from the
   lobby it scores here. Same scores, same label. */

const sorted = (v: (number | null)[]) => [...v].sort((a, b) => (a ?? -1) - (b ?? -1))

const doc = JSON.parse(
  readFileSync(new URL('../fixtures/score_lobbies.json', import.meta.url), 'utf8')
)

function match(l: { duration: number; participants: Participant[] }, i: number): Match {
  return {
    matchId: `EUW1_${i + 1}`,
    duration: l.duration,
    queueId: 420,
    mapId: 11,
    participants: l.participants.map((p) => ({
      ...p,
      gameName: '',
      tagLine: '',
      championId: 1,
      items: [],
      spells: [],
      perks: { primary: 0, sub: 0, keystone: 0 },
    })),
  } as unknown as Match
}

test.group('Team rating', () => {
  test('a row carries its four teammates’ scores', ({ assert }) => {
    doc.lobbies.forEach((l: any, i: number) => {
      const detail = detailOf(match(l, i))
      l.participants.forEach((p: Participant, k: number) => {
        const row = summaryOf(detail, p.puuid)
        if (l.scores[k] === null) return assert.isNull(row?.score ?? null)
        const mates = l.participants
          .map((o: Participant, j: number) =>
            o !== p && o.teamId === p.teamId ? l.scores[j] : undefined
          )
          .filter((s: number | null | undefined) => s !== undefined)
          .map((s: number | null) => (s === null ? null : s / 10))
        assert.deepEqual(sorted(row!.score!.mates!), sorted(mates))
      })
    })
  })

  test('the site rates each game as the app does from the same scores', ({ assert }) => {
    const seen = new Set<string>()
    doc.lobbies.forEach((l: any, i: number) => {
      const detail = detailOf(match(l, i))
      l.participants.forEach((p: Participant, k: number) => {
        const row = summaryOf(detail, p.puuid)
        if (!row?.score) return
        const site = rowTeamRating(row, row.score)
        // What the app sends: its scorer's scores (the fixture's), unrounded is fine.
        const mates = l.participants
          .filter((o: Participant) => o !== p && o.teamId === p.teamId)
          .map((o: Participant) => {
            const s = l.scores[l.participants.indexOf(o)]
            return s === null ? null : s / 10 + 0.004
          })
        assert.deepEqual(
          site,
          teamRating({ win: p.win, remake: false, mapId: 11 }, mates),
          `lobby ${i} player ${k}`
        )
        assert.isNotNull(site)
        seen.add(site!.rating)
      })
    })
    assert.isAbove(seen.size, 2)
  })
})
