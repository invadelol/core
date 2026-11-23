import { test } from '@japa/runner'
import {
  effectiveSettings,
  orderedShowcases,
  parseSettings,
  settingsFromRow,
} from '#services/profiles/profile_settings'
import { avatarUrl } from '#services/profiles/people'
import { parseSkins } from '#services/skins/skin_catalogue'
import { fakeCatalogue, SKINS } from '#tests/fixtures/profiles'
import { DEFAULT_SHOWCASES, SHOWCASES } from '../../inertia/lib/invade_profile.js'
import { overviewColumns, previewHead } from '../../inertia/lib/profile_view.js'
import { ordinal, shortCount, starsWords } from '../../inertia/lib/skins.js'

/** The promise is refused with a message matching `message`. */
async function refused(work: Promise<unknown>, message: RegExp) {
  try {
    await work
  } catch (error) {
    if (!message.test((error as Error).message)) throw error
    return
  }
  throw new Error(`expected a refusal matching ${message}`)
}

const context = { premium: false, owned: new Set<number>(), known: () => true }
const valid = () => ({
  bio: '',
  links: [],
  backdrop: null,
  avatar: 'backdrop',
  accent: 'violet',
  frame: false,
  showcases: DEFAULT_SHOWCASES,
  favorites: [],
})

test.group('Invade profile settings', () => {
  test('showcases keep the owner order, drop unknown keys and add new ones off', ({ assert }) => {
    const order = orderedShowcases([
      { key: 'season', on: true },
      { key: 'gone', on: true },
      { key: 'pinned', on: false },
      { key: 'season', on: false },
    ])
    assert.deepEqual(order.slice(0, 2), [
      { key: 'season', on: true },
      { key: 'pinned', on: false },
    ])
    assert.lengthOf(order, SHOWCASES.length)
    assert.isTrue(order.slice(2).every((s) => !s.on))
    assert.deepEqual(orderedShowcases(null), DEFAULT_SHOWCASES)
  })

  test('a stored row is read defensively', ({ assert }) => {
    const settings = settingsFromRow({
      bio: 'hi',
      links: [
        { kind: 'x', handle: 'ok_name' },
        { kind: 'myspace', handle: 'x' },
        { kind: 'x', handle: 'bad name' },
      ],
      backdrop_skin: 81033,
      avatar: 'weird',
      accent: 'neon',
      frame: true,
      showcases: 'nope',
      favorite_skins: [1, 2, 3, 4, 5],
    })
    assert.deepEqual(settings.links, [{ kind: 'x', handle: 'ok_name' }])
    assert.equal(settings.avatar, 'backdrop')
    assert.equal(settings.accent, 'violet')
    assert.lengthOf(settings.favorites, 4)
    assert.deepEqual(settingsFromRow(null).showcases, DEFAULT_SHOWCASES)
  })

  test('without Invade+ the page shows the free choices only', ({ assert }) => {
    const stored = {
      ...settingsFromRow(null),
      accent: 'gold' as const,
      frame: true,
      showcases: DEFAULT_SHOWCASES.map((s) => ({ ...s, on: true })),
    }
    const free = effectiveSettings(stored, false)
    assert.equal(free.accent, 'violet')
    assert.isFalse(free.frame)
    assert.deepEqual(
      free.showcases.filter((s) => s.on).map((s) => s.key),
      ['pinned', 'favorites', 'signature', 'friends']
    )
    assert.strictEqual(effectiveSettings(stored, true), stored)
  })

  test('parsing cleans what it keeps and refuses the rest', async ({ assert }) => {
    const parsed = await parseSettings(
      {
        ...valid(),
        bio: ' a\n\n b ',
        links: [
          { kind: 'youtube', handle: '@Channel.Name' },
          { kind: 'x', handle: '' },
        ],
      },
      context
    )
    assert.equal(parsed.bio, 'a b')
    assert.deepEqual(parsed.links, [{ kind: 'youtube', handle: 'Channel.Name' }])
    await refused(parseSettings({ ...valid(), avatar: 'photo' }, context), /could not be read/)
    await refused(parseSettings('nope', context), /could not be read/)
    await refused(
      parseSettings(
        {
          ...valid(),
          showcases: [
            { key: 'clips', on: true },
            { key: 'clips', on: false },
          ],
        },
        context
      ),
      /Each showcase once/
    )
    await refused(
      parseSettings({ ...valid(), favorites: [SKINS.kdaAhri] }, { ...context, known: () => false }),
      /four different skins/
    )
  })
})

