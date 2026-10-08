import { test } from '@japa/runner'
import { createHmac } from 'node:crypto'
import { Writable } from 'node:stream'
import { pino } from 'pino'
import app from '@adonisjs/core/services/app'
import {
  EMPTY_BODY_SHA256,
  ReplayGuard,
  canonicalRequest,
  generateSecret,
  isSecret,
  sha256Hex,
  signRequest,
  verifySignature,
} from '#services/desktop/signing'

const NOW = Date.UTC(2026, 9, 8, 12)
const SECRET = generateSecret()

function input(overrides: Record<string, unknown> = {}) {
  const timestamp = String(NOW)
  const parts = {
    timestamp,
    method: 'POST',
    path: '/api/desktop/players',
    bodyHash: sha256Hex('{"schema":1}'),
  }
  return {
    secret: SECRET,
    timestamp,
    signature: signRequest(SECRET, parts),
    method: parts.method,
    path: parts.path,
    bodyHash: parts.bodyHash,
    now: NOW,
    ...overrides,
  }
}

test.group('Desktop request signing (§1.1)', (group) => {
  group.tap((t) => t.tags(['@desktop']))

  test('secrets are 32 random bytes in lowercase hex', ({ assert }) => {
    assert.match(SECRET, /^[0-9a-f]{64}$/)
    assert.isTrue(isSecret(SECRET))
    assert.notEqual(generateSecret(), SECRET)
    assert.isFalse(isSecret(SECRET.toUpperCase()))
  })

  test('signs the documented canonical string, keyed by the hex text of the secret', ({
    assert,
  }) => {
    const parts = {
      timestamp: '1791450000000',
      method: 'get',
      path: '/api/desktop/resolve?gameName=Louhi&tagLine=727',
      bodyHash: EMPTY_BODY_SHA256,
    }
    assert.equal(
      canonicalRequest(parts),
      'v1\n1791450000000\nGET\n/api/desktop/resolve?gameName=Louhi&tagLine=727\n' +
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    )
    // A fixed vector: the 64 hex characters are the key, as ASCII bytes.
    const secret = '0123456789abcdef'.repeat(4)
    assert.equal(
      signRequest(secret, parts),
      createHmac('sha256', secret).update(canonicalRequest(parts)).digest('hex')
    )
    assert.equal(
      signRequest(secret, parts),
      'a06a11671cd0e978b43430c9ad4a6d9eef9faa93d1e2a4cf78446006f204f770'
    )
    assert.notEqual(
      signRequest(secret, parts),
      createHmac('sha256', Buffer.from(secret, 'hex')).update(canonicalRequest(parts)).digest('hex')
    )
  })

  test('accepts a valid signature', ({ assert }) => {
    assert.equal(verifySignature(input()), 'ok')
  })

  test('refuses anything that was not signed as sent', ({ assert }) => {
    assert.equal(verifySignature(input({ bodyHash: sha256Hex('{"schema":2}') })), 'bad')
    assert.equal(verifySignature(input({ path: '/api/desktop/matches' })), 'bad')
    assert.equal(verifySignature(input({ method: 'DELETE' })), 'bad')
    assert.equal(verifySignature(input({ secret: generateSecret() })), 'bad')
    assert.equal(verifySignature(input({ signature: 'f'.repeat(64) })), 'bad')
    assert.equal(verifySignature(input({ signature: input().signature.toUpperCase() })), 'bad')
    assert.equal(verifySignature(input({ timestamp: '17914e9' })), 'bad')
    assert.equal(verifySignature(input({ signature: undefined })), 'missing')
    assert.equal(verifySignature(input({ timestamp: null })), 'missing')
  })

  test('a clock more than 5 minutes off is told so', ({ assert }) => {
    assert.equal(verifySignature(input({ now: NOW + 5 * 60_000 })), 'ok')
    assert.equal(verifySignature(input({ now: NOW + 5 * 60_000 + 1 })), 'skew')
    assert.equal(verifySignature(input({ now: NOW - 6 * 60_000 })), 'skew')
  })

  test('the replay guard accepts a signature once, for ten minutes', async ({ assert }) => {
    const seen = new Map<string, number>()
    const guard = new ReplayGuard('test:', {
      setIfAbsent: async (key, ttl) => {
        if (seen.has(key)) return false
        seen.set(key, ttl)
        return true
      },
    })
    const signature = input().signature
    assert.isTrue(await guard.firstUse(signature))
    assert.isFalse(await guard.firstUse(signature))
    assert.isTrue(await guard.firstUse('a'.repeat(64)))
    const [key, ttl] = [...seen][0]
    assert.equal(ttl, 600)
    // The cache keeps a hash, not the signature.
    assert.notInclude(key, signature)

    const down = new ReplayGuard('test:', {
      setIfAbsent: async () => {
        throw new Error('connection refused')
      },
    })
    assert.isTrue(await down.firstUse(signature))
  })

  test('credentials never reach a log line', ({ assert }) => {
    const config = app.config.get<any>('logger').loggers.app
    let output = ''
    const sink = new Writable({
      write(chunk, _encoding, done) {
        output += chunk.toString()
        done()
      },
    })
    const log = pino({ redact: config.redact }, sink)
    log.info(
      {
        headers: { 'authorization': 'Bearer inv_dev_leak', 'x-invade-signature': 'sig-leak' },
        token: 'inv_dev_leak2',
        device: { secret: 'secret-leak', token: 'inv_dev_leak3' },
      },
      'request'
    )
    assert.notInclude(output, 'leak')
    assert.include(output, '[redacted]')
  })
})
