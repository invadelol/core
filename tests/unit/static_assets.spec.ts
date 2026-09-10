import { test } from '@japa/runner'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { brotliDecompressSync, gunzipSync } from 'node:zlib'
import { StaticAssetService } from '#services/static_assets'

function root() {
  const dir = mkdtempSync(join(tmpdir(), 'assets-'))
  mkdirSync(join(dir, 'assets'), { recursive: true })
  mkdirSync(join(dir, 'assets', '.vite'), { recursive: true })
  return dir
}

const BUNDLE = `export const x = ${JSON.stringify('a'.repeat(4000))}\n`.repeat(3)

test.group('Static asset service', () => {
  test('serves a hashed bundle compressed, and decodes back to the original', async ({
    assert,
  }) => {
    const dir = root()
    writeFileSync(join(dir, 'assets', 'app-A1b2C3d4.js'), BUNDLE)
    const service = new StaticAssetService(dir)

    const entry = await service.find('/assets/app-A1b2C3d4.js')
    assert.isNotNull(entry)
    assert.equal(entry!.contentType, 'text/javascript; charset=utf-8')
    assert.isTrue(entry!.immutable, 'a content-hashed filename should be immutable')

    assert.isBelow(entry!.encoded.br!.length, entry!.identity.length)
    assert.equal(brotliDecompressSync(entry!.encoded.br!).toString(), BUNDLE)
    assert.equal(gunzipSync(entry!.encoded.gzip!).toString(), BUNDLE)
  })

  test('a stable filename is cacheable but never immutable', async ({ assert }) => {
    const dir = root()
    mkdirSync(join(dir, 'fonts'), { recursive: true })
    writeFileSync(join(dir, 'fonts', 'inter-latin-400.woff2'), Buffer.alloc(2048, 7))
    const service = new StaticAssetService(dir)

    const entry = await service.find('/fonts/inter-latin-400.woff2')
    assert.isFalse(entry!.immutable)
    assert.equal(entry!.contentType, 'font/woff2')
    // woff2 is already a compressed container; re-compressing only costs time.
    assert.isUndefined(entry!.encoded.br)
  })

  test('refuses to read outside its own directory', async ({ assert }) => {
    const dir = root()
    writeFileSync(join(dir, '..', 'outside-secret.txt'), 'nope')
    const service = new StaticAssetService(dir)

    for (const attempt of [
      '/assets/../../outside-secret.txt',
      '/../outside-secret.txt',
      '/assets/%2e%2e%2f%2e%2e%2foutside-secret.txt',
      '/assets/..%2f..%2foutside-secret.txt',
    ]) {
      assert.isNull(await service.find(attempt), `escaped the root via ${attempt}`)
    }
  })

  test('keeps the build manifest private', async ({ assert }) => {
    const dir = root()
    writeFileSync(join(dir, 'assets', '.vite', 'manifest.json'), '{}')
    const service = new StaticAssetService(dir)

    assert.isNull(await service.find('/assets/.vite/manifest.json'))
  })

  test('picks the best encoding the client actually allows', async ({ assert }) => {
    const dir = root()
    writeFileSync(join(dir, 'assets', 'app-A1b2C3d4.js'), BUNDLE)
    const entry = (await new StaticAssetService(dir).find('/assets/app-A1b2C3d4.js'))!

    assert.equal(StaticAssetService.negotiate(entry, 'br, gzip'), 'br')
    assert.equal(StaticAssetService.negotiate(entry, 'gzip, deflate'), 'gzip')
    assert.equal(StaticAssetService.negotiate(entry, 'gzip, br;q=0'), 'gzip')
    assert.isNull(StaticAssetService.negotiate(entry, 'identity'))
    assert.isNull(StaticAssetService.negotiate(entry, undefined))
  })

  test('concurrent first hits compress the file once', async ({ assert }) => {
    const dir = root()
    writeFileSync(join(dir, 'assets', 'app-A1b2C3d4.js'), BUNDLE)
    const service = new StaticAssetService(dir)

    const entries = await Promise.all(
      Array.from({ length: 8 }, () => service.find('/assets/app-A1b2C3d4.js'))
    )

    for (const entry of entries) assert.strictEqual(entry, entries[0])
  })
})