test.group('Invade profile page', () => {
  test('the overview: the first of pinned clip and favourites leads the wide column', ({
    assert,
  }) => {
    assert.deepEqual(overviewColumns(['pinned', 'favorites', 'signature', 'clips', 'builds']), {
      wide: ['pinned', 'clips'],
      narrow: ['favorites', 'signature', 'builds'],
    })
    assert.deepEqual(overviewColumns(['favorites', 'friends', 'pinned', 'signature', 'season']), {
      wide: ['favorites', 'friends'],
      narrow: ['pinned', 'signature', 'season'],
    })
  })

  test('the preview draws the draft: an owned backdrop, its tile, the accent', ({ assert }) => {
    const head = {
      avatarUrl: '/cdn/profile-icon/1.png',
      pro: null,
    } as unknown as Parameters<typeof previewHead>[0]
    const customize = {
      settings: settingsFromRow(null),
      backdrops: [{ id: 81033, championId: 81, num: 33, name: 'Faerie Court Ezreal' }],
      fallbackChampion: 81,
      iconId: 4025,
    }
    const draft = { ...settingsFromRow(null), backdrop: 81033, accent: 'rose' as const }
    const preview = previewHead(head, draft, customize)
    assert.deepEqual(preview.backdrop, { url: '/cdn/splash/81-33.jpg', skin: 81033 })
    assert.equal(preview.avatarUrl, '/cdn/tile/81-33.jpg')
    assert.equal(preview.accent, 'rose')
    const icon = previewHead(head, { ...draft, avatar: 'icon' }, customize)
    assert.equal(icon.avatarUrl, '/cdn/profile-icon/4025.png')
    const unowned = previewHead(head, { ...draft, backdrop: 1 }, customize)
    assert.deepEqual(unowned.backdrop, { url: '/cdn/splash/81.jpg', skin: null })
  })

  test('an avatar is the backdrop tile, else the main icon, else nothing', ({ assert }) => {
    assert.equal(
      avatarUrl({ avatar: 'backdrop', backdropSkin: 103097, iconId: 7 }),
      '/cdn/tile/103-97.jpg'
    )
    assert.equal(
      avatarUrl({ avatar: 'icon', backdropSkin: 103097, iconId: 7 }),
      '/cdn/profile-icon/7.png'
    )
    assert.equal(
      avatarUrl({ avatar: 'backdrop', backdropSkin: null, iconId: 7 }),
      '/cdn/profile-icon/7.png'
    )
    assert.isNull(avatarUrl({ avatar: 'backdrop', backdropSkin: null, iconId: null }))
  })
})

test.group('Skins catalogue', () => {
  test("Community Dragon's file keeps champions' skins only, trimmed", ({ assert }) => {
    const skins = parseSkins({
      '103000': { id: 103000, isBase: true, name: 'Ahri', skinClassification: 'kChampion' },
      '103097': {
        id: 103097,
        name: ' K/DA FIRESTARTER Ahri ',
        skinClassification: 'kChampion',
        rarity: 'kEpic',
        isLegacy: false,
        skinLines: [{ id: 91 }, { id: 'x' }],
        chromas: [
          { name: 'K/DA FIRESTARTER Ahri (Ruby)', colors: ['#D33528', 'red'] },
          { name: '' },
        ],
        description: '  As K/DA founder  ',
      },
      '555000': { id: 555000, name: 'Pyke', skinClassification: 'kGeneric' },
      '60114301': { id: 60114301, name: 'Tier', skinClassification: 'kChampion' },
      '84102': {
        id: 84102,
        name: 'Ignition Akali',
        skinClassification: 'kChampion',
        rarity: 'kWeird',
      },
    })
    assert.deepEqual(skins, [
      {
        id: 84102,
        name: 'Ignition Akali',
        rarity: 'standard',
        legacy: false,
        lines: [],
        chromas: [],
        description: null,
      },
      {
        id: 103097,
        name: 'K/DA FIRESTARTER Ahri',
        rarity: 'epic',
        legacy: false,
        lines: [91],
        chromas: [{ name: 'K/DA FIRESTARTER Ahri (Ruby)', colors: ['#D33528'] }],
        description: 'As K/DA founder',
      },
    ])
    assert.isNull(parseSkins({}))
    assert.isNull(parseSkins('nope'))
  })

  test('search finds every word in a name, a champion or a line, best first', ({ assert }) => {
    const catalogue = fakeCatalogue()
    assert.deepEqual(
      catalogue.search('kda ahri', 10).map((s) => s.id),
      [SKINS.kdaAhri, SKINS.firestarterAhri]
    )
    assert.deepEqual(
      catalogue.search('faerie', 10).map((s) => s.id),
      [SKINS.faerieCourtEzreal]
    )
    assert.lengthOf(catalogue.search('   ', 10), 0)
    assert.deepEqual(
      catalogue.byLine
        .get(91)!
        .map((s) => s.id)
        .sort(),
      [SKINS.kdaAhri, SKINS.firestarterAhri, SKINS.kdaKaisa, SKINS.firestarterEvelynn].sort()
    )
  })

  test('words for stars, counts and places', ({ assert }) => {
    assert.equal(starsWords(7), '3.5 stars')
    assert.equal(starsWords(2), '1 star')
    assert.equal(shortCount(1204), '1.2k')
    assert.equal(shortCount(52_400), '52.4k')
    assert.equal(shortCount(184_600), '185k')
    assert.equal(shortCount(980), '980')
    assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 103].map(ordinal), [
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '103rd',
    ])
  })
})
