import { test } from '@japa/runner'
import { cleanEvents, keyEvent, momentOf } from '#services/clips/events'
import { recapFrom } from '#services/clips/recap'
import type { ClipEvent } from '../../inertia/lib/clip_types.js'

const NAMES: Record<string, string> = { 81: 'Ezreal', 64: 'Lee Sin', 103: 'Ahri' }
const name = (id: number) => NAMES[id] ?? 'a champion'
const event = (over: Partial<ClipEvent>): ClipEvent => ({
  t: 552_300,
  kind: 'kill',
  killer: 81,
  victim: 64,
  assisters: [],
  detail: null,
  ...over,
})

/**
 * What a clip says happened (app/services/clips/events.ts): the app's events cut to the clip's
 * window with players as champions, the key event its moment names; and each kill's damage recap
 * read from Riot's match timeline (app/services/clips/recap.ts).
 */
test.group('Clip events', () => {
  test('events are kept around the clip only, players as champions, never a Riot ID', ({
    assert,
  }) => {
    const events = cleanEvents(
      [
        { t: 552_300, kind: 'kill', killer: 'Ember#0002', victim: 'Lee Sin', assisters: ['Ahri'] },
        { t: 538_100, kind: 'assist', killer: 'Ahri', victim: 'Lee Sin' },
        { t: 530_000, kind: 'kill', killer: 'Ember#0002', victim: 'Ahri' },
        { t: 560_000, kind: 'dance', killer: 'Ember#0002' },
        { t: 'soon', kind: 'kill' },
        { t: 556_000, kind: 'objective', killer: 'Turret_T2_C_05', detail: '  Baron   Nashor ' },
      ],
      { startMs: 541_000, durationMs: 21_000 },
      [{ gameName: 'Ember', tagLine: '0002', championId: 81 }],
      NAMES
    )
    assert.deepEqual(
      events.map((e) => [e.t, e.kind, e.killer, e.victim, e.assisters, e.detail]),
      [
        [538_100, 'assist', 103, 64, [], null],
        [552_300, 'kill', 81, 64, [103], null],
        [556_000, 'objective', null, null, [], 'Baron Nashor'],
      ]
    )
    assert.notInclude(JSON.stringify(events), 'Ember')
  })

  test('the moment names the biggest event of the poster, at its time', ({ assert }) => {
    const kill = event({})
    const multi = event({ t: 556_000, kind: 'multikill', detail: '3' })
    assert.equal(momentOf([kill], 81, name), 'Solo kill on Lee Sin')
    assert.equal(momentOf([event({ assisters: [103] })], 81, name), 'Kill on Lee Sin')
    assert.equal(momentOf([kill, multi], 81, name), 'Triple kill')
    assert.equal(keyEvent([kill, multi], 81)?.t, 556_000)
    assert.equal(
      momentOf([event({ kind: 'death', killer: 64, victim: 81 })], 81, name),
      'Death to Lee Sin'
    )
    // Someone else's multikill is not the poster's moment.
    assert.equal(
      momentOf([event({ killer: 64, victim: 103, kind: 'multikill', detail: '2' })], 81, name),
      null
    )
    assert.isNull(momentOf([], 81, name))
  })
})

test.group('Clip recap', () => {
  test('each kill of the window the player took part in, with the damage both ways', ({
    assert,
  }) => {
    const hit = (participantId: number, spellSlot: number, damage: number, basic = false) => ({
      participantId,
      spellSlot,
      basic,
      type: 'OTHER',
      physicalDamage: damage,
      magicDamage: 0,
      trueDamage: 0,
    })
    const kill = (timestamp: number, killerId: number, victimId: number) => ({
      type: 'CHAMPION_KILL',
      timestamp,
      killerId,
      victimId,
      bounty: 300,
      shutdownBounty: 150,
      victimDamageReceived: [
        hit(1, 0, 300),
        hit(1, 0, 279),
        hit(1, 1, 300),
        hit(1, 0, 0, true),
        hit(1, 4, 412, true),
        hit(3, 0, 50),
      ],
      victimDamageDealt: [hit(1, 3, 312), hit(1, 0, 186)],
    })
    const timeline = {
      info: {
        participants: [
          { participantId: 1, puuid: 'me' },
          { participantId: 2, puuid: 'lee' },
          { participantId: 3, puuid: 'ahri' },
        ],
        frames: [
          { events: [kill(530_000, 1, 2)] },
          {
            events: [
              kill(552_300, 1, 2),
              kill(553_000, 3, 2),
              { type: 'WARD_PLACED', timestamp: 552_000 },
            ],
          },
        ],
      },
    }
    const recap = recapFrom(
      timeline as never,
      {
        id: 'Clip000001',
        matchId: 'EUW1_7000000001',
        platform: 'EUW1',
        puuid: 'me',
        startMs: 541_000,
        durationMs: 21_000,
      },
      new Map([
        [1, 81],
        [2, 64],
        [3, 103],
      ]),
      new Map([
        [81, { q: 'Mystic Shot', w: 'Essence Flux' }],
        [64, { q: 'Sonic Wave', r: 'Dragon’s Rage' }],
      ])
    )
    // The kill before the window and Ahri's kill the player had no part in are left out.
    assert.lengthOf(recap, 1)
    const [first] = recap
    assert.deepInclude(first, { t: 552_300, killer: 81, victim: 64, bounty: 450 })
    // By damage, hits that did nothing left out; Ahri's damage is not the killer's.
    assert.deepEqual(
      first.dealt.map((l) => [l.name, l.hits, l.damage]),
      [
        ['Mystic Shot', 2, 579],
        ['Attacks', 1, 412],
        ['Essence Flux', 1, 300],
      ]
    )
    assert.deepEqual(
      first.taken.map((l) => [l.name, l.damage]),
      [
        ['Dragon’s Rage', 312],
        ['Sonic Wave', 186],
      ]
    )
  })
})
