import { test } from '@japa/runner'
import { publicError } from '#exceptions/handler'

test.group('Error page', () => {
  test('says the message of an authored exception, with its status', ({ assert }) => {
    const error = { status: 503, code: 'E_UNAVAILABLE', message: 'Down for maintenance' }
    assert.deepEqual(publicError(error), { status: 503, message: 'Down for maintenance' })
  })

  test('keeps anything else, and every stack, on the server', ({ assert }) => {
    const crash = Object.assign(
      new TypeError("Cannot read properties of undefined (reading 'x')"),
      {
        stack: 'TypeError: at handler.ts:1',
      }
    )
    assert.deepEqual(publicError(crash), { status: 500, message: null })
    const driver = {
      status: 500,
      code: '23505',
      message: 'duplicate key value violates unique constraint',
    }
    assert.deepEqual(publicError(driver), { status: 500, message: null })
  })
})
