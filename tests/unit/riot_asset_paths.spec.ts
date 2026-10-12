import { test } from '@japa/runner'

import {
  LATEST,
  cacheControl,
  championSources,
  contentTypeOf,
  emblemSources,
  fallbackSources,
  gameData,
  gameDataUrl,
  initials,
  parseAssetRequest,
  parseChampion,
  parseManifest,
  placeholderSvg,
  rankSources,
  recentReleases,
} from '#services/riot/asset_paths'
import { ASSET_KINDS, CDRAGON, DDRAGON, PINNED_PATCHES } from '#constants/assets'

const CDRAGON_GAME_DATA = gameData(LATEST)
const PATCH_16_20 = { cdragon: '16.20', ddragon: '16.20.1' }

test.group('Riot asset paths', () => {
  test('strips the lol-game-data prefix and lowercases the rest', ({ assert }) => {
    assert.equal(
      gameDataUrl('/lol-game-data/assets/ASSETS/Characters/Aatrox/HUD/Aatrox_Square.png'),
      `${CDRAGON_GAME_DATA}/assets/characters/aatrox/hud/aatrox_square.png`
    )
    assert.equal(
      gameDataUrl('/lol-game-data/assets/v1/champion-icons/266.png'),
      `${CDRAGON_GAME_DATA}/v1/champion-icons/266.png`
    )
  })

  test('parses champion-summary and drops the -1 sentinel', ({ assert }) => {
    const manifest = parseManifest('champion', [
      {
        id: -1,
        name: 'None',
        squarePortraitPath: '/lol-game-data/assets/v1/champion-icons/-1.png',
      },
      {
        id: 266,
        name: 'Aatrox',
        alias: 'Aatrox',
        squarePortraitPath: '/lol-game-data/assets/v1/champion-icons/266.png',
      },
    ])

    assert.deepEqual(Object.keys(manifest), ['266'])
    assert.equal(manifest['266'].name, 'Aatrox')
    assert.equal(manifest['266'].sources[0], `${CDRAGON_GAME_DATA}/v1/champion-icons/266.png`)
  })

  test('parses items and keeps a second source behind the first', ({ assert }) => {
    const manifest = parseManifest('item', [
      {
        id: 3153,
        name: 'Blade of The Ruined King',
        iconPath:
          '/lol-game-data/assets/ASSETS/Items/Icons2D/3153_Class_T3_BladeOfTheRuinedKing.png',
      },
    ])

    assert.equal(manifest['3153'].name, 'Blade of The Ruined King')
    assert.equal(
      manifest['3153'].sources[0],
      `${CDRAGON_GAME_DATA}/assets/items/icons2d/3153_class_t3_bladeoftheruinedking.png`
    )
    assert.isAbove(manifest['3153'].sources.length, 1)
  })

  test('resolves unique wrapped item IDs without replacing real items', ({ assert }) => {
    const item = (id: number) => ({
      id,
      name: String(id),
      iconPath: '/lol-game-data/assets/item.png',
    })
    const manifest = parseManifest('item', [item(70000), item(3153), item(68689), item(65536)])
    assert.equal(manifest['4464'].name, '70000')
    assert.equal(manifest['3153'].name, '3153')
    assert.notProperty(manifest, '0')
  })

  test('does not guess when two item IDs wrap to the same ID', ({ assert }) => {
    const item = (id: number) => ({
      id,
      name: String(id),
      iconPath: '/lol-game-data/assets/item.png',
    })
    const manifest = parseManifest('item', [item(70000), item(135536)])
    assert.notProperty(manifest, '4464')
    assert.property(manifest, '70000')
    assert.property(manifest, '135536')
  })

  test('parses summoner spells', ({ assert }) => {
    const manifest = parseManifest('spell', [
      {
        id: 4,
        name: 'Flash',
        iconPath: '/lol-game-data/assets/DATA/Spells/Icons2D/SummonerFlash.png',
      },
    ])

    assert.equal(
      manifest['4'].sources[0],
      `${CDRAGON_GAME_DATA}/data/spells/icons2d/summonerflash.png`
    )
  })

  test('parses perkstyles from their nested shape', ({ assert }) => {
    const manifest = parseManifest('perkstyle', {
      styles: [
        {
          id: 8000,
          name: 'Precision',
          iconPath: '/lol-game-data/assets/v1/perk-images/Styles/7201_Precision.png',
        },
      ],
    })

    assert.equal(manifest['8000'].name, 'Precision')
    assert.equal(
      manifest['8000'].sources[0],
      `${CDRAGON_GAME_DATA}/v1/perk-images/styles/7201_precision.png`
    )
  })

  test('survives a malformed manifest', ({ assert }) => {
    assert.deepEqual(parseManifest('item', null), {})
    assert.deepEqual(parseManifest('item', { nope: 1 }), {})
    assert.deepEqual(parseManifest('item', [{}, { id: '' }]), {})
  })

  test('every kind but augments resolves to at least one candidate url', ({ assert }) => {
    const ids: Record<string, string> = { rank: 'emerald', emblem: 'emerald', ability: '266-q' }
    for (const kind of ASSET_KINDS.filter((k) => k !== 'augment')) {
      const sources = fallbackSources(kind, ids[kind] ?? '1')
      assert.isAbove(sources.length, 0, `${kind} has no fallback source`)
    }
  })

  test('rank crests and emblems resolve by tier', ({ assert }) => {
    assert.isTrue(rankSources('emerald')[0].endsWith('/ranked-mini-crests/emerald.svg'))
    assert.deepEqual(emblemSources('emerald'), [rankSources('emerald')[1]])
  })

  test('a pinned release reads its own patch directory, then Data Dragon', ({ assert }) => {
    const manifest = parseManifest(
      'champion',
      [
        {
          id: 266,
          alias: 'Aatrox',
          squarePortraitPath: '/lol-game-data/assets/v1/champion-icons/266.png',
        },
      ],
      PATCH_16_20
    )
    assert.deepEqual(manifest['266'].sources.slice(0, 2), [
      `${CDRAGON}/16.20/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/266.png`,
      `${DDRAGON}/cdn/16.20.1/img/champion/Aatrox.png`,
    ])
    assert.include(
      fallbackSources('item', '3153', PATCH_16_20),
      `${DDRAGON}/cdn/16.20.1/img/item/3153.png`
    )
    assert.isTrue(emblemSources('gold', PATCH_16_20)[0].startsWith(`${CDRAGON}/16.20/`))
  })

  test('rune art falls back to Data Dragon with its original case', ({ assert }) => {
    const manifest = parseManifest('perk', [
      {
        id: 8005,
        iconPath:
          '/lol-game-data/assets/v1/perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png',
      },
    ])
    assert.equal(
      manifest['8005'].sources[1],
      `${DDRAGON}/cdn/img/perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png`
    )
  })

  test('augments resolve through their small icon', ({ assert }) => {
    const manifest = parseManifest('augment', [
      {
        id: 1,
        nameTRA: 'Typhoon',
        augmentSmallIconPath:
          '/lol-game-data/assets/ASSETS/UX/Cherry/Augments/Icons/Typhoon_small.png',
      },
    ])
    assert.equal(manifest['1'].name, 'Typhoon')
    assert.equal(
      manifest['1'].sources[0],
      `${CDRAGON_GAME_DATA}/assets/ux/cherry/augments/icons/typhoon_small.png`
    )
  })

  test('champion art: splash, centred crop, loading screen and abilities', ({ assert }) => {
    const art = parseChampion({
      alias: 'Aatrox',
      passive: {
        abilityIconPath:
          '/lol-game-data/assets/ASSETS/Characters/Aatrox/HUD/Icons2D/Aatrox_Passive.png',
      },
      spells: [
        {
          spellKey: 'q',
          abilityIconPath:
            '/lol-game-data/assets/ASSETS/Characters/Aatrox/HUD/Icons2D/Aatrox_Q1.png',
        },
      ],
      skins: [
        { isBase: false, splashPath: '/x.jpg' },
        {
          isBase: true,
          splashPath: '/lol-game-data/assets/v1/champion-splashes/266/266000.jpg',
          uncenteredSplashPath:
            '/lol-game-data/assets/v1/champion-splashes/uncentered/266/266000.jpg',
          loadScreenPath:
            '/lol-game-data/assets/ASSETS/Characters/Aatrox/Skins/Base/AatroxLoadScreen.jpg',
        },
      ],
    })

    const splash = championSources('splash', '266', art, PATCH_16_20)
    assert.equal(
      splash[0],
      `${gameData(PATCH_16_20)}/v1/champion-splashes/uncentered/266/266000.jpg`
    )
    assert.equal(splash[1], `${DDRAGON}/cdn/img/champion/splash/Aatrox_0.jpg`)
    assert.equal(
      championSources('centered', '266', art)[0],
      `${CDRAGON_GAME_DATA}/v1/champion-splashes/266/266000.jpg`
    )
    assert.include(championSources('loading', '266', art)[0], 'aatroxloadscreen.jpg')
    assert.include(championSources('ability', '266-p', art)[0], 'aatrox_passive.png')
    assert.include(championSources('ability', '266-q', art)[0], 'aatrox_q1.png')
    // No file, or no icon for the slot: Community Dragon's CDN still knows the champion.
    assert.deepEqual(championSources('ability', '266-r', art), [
      'https://cdn.communitydragon.org/latest/champion/266/ability-icon/r',
    ])
    assert.isNull(parseChampion(null))
  })

  test('an unknown profile icon falls back to the generic portrait', ({ assert }) => {
    const sources = fallbackSources('profile-icon', '999999')
    assert.isTrue(sources.some((url) => url.endsWith('/29.jpg')))
  })

  test('initials read sensibly', ({ assert }) => {
    assert.equal(initials('Aurelion Sol'), 'AS')
    assert.equal(initials('Ahri'), 'AH')
    assert.equal(initials("Kai'Sa"), 'KS')
    assert.equal(initials('3153'), '153')
    assert.equal(initials(''), '?')
  })
})

