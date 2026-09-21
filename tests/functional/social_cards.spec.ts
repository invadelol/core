import { test } from '@japa/runner'
import summonerService from '#services/summoner_service'

test.group('Social cards', (group) => {
  const stored = summonerService.findStoredProfile
  const stats = summonerService.getStats
  const champions = summonerService.getChampionStats
  group.each.teardown(() => {
    summonerService.findStoredProfile = stored
    summonerService.getStats = stats
    summonerService.getChampionStats = champions
  })

  test('profile HTML includes social metadata without client JavaScript', async ({ client }) => {
    summonerService.findStoredProfile = (async () => ({
      puuid: 'og-test',
      gameName: 'A & B',
      tagLine: '727',
      platform: 'EUW1',
      profileIconId: null,
      summonerLevel: null,
    })) as typeof stored
    const page = await client.get('/A%20%26%20B-727')
    page.assertStatus(200)
    page.assertTextIncludes('property="og:image" content="https://invade.lol/og/A%20%26%20B-727"')
    page.assertTextIncludes('name="twitter:card" content="summary_large_image"')
  })

  test('unknown profiles do not get a fabricated social image', async ({ client }) => {
    summonerService.findStoredProfile = async () => null
    const image = await client.get('/og/Unknown-player')
    image.assertStatus(404)
  })

  test('concurrent image requests share rendering and successful cards are cached', async ({
    client,
    assert,
  }) => {
    summonerService.findStoredProfile = async () => ({
      puuid: 'og-cached',
      gameName: 'Cached',
      tagLine: '727',
      platform: 'EUW1',
      profileIconId: null,
      summonerLevel: null,
    })
    let reads = 0
    summonerService.getStats = async () => {
      reads++
      return {
        global: {
          total: 0,
          winrate: 0,
          kda: 0,
          csMin: 0,
          visionMin: 0,
          goldPerMinute: 0,
          damagePerMinute: 0,
          killParticipation: 0,
          damageShare: 0,
          goldShare: 0,
        },
        champions: [],
      }
    }
    summonerService.getChampionStats = async () => []
    const images = await Promise.all([client.get('/og/Cached-727'), client.get('/og/Cached-727')])
    for (const image of images) {
      image.assertStatus(200)
      image.assertHeader('content-type', 'image/png')
      image.assertHeader('cache-control', 'public, max-age=300')
    }
    const cached = await client.get('/og/Cached-727')
    cached.assertStatus(200)
    assert.equal(reads, 1)
  })

  test('analytics outages return an uncached readable PNG', async ({ client }) => {
    summonerService.findStoredProfile = (async () => ({
      puuid: 'og-fallback',
      gameName: 'Player',
      tagLine: '727',
      platform: 'EUW1',
      profileIconId: null,
      summonerLevel: null,
    })) as typeof stored
    summonerService.getStats = async () => {
      throw new Error('offline')
    }
    summonerService.getChampionStats = async () => {
      throw new Error('offline')
    }
    const image = await client.get('/og/Player-727')
    image.assertStatus(200)
    image.assertHeader('content-type', 'image/png')
    image.assertHeader('cache-control', 'no-store')
  })
})
