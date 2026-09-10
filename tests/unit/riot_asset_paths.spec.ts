import { test } from '@japa/runner'

import {
  fallbackSources,
  gameDataUrl,
  initials,
  parseManifest,
  placeholderSvg,
  rankSources,
} from '#services/riot/asset_paths'
import { ASSET_KINDS, CDRAGON_GAME_DATA } from '#constants/assets'

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

  test('every kind resolves to at least one candidate url', ({ assert }) => {
    for (const kind of ASSET_KINDS) {
      const sources = kind === 'rank' ? rankSources('emerald') : fallbackSources(kind, '1')
      assert.isAbove(sources.length, 0, `${kind} has no fallback source`)
    }
  })

  test('rank crests normalise the tier', ({ assert }) => {
    assert.isTrue(rankSources('EMERALD')[0].endsWith('emerald.svg'))
    assert.isTrue(rankSources(' Emerald ')[0].endsWith('emerald.svg'))
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
