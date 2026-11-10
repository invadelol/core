import { test } from '@japa/runner'
import { DesktopException } from '#exceptions/desktop_exception'
import {
  forceSwitches,
  observedEnabled,
  playersEnabled,
  uploadsEnabled,
} from '#services/desktop/switches'

/** Core takes no League client data unless the environment switches it on. */
test.group('Desktop switches', (group) => {
  group.each.teardown(() => forceSwitches({}))

  test('uploads, observed games and player snapshots are off without the environment', ({
    assert,
  }) => {
    assert.isFalse(uploadsEnabled())
    assert.isFalse(observedEnabled())
    assert.isFalse(playersEnabled())
  })

  test('observed games need uploads on too', ({ assert }) => {
    forceSwitches({ observed: true })
    assert.isFalse(observedEnabled())
    forceSwitches({ uploads: true, observed: true })
    assert.isTrue(observedEnabled())
  })

  test('player snapshots have their own switch, and need uploads on too', ({ assert }) => {
    forceSwitches({ players: true })
    assert.isFalse(playersEnabled())
    forceSwitches({ uploads: true })
    assert.isTrue(uploadsEnabled())
    assert.isFalse(playersEnabled(), 'own games on alone leave player snapshots off')
    assert.isFalse(observedEnabled())
    forceSwitches({ uploads: true, players: true })
    assert.isTrue(playersEnabled())
  })

  test('a paused upload asks the app to wait 6 hours, a paused lookup 30 minutes', ({ assert }) => {
    assert.equal(DesktopException.paused('uploads').retryAfter, 6 * 3600)
    assert.equal(DesktopException.paused('resolve').retryAfter, 1800)
  })
})
