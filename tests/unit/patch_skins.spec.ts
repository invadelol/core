import { test } from '@japa/runner'
import { parseChampion } from '#services/riot/asset_paths'
import { chromaSet } from '../../inertia/lib/patch_notes.js'

test.group('Patch notes: skins and chromas', () => {
  test('a chroma line is its skin and the chromas’ own names', ({ assert }) => {
    assert.deepEqual(chromaSet('Music Fan Gragas (FIRESTARTER)'), {
      skin: 'Music Fan Gragas',
      names: ['FIRESTARTER'],
    })
    assert.deepEqual(chromaSet('HEARTSTEEL Live My Life Kayn (Ruby, Rose Quartz, Catseye)'), {
      skin: 'HEARTSTEEL Live My Life Kayn',
      names: ['Ruby', 'Rose Quartz', 'Catseye'],
    })
    assert.deepEqual(chromaSet('Some skin'), { skin: 'Some skin', names: [] })
  })

  test('a champion file keeps each skin’s rarity, lines and chromas', ({ assert }) => {
    const art = parseChampion({
      skins: [
        { id: 103000, isBase: true, splashPath: '/base.jpg', rarity: 'kNoRarity' },
        {
          id: 103097,
          name: 'K/DA FIRESTARTER Ahri',
          splashPath: '/kda.jpg',
          rarity: 'kEpic',
          skinLines: [{ id: 91 }],
          chromas: [
            { name: 'K/DA FIRESTARTER Ahri (Ruby)', colors: ['#D33528', '#D33528'] },
            { name: 'K/DA FIRESTARTER Ahri (Odd)', colors: ['red'] },
          ],
        },
      ],
    })
    const [base, kda] = art!.skins!
    assert.notProperty(base, 'rarity')
    assert.notProperty(base, 'chromas')
    assert.equal(kda.rarity, 'kEpic')
    assert.deepEqual(kda.lines, [91])
    assert.deepEqual(kda.chromas, [
      { name: 'K/DA FIRESTARTER Ahri (Ruby)', colors: ['#D33528', '#D33528'] },
      { name: 'K/DA FIRESTARTER Ahri (Odd)', colors: [] },
    ])
  })
})