test.group('Riot asset requests', () => {
  test('accepts only allowed kinds, exact id shapes and patches', ({ assert }) => {
    assert.deepEqual(parseAssetRequest('champion', '266.png'), { kind: 'champion', id: '266' })
    assert.deepEqual(parseAssetRequest('item', '3153.png', '16.20'), {
      kind: 'item',
      id: '3153',
      patch: '16.20',
    })
    assert.deepEqual(parseAssetRequest('emblem', 'GOLD.png'), { kind: 'emblem', id: 'gold' })
    assert.deepEqual(parseAssetRequest('ability', '266-Q.png'), { kind: 'ability', id: '266-q' })

    const refused: [unknown, unknown, unknown?][] = [
      ['unknown', '1'],
      ['__proto__', '1'],
      ['constructor', '1'],
      ['champion', 'Aatrox'],
      ['champion', '266.exe'],
      ['champion', '../../etc/passwd'],
      ['champion', 'https://evil.example/x.png'],
      ['champion', '12345678'],
      ['rank', 'wood'],
      ['ability', '266-x'],
      ['ability', '266'],
      ['champion', '266', '16.20.1'],
      ['champion', '266', 'latest'],
      ['champion', '266', '../16'],
    ]
    for (const [kind, id, patch] of refused) {
      assert.isNull(parseAssetRequest(kind, id, patch), `${kind}/${id}@${patch}`)
    }
  })

  test('pins only the most recent patches, keyed by major.minor', ({ assert }) => {
    const versions = [
      '16.20.1',
      '16.19.2',
      '16.19.1',
      ...Array.from({ length: 20 }, (_, i) => `15.${i}.1`),
      'lolpatch_3.7',
    ]
    const releases = recentReleases(versions)
    assert.lengthOf(releases, PINNED_PATCHES)
    assert.deepEqual(releases[0], { cdragon: '16.20', ddragon: '16.20.1' })
    assert.deepEqual(releases[1], { cdragon: '16.19', ddragon: '16.19.2' })
    assert.deepEqual(recentReleases(null), [])
    assert.deepEqual(recentReleases({ nope: 1 }), [])
  })

  test('cache lifetimes: forever when pinned, a day when live, a minute for placeholders', ({
    assert,
  }) => {
    assert.equal(
      cacheControl({ placeholder: false, pinned: true }),
      'public, max-age=31536000, immutable'
    )
    assert.equal(
      cacheControl({ placeholder: false, pinned: false }),
      'public, max-age=86400, stale-while-revalidate=604800'
    )
    assert.equal(cacheControl({ placeholder: true, pinned: true }), 'public, max-age=60')
  })

  test('only ever serves an image type', ({ assert }) => {
    assert.equal(contentTypeOf('image/jpeg; charset=binary', 'x'), 'image/jpeg')
    assert.equal(contentTypeOf('text/html', 'https://x/a.svg'), 'image/svg+xml')
    assert.equal(contentTypeOf(null, 'https://x/a'), 'image/png')
  })
})

test.group('Riot asset placeholder', () => {
  test('always draws a visible, deterministic tile', ({ assert }) => {
    const svg = placeholderSvg('champion', '266')

    assert.equal(svg, placeholderSvg('champion', '266'))
    assert.isTrue(svg.startsWith('<svg'))
    assert.include(svg, '<rect')
    assert.include(svg, '</text>')
    assert.notEqual(placeholderSvg('champion', '1'), placeholderSvg('champion', '99'))
  })

  test('escapes hostile ids', ({ assert }) => {
    const svg = placeholderSvg('item', '"><script>alert(1)</script>')

    assert.notInclude(svg, '<script>')
    assert.notInclude(svg, '"><')
  })
})
