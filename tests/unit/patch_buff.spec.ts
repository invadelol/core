import { test } from '@japa/runner'
import { biggestBuff, type ChampionNote } from '../../inertia/lib/patch_notes.js'

const champion = (
  id: number,
  kind: ChampionNote['kind'],
  lines: ChampionNote['blocks'][0]['lines']
) =>
  ({ id, name: `Champion ${id}`, kind, blocks: [{ key: 'Q', title: 'Q', lines }] }) as ChampionNote

test.group('Patch notes: the biggest buff', () => {
  test('is the buffed champion whose numbers moved the most', ({ assert }) => {
    const notes = {
      champions: [
        // Many small lines.
        champion(1, 'up', [
          { label: 'Damage', old: '100 / 150 / 200', new: '105 / 155 / 205' },
          { label: 'Mana', old: '50', new: '48' },
        ]),
        // One large line: the heal doubled.
        champion(2, 'up', [{ label: 'Heal', old: '10 / 15 / 20', new: '20 / 30 / 40' }]),
        // Larger still, but a nerf.
        champion(3, 'down', [{ label: 'Damage', old: '100', new: '10' }]),
        // Adjusted, not buffed.
        champion(4, 'mix', [{ label: 'Damage', old: '10', new: '40' }]),
      ],
    }
    assert.deepEqual(biggestBuff(notes), { id: 2, name: 'Champion 2' })
  })

  test('counts a nerf line inside a buff against it, and a value become a list', ({ assert }) => {
    const notes = {
      champions: [
        champion(1, 'up', [
          { label: 'Damage', old: '100', new: '150' },
          { label: 'Cooldown', old: '10', new: '14', dir: 'down' },
        ]),
        champion(2, 'up', [{ label: 'Ratio', old: '60% AP', new: '60 / 65 / 70 / 75 / 80% AP' }]),
      ],
    }
    assert.deepEqual(biggestBuff(notes), { id: 2, name: 'Champion 2' })
    assert.isNull(biggestBuff({ champions: [champion(5, 'down', [])] }))
  })
})
