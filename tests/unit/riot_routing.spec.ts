import { test } from '@japa/runner'
import { resolvePlayer, type PlayerLookup } from '#services/riot/player_resolver'
import { normalizePlatform, platformCandidates, platformRegion } from '#services/riot/routing'
import { PLATFORMS } from '#constants/riot'

const details = { profileIconId: 1, summonerLevel: 42 }
const missing = () => {
  throw { status: 404 }
}

test.group('Automatic Riot routing', () => {
  test('maps every supported platform, including Oceania and merged SEA platforms', ({
    assert,
  }) => {
    for (const [region, platforms] of Object.entries(PLATFORMS)) {
      for (const platform of platforms) assert.equal(platformRegion(platform), region)
    }
    assert.equal(platformRegion('OC1'), 'sea')
    assert.equal(normalizePlatform('eune1'), 'EUN1')
    assert.equal(normalizePlatform('PH2'), 'SG2')
    assert.equal(normalizePlatform('TH2'), 'SG2')
    assert.throws(() => normalizePlatform('invalid'))
    assert.equal(platformCandidates('KR1')[0], 'KR')
  })

  for (const target of Object.values(PLATFORMS).flat()) {
    test(`finds ${target} with a custom tag and no region input`, async ({ assert }) => {
      const calls: string[] = []
      const result = await resolvePlayer(
        {
          account: async () => ({ puuid: 'player' }),
          summoner: async (platform) => {
            calls.push(platform)
            return platform === target ? details : missing()
          },
        },
        'Player',
        'custom'
      )
      assert.equal(result.platform, target)
      assert.equal(calls.at(-1), target)
      assert.equal(new Set(calls).size, calls.length)
    })
  }

  test('a region-looking tag is a hint, not a restriction', async ({ assert }) => {
    const calls: string[] = []
    const result = await resolvePlayer(
      {
        account: async () => ({ puuid: 'player' }),
        summoner: async (platform) => {
          calls.push(platform)
          return platform === 'KR' ? details : missing()
        },
      },
      'Player',
      'EUW',
      undefined,
      'NA1'
    )
    assert.equal(result.platform, 'KR')
    assert.deepEqual(calls.slice(0, 2), ['NA1', 'EUW1'])
  })

  test('account fallbacks never use the SEA match cluster', async ({ assert }) => {
    const calls: string[] = []
    const result = await resolvePlayer(
      {
        account: async (region) => {
          calls.push(region)
          return region === 'americas' ? { puuid: 'player' } : missing()
        },
        summoner: async () => details,
      },
      'Player',
      'OCE'
    )
    assert.deepEqual(calls, ['asia', 'europe', 'americas'])
    assert.equal(result.platform, 'OC1')
  })

  test('explicit platform remains supported and does not discover other platforms', async ({
    assert,
  }) => {
    const calls: string[] = []
    await assert.rejects(
      () =>
        resolvePlayer(
          {
            account: async () => ({ puuid: 'player' }),
            summoner: async (platform) => {
              calls.push(platform)
              return missing()
            },
          },
          'Player',
          'tag',
          'na'
        ),
      'No League of Legends profile found'
    )
    assert.deepEqual(calls, ['NA1'])
  })

  for (const status of [401, 403, 429, 500, 503]) {
    for (const endpoint of ['account', 'summoner'] as const) {
      test(`${endpoint} ${status} stops detection without reporting not found`, async ({
        assert,
      }) => {
        let calls = 0
        const error = { status }
        const lookup: PlayerLookup = {
          account: async () => ({ puuid: 'player' }),
          summoner: async () => details,
        }
        lookup[endpoint] = async () => {
          calls++
          throw error
        }
        try {
          await resolvePlayer(lookup, 'Player', 'tag')
          assert.fail('Expected upstream error')
        } catch (caught) {
          assert.strictEqual(caught, error)
        }
        assert.equal(calls, 1)
      })
    }
  }

  test('an unknown Riot ID never probes platforms', async ({ assert }) => {
    let calls = 0
    await assert.rejects(
      () =>
        resolvePlayer(
          {
            account: async () => missing(),
            summoner: async () => {
              calls++
              return details
            },
          },
          'Missing',
          'tag'
        ),
      'Summoner not found'
    )
    assert.equal(calls, 0)
  })
})
