import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import app from '@adonisjs/core/services/app'
import sharp from 'sharp'
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  changelogCardLayout,
  changelogCardVersion,
  poroDigit,
  renderChangelogCard,
} from '#services/changelog_card'
import { buildChangelog, changelogSocial, normalizeVersion } from '#services/changelog'

const poro = () => readFileSync(app.makePath('resources', 'changelog', 'cheeky-poro.webp'))

test.group('Changelog version image', () => {
  test('a 1200 by 630 JPEG under 150 KB', async ({ assert }) => {
    for (const version of ['0.3.2', '0.3.1', '0.2.9', '0.10.12']) {
      const jpg = await renderChangelogCard(version, poro())
      const meta = await sharp(jpg).metadata()
      assert.equal(meta.format, 'jpeg')
      assert.equal(meta.width, CARD_WIDTH)
      assert.equal(meta.height, CARD_HEIGHT)
      assert.isAtMost(jpg.byteLength, 150_000, version)
    }
  })

  test('the poro leans on the middle digit of the minor version', ({ assert }) => {
    assert.equal(poroDigit('0.3.2'), 2)
    assert.equal(poroDigit('0.2.9'), 2)
    assert.equal(poroDigit('0.10.12'), 3)
    assert.equal(poroDigit('10.0.0'), 3)
    assert.equal(poroDigit('0.4.0-beta.1'), 2)
  })

  test('any version fits: the figure inside the card, the poro over it, under the lockup', ({
    assert,
  }) => {
    const first = changelogCardLayout('0.3.2')
    for (const version of ['0.2.9', '0.3.2', '0.10.12', '1.0.0', '12.10.120', '0.4.0-beta.1']) {
      const l = changelogCardLayout(version)
      assert.isAtLeast(l.left, 60, version)
      assert.isAtMost(l.left + l.width, CARD_WIDTH - 60, version)
      assert.isAtMost(l.size, first.size, version)
      assert.isAtLeast(l.poro.x, l.left, version)
      assert.isAtMost(l.poro.x + l.poro.w, l.left + l.width, version)
      // Below the lockup (top 45, 29 px tall) and its paws on the digit, above the baseline.
      assert.isAbove(l.poro.y, 90, version)
      assert.isBelow(l.poro.y + l.poro.h, l.baseline, version)
    }
    // A short version is drawn at full size, centred.
    assert.equal(first.size, 342)
    assert.approximately(first.left + first.width / 2, CARD_WIDTH / 2, 0.5)
  })

  test('v changes with the version and the renderer only', ({ assert }) => {
    assert.match(changelogCardVersion('0.3.2'), /^[\w-]{10}$/)
    assert.equal(changelogCardVersion('0.3.2'), changelogCardVersion('0.3.2'))
    assert.notEqual(changelogCardVersion('0.3.2'), changelogCardVersion('0.3.1'))
  })
})

test.group('Changelog page data', () => {
  const md = [
    '## 1.1.0',
    '',
    '### New',
    '',
    '## 1.0.0 - 2026-10-15',
    '### New',
    '- **A picture.** With its words. And more. <!-- highlight --> <!-- image home.webp -->',
    '- **Second marked.** Words. <!-- highlight -->',
    '- A plain line. With a second sentence.',
    '### Fixed',
    '- **A fix.**',
    '## 0.9.0 - 2026-10-01',
    '### Changed',
    '- **Missing picture.** Still shown. <!-- image nowhere.webp -->',
  ].join('\n')

  test('as the app lays it out: lead, features, quiet lists, dates', async ({ assert }) => {
    const { releases } = await buildChangelog(md)
    // The version with nothing written yet is left out.
    assert.deepEqual(
      releases.map((r) => r.version),
      ['1.0.0', '0.9.0']
    )
    const [r, older] = releases
    assert.equal(r.day, 'October 15, 2026')
    assert.equal(r.hero?.title, 'A picture')
    assert.deepEqual(r.hero?.first, [{ s: 'With its words.' }])
    assert.deepEqual(r.hero?.more, [{ s: ' And more.' }])
    assert.match(r.hero?.src ?? '', /^\/changelog\/home\.webp\?v=[\w-]{8}$/)
    assert.isAbove(r.hero?.w ?? 0, 0)
    assert.deepEqual(
      r.features.map((f) => f.title),
      ['Second marked']
    )
    assert.deepEqual(
      r.groups.map((g) => [g.title, g.quiet, g.items.length]),
      [
        ['New', false, 1],
        ['Fixed', true, 1],
      ]
    )
    assert.deepEqual(r.groups[0].items[0].more, [{ s: ' With a second sentence.' }])
    // A picture that is not there: the line stays, without it.
    assert.isNull(older.hero)
    assert.equal(older.features[0].title, 'Missing picture')
    assert.isUndefined(older.features[0].src)
  })

  test('link previews: the newest version for the page, each version its own', async ({
    assert,
  }) => {
    const log = await buildChangelog(md)
    const page = changelogSocial(log)!
    assert.equal(page.url, 'https://invade.lol/app/changelog')
    assert.include(page.image, '/og/app/changelog/1.0.0.jpg?v=')
    const one = changelogSocial(log, '0.9.0')!
    assert.equal(one.title, 'Invade 0.9.0')
    assert.equal(one.description, 'Missing picture.')
    assert.equal(one.canonical, 'https://invade.lol/app/changelog/0.9.0')
    assert.isNull(changelogSocial(log, '1.1.0'))
    assert.isNull(changelogSocial(log, '9.9.9'))
    assert.equal(normalizeVersion('v0.3.2'), '0.3.2')
    assert.equal(normalizeVersion('V0.3.2'), '0.3.2')
  })
})
