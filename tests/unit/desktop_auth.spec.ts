import { test } from '@japa/runner'
import { createHash } from 'node:crypto'
import { IncomingMessage } from 'node:http'
import { Socket } from 'node:net'
import testUtils from '@adonisjs/core/services/test_utils'
import DesktopAuthMiddleware from '#middleware/desktop_auth_middleware'
import deviceService from '#services/desktop/device_service'
import type DesktopDevice from '#models/desktop_device'
import {
  bearerToken,
  generateToken,
  hashAddress,
  hashToken,
  isToken,
} from '#services/desktop/tokens'
import { EMPTY_BODY_SHA256, generateSecret, signRequest } from '#services/desktop/signing'

const SECRET = generateSecret()

async function context(authorization?: string, signed = true) {
  const req = new IncomingMessage(new Socket())
  req.url = '/api/desktop/link'
  req.method = 'POST'
  if (authorization) req.headers.authorization = authorization
  if (signed) {
    // A fresh timestamp per context, so the replay cache never sees one twice.
    const timestamp = String(Date.now() + Math.floor(Math.random() * 1000))
    req.headers['x-invade-timestamp'] = timestamp
    req.headers['x-invade-signature'] = signRequest(SECRET, {
      timestamp,
      method: 'POST',
      path: '/api/desktop/link',
      bodyHash: EMPTY_BODY_SHA256,
    })
  }
  return testUtils.createHttpContext({ req })
}

test.group('Desktop device tokens', (group) => {
  group.tap((t) => t.tags(['@desktop']))
  test('are 32 random bytes, base64url, behind a recognisable prefix', ({ assert }) => {
    const token = generateToken()
    assert.match(token, /^inv_dev_[A-Za-z0-9_-]{43}$/)
    assert.equal(Buffer.from(token.slice(8), 'base64url').length, 32)
    assert.notEqual(generateToken(), token)
    assert.isTrue(isToken(token))
    assert.isFalse(isToken('inv_dev_short'))
  })

  test('only their SHA-256 is stored', ({ assert }) => {
    const token = generateToken()
    assert.equal(hashToken(token), createHash('sha256').update(token).digest('hex'))
    assert.lengthOf(hashToken(token), 64)
  })

  test('are read from a bearer header only when well formed', ({ assert }) => {
    const token = generateToken()
    assert.equal(bearerToken(`Bearer ${token}`), token)
    assert.equal(bearerToken(`bearer ${token}`), token)
    assert.isNull(bearerToken(token))
    assert.isNull(bearerToken('Bearer inv_dev_nope'))
    assert.isNull(bearerToken(undefined))
  })

  test('addresses are compared through a keyed hash, never kept', ({ assert }) => {
    assert.equal(hashAddress('203.0.113.7', 'k'), hashAddress('203.0.113.7', 'k'))
    assert.notEqual(hashAddress('203.0.113.7', 'k'), hashAddress('203.0.113.8', 'k'))
    assert.notInclude(hashAddress('203.0.113.7', 'k'), '203')
  })
})

test.group('Desktop auth middleware', (group) => {
  group.tap((t) => t.tags(['@desktop']))
  const authenticate = deviceService.authenticate
  const touch = deviceService.touch
  const secretOf = deviceService.secretOf
  group.each.setup(() => {
    deviceService.secretOf = () => SECRET
  })
  group.each.teardown(() => {
    deviceService.authenticate = authenticate
    deviceService.touch = touch
    deviceService.secretOf = secretOf
  })

  const device = { id: 'device-1', verifiedUploads: 0, mismatches: 0 } as DesktopDevice

  test('exposes the device behind a valid token and records it as seen', async ({ assert }) => {
    const token = generateToken()
    let looked: string | null = null
    let touched = false
    deviceService.authenticate = async (value) => {
      looked = value
      return device
    }
    deviceService.touch = async () => {
      touched = true
    }
    const ctx = await context(`Bearer ${token}`)
    let reached = false
    await new DesktopAuthMiddleware().handle(ctx, async () => {
      reached = true
    })
    assert.equal(looked, token)
    assert.isTrue(touched)
    assert.isTrue(reached)
    assert.strictEqual(ctx.desktopDevice, device)
  })

  test('answers 401 E_DEVICE_UNAUTHORIZED for a missing, malformed or revoked token', async ({
    assert,
  }) => {
    deviceService.authenticate = async () => null
    deviceService.touch = async () => assert.fail('a rejected token must not be touched')
    for (const header of [undefined, 'Bearer nope', `Bearer ${generateToken()}`]) {
      const ctx = await context(header)
      const error = await new DesktopAuthMiddleware()
        .handle(ctx, async () => assert.fail('reached'))
        .then(() => null)
        .catch((caught) => caught)
      assert.equal(error?.status, 401)
      assert.equal(error?.code, 'E_DEVICE_UNAUTHORIZED')
    }
  })

  test('optional auth lets anonymous requests through but not bad tokens', async ({ assert }) => {
    deviceService.authenticate = async () => null
    const anonymous = await context()
    let reached = false
    await new DesktopAuthMiddleware().handle(
      anonymous,
      async () => {
        reached = true
      },
      { optional: true }
    )
    assert.isTrue(reached)
    assert.isUndefined(anonymous.desktopDevice)

    const revoked = await context(`Bearer ${generateToken()}`)
    await assert.rejects(() =>
      new DesktopAuthMiddleware().handle(revoked, async () => {}, { optional: true })
    )
  })

  test('a valid token without a valid signature is refused', async ({ assert }) => {
    deviceService.authenticate = async () => device
    deviceService.touch = async () => assert.fail('an unsigned request must not be touched')
    const unsigned = await context(`Bearer ${generateToken()}`, false)
    const error = await new DesktopAuthMiddleware()
      .handle(unsigned, async () => assert.fail('reached'))
      .catch((caught) => caught)
    assert.equal(error?.code, 'E_BAD_SIGNATURE')

    // A device registered before signing has no secret: it must register again.
    deviceService.secretOf = () => null
    const legacy = await context(`Bearer ${generateToken()}`)
    const refused = await new DesktopAuthMiddleware()
      .handle(legacy, async () => assert.fail('reached'))
      .catch((caught) => caught)
    assert.equal(refused?.code, 'E_DEVICE_UNAUTHORIZED')
  })
})
