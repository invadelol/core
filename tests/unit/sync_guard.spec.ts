import { test } from '@japa/runner'
import { SyncGuard } from '#utils/sync_guard'
import { RiotUpstreamException } from '#utils/riot_errors'

test.group('Sync guard', () => {
  test('shares synchronous failures and releases the failed operation', async ({ assert }) => {
    const guard = new SyncGuard()
    let calls = 0
    const task = () => {
      calls++
      throw new Error('failed')
    }
    const results = await Promise.allSettled([guard.run('player', task), guard.run('player', task)])
    assert.isTrue(results.every((result) => result.status === 'rejected'))
    assert.equal(calls, 1)
    assert.equal(await guard.run('player', async () => 'recovered'), 'recovered')
  })

  test('cooldown expires and does not block another player', async ({ assert }) => {
    const now = Date.now
    let time = now()
    Date.now = () => time
    try {
      const guard = new SyncGuard()
      await assert.rejects(() =>
        guard.run('player', async () => {
          throw new RiotUpstreamException('Limited', 'E_RIOT_RATE_LIMITED', 429, 10)
        })
      )
      let calls = 0
      const task = async () => ++calls
      await assert.rejects(() => guard.run('player', task))
      assert.equal(calls, 0)
      assert.equal(await guard.run('other-player', task), 1)
      time += 10_001
      assert.equal(await guard.run('player', task), 2)
    } finally {
      Date.now = now
    }
  })
})
