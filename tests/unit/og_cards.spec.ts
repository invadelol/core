import { test } from '@japa/runner'
import sharp from 'sharp'
import { H, W, drawable, title } from '#services/og/kit'
import { profileCard, profileMood } from '#services/og/profile_card'
import {
  appCard,
  championCard,
  championMood,
  figureCard,
  homeCard,
  patchCard,
  tierListCard,
} from '#services/og/site_cards'
import { esportsCard, ladderCard, proCard, prosCard, teamCard } from '#services/og/esports_cards'
import { masteryCard, matchCard, matchMood } from '#services/og/game_cards'
import { streakOf } from '#controllers/social_cards_controller'
import { shareArt } from '#tests/fixtures/match_share'

/** A 1200 by 630 JPEG, small enough for every platform's preview. */
async function isCard(assert: any, image: Buffer) {
  const meta = await sharp(image).metadata()
  assert.equal(meta.format, 'jpeg')
  assert.equal(meta.width, W)
  assert.equal(meta.height, H)
  assert.isAtMost(image.byteLength, 300 * 1024)
}

const icon = () =>
  sharp({ create: { width: 120, height: 120, channels: 3, background: '#3b6' } })
    .png()
    .toBuffer()

test.group('Link previews', () => {
  test('the poro reacts to the player, the champion and the game', ({ assert }) => {
    const rank = (tier: string) => ({ tier, division: 'I', lp: 10 })
    assert.equal(
      profileMood({ rank: rank('CHALLENGER'), games: 20, winRate: 0.4, streak: -5 }),
      'rocker'
    )
    assert.equal(profileMood({ rank: rank('GOLD'), games: 20, winRate: 0.6, streak: -3 }), 'snoozy')
    assert.equal(profileMood({ rank: rank('GOLD'), games: 20, winRate: 0.6, streak: 1 }), 'cheeky')
    assert.equal(profileMood({ rank: null, games: 20, winRate: 0.4, streak: -1 }), 'ghost')
    assert.equal(profileMood({ rank: null, games: 4, winRate: 0.25, streak: 1 }), 'peace')
    assert.equal(championMood(0, 0.54), 'cheeky')
    assert.equal(championMood(5, 0.46), 'snoozy')
    assert.equal(championMood(null, null), 'snax')
    assert.equal(matchMood({ win: true, score: 92, tag: 'MVP', deaths: 1 }), 'rocker')
    assert.equal(matchMood({ win: false, score: 20, tag: '', deaths: 12 }), 'ghost')
    assert.equal(matchMood({ win: false, score: 35, tag: '', deaths: 4 }), 'snoozy')
  })

  test('a streak counts the newest results alike', ({ assert }) => {
    assert.equal(streakOf([]), 0)
    assert.equal(streakOf([true, true, false, true]), 2)
    assert.equal(streakOf([false, false, false]), -3)
  })

  test('a title wraps on words and shrinks to fit its lines', ({ assert }) => {
    const one = title([['Look up any League player', '#fff']], 0, 0, 2000, { max: 100, min: 50 })
    assert.equal(one.lines, 1)
    assert.equal(one.size, 100)
    const two = title([['Look up any League player', '#fff']], 0, 0, 700, { max: 100, min: 50 })
    assert.equal(two.lines, 2)
    // A letter the faces lack is left out, and said so.
    assert.isTrue(drawable('display', 'Mistwalker Ωmega'))
    assert.isFalse(drawable('display', '페이커'))
  })

  test('every card renders with art, and without', async ({ assert }) => {
    const art = await shareArt()
    const pic = await icon()
    for (const splash of [art, null]) {
      await isCard(
        assert,
        await profileCard({
          gameName: 'Moonfern',
          tagLine: 'EUW',
          region: 'EUW',
          icon: splash && pic,
          splash,
          rank: { tier: 'DIAMOND', division: 'II', lp: 64 },
          emblem: splash && pic,
          games: 20,
          winRate: 0.6,
          streak: 2,
        })
      )
      await isCard(
        assert,
        await championCard({
          name: 'LeBlanc',
          role: 'mid',
          roleLabel: 'Mid',
          patch: '26.22',
          bracket: 'Emerald+',
          tier: 1,
          rank: 4,
          ranked: 60,
          winRate: 0.523,
          games: 12000,
          splash,
        })
      )
      await isCard(
        assert,
        await tierListCard({
          title: [
            ['Mid', '#8f84ff'],
            ['tier list', '#fff'],
          ],
          sub: 'Patch 26.22, Emerald+',
          kind: 'tall',
          tiles: [{ art: splash, tier: 0, winRate: 0.54, role: 'mid' }],
          splash,
          mood: 'snax',
          source: 'The best five of 60',
        })
      )
      await isCard(
        assert,
        await figureCard({
          title: [['Early game', '#fff']],
          sub: 'Patch 26.22, Emerald+',
          value: '+412',
          unit: '',
          caption: 'Gold ahead at 10 minutes',
          splash,
          mood: 'cheeky',
        })
      )
      await isCard(
        assert,
        await homeCard({
          patch: '26.22',
          games: 4_290_000,
          splash,
          picks: [{ art: splash, role: 'top' }],
        })
      )
      await isCard(
        assert,
        await patchCard({
          patch: '26.22',
          published: 'November 3, 2026',
          buffs: [{ art: pic }],
          nerfs: [],
          splash,
        })
      )
      await isCard(assert, await appCard({ version: '0.3.8', shot: splash }))
      await isCard(
        assert,
        await proCard({
          name: 'Moonfern',
          team: { name: 'Example Esports', logo: splash && pic },
          role: 'mid',
          roleLabel: 'Mid',
          photo: splash && pic,
          rank: { tier: 'CHALLENGER', division: null, lp: 1500, platform: 'EUW1' },
          emblem: splash && pic,
          league: 'LEC',
        })
      )
      await isCard(
        assert,
        await teamCard({
          name: 'Example Esports',
          league: 'LEC',
          region: 'EUW',
          logo: splash && pic,
          roster: [{ name: 'Moonfern', role: 'mid', photo: splash && pic }],
          place: { place: 2, of: 10 },
        })
      )
      await isCard(
        assert,
        await prosCard({
          title: [
            ['Pro', '#8f84ff'],
            ['players', '#fff'],
          ],
          sub: '10 players',
          pros: [
            { name: 'Moonfern', photo: splash && pic, lp: 1500, tier: 'CHALLENGER', team: null },
          ],
          source: '10 in Master and above',
        })
      )
      await isCard(
        assert,
        await esportsCard({
          match: null,
          leagues: [{ code: 'LEC', logo: splash && pic }],
          pros: 10,
        })
      )
      await isCard(
        assert,
        await ladderCard({
          title: [
            ['EUW', '#8f84ff'],
            ['ladder', '#fff'],
          ],
          sub: 'Solo/Duo',
          leader: {
            name: 'Moonfern',
            tag: 'EUW',
            icon: splash && pic,
            tier: 'CHALLENGER',
            division: null,
            lp: 1500,
            splash,
            note: null,
          },
          emblem: splash && pic,
          mood: 'bouncer',
          source: 'Ranked by LP',
        })
      )
      await isCard(
        assert,
        await matchCard({
          gameName: 'Moonfern',
          champion: 'LeBlanc',
          win: false,
          queue: 'Ranked Solo',
          duration: 1722,
          kills: 3,
          deaths: 11,
          assists: 4,
          score: 22,
          tag: '',
          splash,
          icon: splash && pic,
        })
      )
      await isCard(
        assert,
        await masteryCard(
          { gameName: 'Moonfern', tagLine: 'EUW' },
          [7, 1, 2, 3].map((id, i) => ({
            championId: id,
            championPoints: 400_000 / (i + 1),
            name: 'LeBlanc',
          })),
          async (kind) => (kind === 'splash' ? splash : splash && pic)
        )
      )
    }
  }).timeout(60_000)
})
