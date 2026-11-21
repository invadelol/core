import { test } from '@japa/runner'
import { sniffImageType } from '#utils/remote_image'

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(
    parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p))
  )

test.group('Remote images', () => {
  test('reads a raster image type from its first bytes', ({ assert }) => {
    assert.equal(sniffImageType(bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a, 0, 0])), 'image/png')
    assert.equal(sniffImageType(bytes([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg')
    assert.equal(sniffImageType(bytes('RIFF', [1, 2, 3, 4], 'WEBPVP8 ')), 'image/webp')
    assert.equal(sniffImageType(bytes('GIF89a', [0, 0])), 'image/gif')
    assert.equal(sniffImageType(bytes([0, 0, 0, 0x20], 'ftypavif')), 'image/avif')
  })

  test('refuses anything else, an SVG included', ({ assert }) => {
    assert.isNull(sniffImageType(bytes('<svg xmlns="http://www.w3.org/2000/svg"></svg>')))
    assert.isNull(sniffImageType(bytes('<!doctype html>')))
    assert.isNull(sniffImageType(new Uint8Array(0)))
  })
})
