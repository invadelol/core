import { test } from '@japa/runner'
import { FALLBACK_LEAGUES, LeagueCatalog, type League } from '#services/pro_leagues'
import { isLive, isNext, matchOf, split, type ProMatch } from '#services/pro_match_service'
import { photoSize, photoVersion } from '#services/pro_photo_service'
import { matchList, teamLabel, utcTime } from '../../inertia/lib/pro_matches.js'

const league = (slug: string, teams: string[], extra: Partial<League> = {}): League => ({
  slug,
  code: slug.toUpperCase(),
  name: slug,
  region: null,
  tier: 1,
  priority: 10,
  teams,
  ...extra,
})

test.group('Pro leagues', () => {
  test('lists the leagues with teams by priority, the first one opening /pros', ({ assert }) => {
    const c = new LeagueCatalog(
      [
        league('worlds', [], { tier: 0, priority: 1 }),
        league('lec', ['fnatic', 'g2-esports'], { priority: 10 }),
        league('lfl', ['karmine-corp-blue'], { tier: 2, priority: 20 }),
      ],
      true
    )
    assert.deepEqual(
      c.listed.map((l) => l.slug),
      ['lec', 'lfl']
    )
    assert.equal(c.first?.slug, 'lec')
    assert.equal(c.ofTeam('karmine-corp-blue')?.slug, 'lfl')
    assert.isNull(c.ofTeam('nobody'))
    assert.equal(c.bySlug('LEC')?.slug, 'lec')
  })

  test('an old league address goes where its teams play now', ({ assert }) => {
    const lcs = FALLBACK_LEAGUES.find((l) => l.slug === 'lcs')!
    const c = new LeagueCatalog(
      [league('lta-north', lcs.teams.slice(0, 6), { code: 'LTA N' })],
      true
    )
    assert.equal(c.successor('lcs')?.slug, 'lta-north')
    assert.isNull(c.successor('lta-north'))
    assert.isNull(c.successor('nothing'))
    const byCode = new LeagueCatalog([league('lec-2027', ['fnatic'], { code: 'LEC' })], true)
    assert.equal(byCode.successor('lec')?.slug, 'lec-2027')
  })
})

const row = (over: Record<string, unknown> = {}) => ({
  external_id: 1,
  tournament: 'Playoffs',
  name: 'Final: AAA vs BBB',
  begin_at: new Date('2026-11-06T22:00:00Z'),
  status: 'not_started',
  best_of: 5,
  team1_id: 'a',
  team2_id: null,
  team1_name: 'Team A',
  team1_code: 'AAA',
  team2_name: null,
  team2_code: null,
  score1: 0,
  score2: 0,
  winner: null,
  stream_url: 'http://www.twitch.tv/x',
  league_slug: 'worlds',
  league_code: 'Worlds',
  league_name: 'World Championship',
  t1_slug: 'team-a',
  t1_name: 'Team A',
  t1_short: 'AAA',
  t2_slug: null,
  t2_name: null,
  t2_short: null,
  ...over,
})

test.group('Pro matches', () => {
  test('a stored match reads with our teams, a TBD side and an https stream', ({ assert }) => {
    const m = matchOf(row())
    assert.equal(m.teams[0].slug, 'team-a')
    assert.isNull(m.teams[1].id)
    assert.equal(teamLabel(m.teams[1]), 'TBD')
    assert.equal(m.stream, 'https://www.twitch.tv/x')
    assert.equal(m.at, '2026-11-06T22:00:00.000Z')
    assert.isNull(matchOf(row({ stream_url: 'javascript:alert(1)' })).stream)
  })

  test('next, live and results, and a stale running match is neither', ({ assert }) => {
    const now = Date.parse('2026-11-06T23:00:00Z')
    const at = (h: number) => new Date(now + h * 3_600_000)
    const live = matchOf(row({ status: 'running', begin_at: at(-1) }))
    const stale = matchOf(row({ status: 'running', begin_at: at(-30) }))
    const late = matchOf(row({ begin_at: at(-10) }))
    const soon = matchOf(row({ begin_at: at(3) }))
    const done = matchOf(row({ status: 'finished', winner: 1, begin_at: at(-48) }))
    assert.isTrue(isLive(live, now))
    assert.isFalse(isLive(stale, now))
    assert.isTrue(isNext(soon, now))
    assert.isFalse(isNext(late, now))
    const { next, results } = split([done, stale, late, live, soon] as ProMatch[], now)
    assert.deepEqual(next, [live, soon])
    assert.deepEqual(results, [done])
  })

  test('the first render reads in UTC and malformed matches are left out', ({ assert }) => {
    assert.equal(utcTime('2026-11-06T22:00:00.000Z'), '6 Nov, 22:00 UTC')
    const good = matchOf(row())
    assert.lengthOf(matchList([good, null, { at: 1 }, { ...good, teams: [good.teams[0]] }]), 1)
    assert.deepEqual(matchList(undefined), [])
  })
})

test.group('Pro photos', () => {
  test('sizes round up to a served one and a new source gets a new version', ({ assert }) => {
    assert.equal(photoSize(36), 40)
    assert.equal(photoSize(144), 144)
    assert.equal(photoSize(9999), 240)
    assert.equal(photoSize('x'), 240)
    assert.notEqual(photoVersion('https://a/1.png'), photoVersion('https://a/2.png'))
    assert.lengthOf(photoVersion('https://a/1.png'), 8)
  })
})
