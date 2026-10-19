import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'
import HttpExceptionHandler, { desktopRefusal } from '#exceptions/handler'
import { DesktopException } from '#exceptions/desktop_exception'
import { uploadValidator } from '#validators/desktop'
import { trustedProxy } from '#utils/trusted_proxy'
import { makeUpload } from '#tests/fixtures/desktop'

function context(url: string, warnings: unknown[][]) {
  return {
    request: { method: () => 'POST', url: () => url },
    logger: { warn: (...args: unknown[]) => warnings.push(args) },
    desktopDevice: { id: 'device-1', app: '0.3.3' },
  } as unknown as HttpContext
}

async function validationError(body: unknown) {
  try {
    await uploadValidator.validate(body)
  } catch (error) {
    return error
  }
  throw new Error('expected a validation error')
}

test.group('Trusted proxy', () => {
  test('trusts loopback and private hops only', ({ assert }) => {
    for (const address of [
      '127.0.0.1',
      '10.0.1.7',
      '172.18.0.3',
      '192.168.1.2',
      '::1',
      '::ffff:10.0.1.7',
      'fd00::1',
    ]) {
      assert.isTrue(trustedProxy(address), address)
    }
    for (const address of [
      '54.37.156.111',
      '8.8.8.8',
      '172.32.0.1',
      '2001:db8::1',
      '::ffff:8.8.8.8',
      'nonsense',
    ]) {
      assert.isFalse(trustedProxy(address), address)
    }
  })
})

test.group('Upload shape', () => {
  test('a timeline without frameInterval passes, as the client sends it', async ({ assert }) => {
    const upload = makeUpload()
    const timeline = { ...upload.timeline! }
    delete timeline.frameInterval
    const valid = await uploadValidator.validate(
      JSON.parse(JSON.stringify({ ...upload, timeline }))
    )
    assert.isUndefined(valid.timeline?.frameInterval)
    assert.lengthOf(valid.timeline!.frames, timeline.frames.length)
  })
})

test.group('Refused desktop requests', () => {
  test('a shape error is logged with its fields and rules, never the values', async ({
    assert,
  }) => {
    const error = await validationError({
      schema: 1,
      matchId: 'EUW1_1',
      uploader: 'Secret Name#EUW',
    })
    const refusal = desktopRefusal(error, '/api/desktop/matches')!
    assert.equal(refusal.status, 422)
    assert.equal(refusal.code, 'E_VALIDATION_ERROR')
    assert.include(refusal.fields!, 'uploader: regex')
    assert.include(refusal.fields!, 'game: required')
    assert.notInclude(JSON.stringify(refusal), 'Secret Name')
  })

  test('a desktop exception keeps its code and reason; pauses are not logged', ({ assert }) => {
    assert.deepEqual(
      desktopRefusal(
        DesktopException.invalidMatch('queue 0 is not accepted'),
        '/api/desktop/matches'
      ),
      {
        status: 422,
        code: 'E_INVALID_MATCH',
        reason: 'Invalid match: queue 0 is not accepted',
      }
    )
    assert.equal(
      desktopRefusal(DesktopException.notLinked(), '/api/desktop/matches')?.code,
      'E_NOT_LINKED'
    )
    assert.isNull(desktopRefusal(DesktopException.rateLimited(60), '/api/desktop/matches'))
    assert.isNull(desktopRefusal(DesktopException.paused('uploads'), '/api/desktop/matches'))
    assert.isNull(desktopRefusal(new Error('boom'), '/api/desktop/matches'))
  })

  test('the handler writes one warning per refused desktop request', async ({ assert }) => {
    const handler = new HttpExceptionHandler()
    const warnings: unknown[][] = []
    await handler.report(DesktopException.notLinked(), context('/api/desktop/matches', warnings))
    await handler.report(
      DesktopException.rateLimited(60),
      context('/api/desktop/matches', warnings)
    )
    assert.lengthOf(warnings, 1)
    const [fields, message] = warnings[0] as [Record<string, unknown>, string]
    assert.equal(message, 'desktop request refused: E_NOT_LINKED')
    assert.equal(fields.route, 'POST /api/desktop/matches')
    assert.equal(fields.device, 'device-1')
    assert.equal(fields.app, '0.3.3')
  })
})
