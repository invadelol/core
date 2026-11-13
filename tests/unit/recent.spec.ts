import { test } from '@japa/runner'
import {
  forgetRecent,
  recentHref,
  recentPlayers,
  rememberChampion,
  rememberPlayer,
  rememberPro,
  updateRecent,
} from '../../inertia/lib/recent.js'

test.group('Recent searches', (group) => {
  group.each.setup(() => {
    const store = new Map<string, string>()
    const original = (globalThis as any).localStorage
    ;(globalThis as any).localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    }
    return () => {
      ;(globalThis as any).localStorage = original
    }
  })

  test('a pro page is listed with the players, newest first, once', ({ assert }) => {
    rememberPlayer({ gameName: 'Someone', tagLine: 'EUW', profileIconId: 29 })
    rememberPro({ slug: 'some-pro', name: 'Some Pro', photo: 'v3' })
    rememberPlayer({ gameName: 'Other', tagLine: 'NA1', profileIconId: 1 })
    rememberPro({ slug: 'some-pro', name: 'Some Pro', photo: 'v4' })

    const list = recentPlayers()
    assert.deepEqual(
      list.map((p) => recentHref(p)),
      [
        '/pro/some-pro',
        `/${encodeURIComponent('Other-NA1')}`,
        `/${encodeURIComponent('Someone-EUW')}`,
      ]
    )
    assert.equal(list[0].gameName, 'Some Pro')
    assert.deepEqual(list[0].pro, { slug: 'some-pro', photo: 'v4' })
  })

  test('a pro and a player of the same name stay apart', ({ assert }) => {
    rememberPro({ slug: 'name', name: 'Name' })
    rememberPlayer({ gameName: 'Name', tagLine: 'EUW', profileIconId: 1 })
    updateRecent({ gameName: 'Name', tagLine: 'EUW' }, { level: 30 })
    const [player, pro] = recentPlayers()
    assert.equal(player.level, 30)
    assert.isUndefined(player.pro)
    assert.equal(pro.pro?.slug, 'name')
    forgetRecent()
    assert.deepEqual(recentPlayers(), [])
  })

  test('a champion page is listed once, apart from a pro or player of its name', ({ assert }) => {
    rememberChampion({ id: 103, slug: 'ahri', name: 'Ahri' })
    rememberPro({ slug: 'ahri', name: 'Ahri' })
    rememberPlayer({ gameName: 'Ahri', tagLine: 'EUW', profileIconId: 1 })
    rememberChampion({ id: 103, slug: 'ahri', name: 'Ahri' })

    const list = recentPlayers()
    assert.deepEqual(
      list.map((p) => recentHref(p)),
      ['/champions/ahri', `/${encodeURIComponent('Ahri-EUW')}`, '/pro/ahri']
    )
    assert.deepEqual(list[0].champion, { id: 103, slug: 'ahri' })
  })
})
