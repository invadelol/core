import { test } from '@japa/runner'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import app from '@adonisjs/core/services/app'
import {
  firstSentence,
  headline,
  highlight,
  parseChangelog,
  runs,
  sentenceEnd,
} from '#services/changelog_parse'

test.group('Changelog parser', () => {
  test('inline runs: bold, emphasis, code', ({ assert }) => {
    assert.deepEqual(runs('**Lead.** then *this* and `~`.'), [
      { s: 'Lead.', b: true },
      { s: ' then ' },
      { s: 'this', i: true },
      { s: ' and ' },
      { s: '~', c: true },
      { s: '.' },
    ])
    assert.deepEqual(runs('3 * 4 stays plain'), [{ s: '3 * 4 stays plain' }])
  })

  test('highlights: marked lines first, else New then Changed, one sentence each', ({ assert }) => {
    const md = [
      '## 1.2.0',
      '### Fixed',
      '- **A fix.** Details.',
      '### New',
      '- **First.** More text. Even more.',
      '- Second, on invade.lol since 0.3.0. Then more.',
      '### Changed',
      '- **Third:** a change',
      '- Fourth.',
      '## 1.1.0',
      '### New',
      '- **Plain.**',
      '### Fixed',
      '- **The marked one.** Because. <!-- highlight -->',
    ].join('\n')
    const [a, b] = parseChangelog(md)
    assert.deepEqual(a.highlights, [
      'First.',
      'Second, on invade.lol since 0.3.0.',
      'Third: a change',
    ])
    assert.equal(
      highlight(
        runs(
          '**Short lead:** and a sentence that goes on and on, well past what a popup line can hold in one go.'
        )
      ),
      'Short lead'
    )
    assert.deepEqual(b.highlights, ['The marked one.'])
    assert.deepEqual(b.sections[1].lines[0], {
      runs: [{ s: 'The marked one.', b: true }, { s: ' Because.' }],
      highlight: true,
    })
    assert.equal(firstSentence([{ s: 'No end' }]), 'No end')
  })

  test('headings: the version, and its date when released', ({ assert }) => {
    const [a, b, c] = parseChangelog(
      '## 1.3.0\n### New\n- One.\n## 1.2.0 - 2026-10-15\n### New\n- Two.\n## v1.1.0\n### New\n- Three.'
    )
    assert.deepEqual([a.version, a.date], ['1.3.0', undefined])
    assert.deepEqual([b.version, b.date], ['1.2.0', '2026-10-15'])
    assert.deepEqual([c.version, c.date], ['1.1.0', undefined])
    // What a typo looks like: an en dash, brackets, or a date in another form is not read.
    for (const bad of [
      '## 1.2.0 – 2026-10-15',
      '## [1.2.0]',
      '## 1.2.0 (2026-10-15)',
      '## 1.2.0 - 15/10/2026',
    ]) {
      assert.lengthOf(parseChangelog(`${bad}\n### New\n- One.`), 0, bad)
    }
  })

  test('markers: highlight and image, at the end or on a wrapped line, never in the text', ({
    assert,
  }) => {
    const md = [
      '## 1.0.0',
      '### New',
      '- **Shot.** Text. <!-- highlight --> <!-- image shot.webp -->',
      '- **Only a picture.** <!--image  other.webp-->',
      '- **Wrapped.** First half',
      '  and the rest. <!-- highlight -->',
      '- **Plain.** <!-- a note for whoever edits this -->',
    ].join('\n')
    const [r] = parseChangelog(md)
    const [shot, picture, wrapped, plain] = r.sections[0].lines
    assert.deepEqual(shot, {
      runs: [{ s: 'Shot.', b: true }, { s: ' Text.' }],
      highlight: true,
      image: 'shot.webp',
    })
    assert.deepEqual(picture, { runs: [{ s: 'Only a picture.', b: true }], image: 'other.webp' })
    assert.deepEqual(wrapped, {
      runs: [{ s: 'Wrapped.', b: true }, { s: ' First half' }, { s: ' and the rest.' }],
      highlight: true,
    })
    assert.deepEqual(plain, { runs: [{ s: 'Plain.', b: true }] })
    // An image alone does not make a headline.
    assert.deepEqual(r.highlights, ['Shot.', 'Wrapped.'])
  })

  test('a version not written yet: kept, with nothing to show', ({ assert }) => {
    const [next, last] = parseChangelog(
      '## 1.1.0\n\n### New\n\n## 1.0.0 - 2026-01-01\n### Fixed\n- **A fix.**'
    )
    assert.deepEqual(next, { version: '1.1.0', sections: [], highlights: [] })
    assert.deepEqual(last.highlights, [])
    assert.lengthOf(last.sections[0].lines, 1)
  })

  test('headlines: up to the first full stop or colon, the rest keeps its formatting', ({
    assert,
  }) => {
    assert.deepEqual(
      headline(runs('**Summoner spells go in with the runes.** When Invade puts `x` in.')),
      {
        title: 'Summoner spells go in with the runes',
        rest: [{ s: 'When Invade puts ' }, { s: 'x', c: true }, { s: ' in.' }],
      }
    )
    assert.deepEqual(
      headline(runs('**Home** is one calm screen of tiles: rank, *clips* and more.')),
      {
        title: 'Home is one calm screen of tiles',
        rest: [{ s: 'Rank, ' }, { s: 'clips', i: true }, { s: ' and more.' }],
      }
    )
    assert.deepEqual(headline(runs('**Lead only.**')), { title: 'Lead only', rest: [] })
    assert.deepEqual(
      headline(runs('**Most picked augments in ARAM: Mayhem.** When you can choose.')),
      {
        title: 'Most picked augments in ARAM: Mayhem',
        rest: [{ s: 'When you can choose.' }],
      }
    )
    assert.isNull(headline(runs('On invade.lol since 0.3.0 and no end')))
    assert.isNull(headline(runs(`**${'a very long lead '.repeat(8)}.** Then.`)))
  })

  test('sentences end at a stop and a space, never inside e.g., 0.3.1, invade.lol or at an arrow', ({
    assert,
  }) => {
    const end = (text: string) => {
      const i = sentenceEnd(text)
      return i < 0 ? null : text.slice(0, i)
    }
    assert.equal(end('Since 0.3.1 it works. Then more.'), 'Since 0.3.1 it works.')
    assert.equal(end('Sent to invade.lol at once. Then more.'), 'Sent to invade.lol at once.')
    assert.equal(
      end('Pick a spell, e.g. Flash, and go. Then more.'),
      'Pick a spell, e.g. Flash, and go.'
    )
    assert.equal(end('Rare (i.e. one in 25) games. Then more.'), 'Rare (i.e. one in 25) games.')
    assert.equal(
      end('Settings → Discord turns it off. Then more.'),
      'Settings → Discord turns it off.'
    )
    assert.equal(
      end('Your page named "Invade…" is kept. Then more.'),
      'Your page named "Invade…" is kept.'
    )
    assert.equal(end('It says "done." Then more.'), 'It says "done."')
    assert.isNull(end('Gold went 4.5k → 6.2k'))
  })

  test('Windows line endings and markers in any case read the same', ({ assert }) => {
    const unix =
      '## 1.0.0 - 2026-01-01\n### New\n- **Lead.** Text <!-- HIGHLIGHT --> <!-- Image a.webp -->\n  wrapped.\n'
    assert.deepEqual(parseChangelog(unix.replace(/\n/g, '\r\n')), parseChangelog(unix))
    const [line] = parseChangelog(unix)[0].sections[0].lines
    assert.deepEqual([line.highlight, line.image], [true, 'a.webp'])
    // An image marker without a file name is no image.
    assert.isUndefined(
      parseChangelog('## 1.0.0\n### New\n- One. <!-- image -->')[0].sections[0].lines[0].image
    )
  })
})

/** The synced content (scripts/sync_changelog.mjs): what /app/changelog shows. */
test.group('Changelog content', () => {
  const md = readFileSync(app.makePath('resources', 'changelog', 'CHANGELOG.md'), 'utf8')
  const releases = parseChangelog(md)

  test('every version heading is read as one, newest first, dated but the newest', ({ assert }) => {
    const headings = md.split(/\r?\n/).filter((l) => /^##\s/.test(l))
    assert.isAbove(releases.length, 0)
    assert.equal(headings.length, releases.length)
    const key = (v: string) => v.split(/[.-]/).slice(0, 3).map(Number)
    for (let i = 1; i < releases.length; i++) {
      const [a, b] = [key(releases[i - 1].version), key(releases[i].version)]
      const newer = a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
      assert.isAbove(newer, 0, `${releases[i - 1].version} before ${releases[i].version}`)
    }
    assert.deepEqual(
      releases
        .slice(1)
        .filter((r) => !r.date)
        .map((r) => r.version),
      []
    )
  })

  test('every version has sections and 1–3 plain highlights', ({ assert }) => {
    for (const r of releases) {
      assert.isAbove(r.sections.length, 0, r.version)
      assert.isAtLeast(r.highlights.length, 1, r.version)
      assert.isAtMost(r.highlights.length, 3, r.version)
      for (const h of r.highlights) assert.notMatch(h, /[*`]|<!--/, `${r.version}: ${h}`)
    }
  })

  test('every screenshot it names is in public/changelog, a small WebP; none is unused', ({
    assert,
  }) => {
    const dir = app.publicPath('changelog')
    const named = releases.flatMap((r) =>
      r.sections.flatMap((s) => s.lines.flatMap((l) => (l.image ? [l.image] : [])))
    )
    const files = readdirSync(dir).filter((f) => !f.startsWith('.'))
    for (const name of named) {
      assert.include(files, name)
      const bytes = readFileSync(`${dir}/${name}`)
      assert.equal(bytes.subarray(8, 12).toString('latin1'), 'WEBP', name)
      assert.isAtMost(statSync(`${dir}/${name}`).size, 150_000, name)
    }
    for (const file of files) assert.include(named, file, `public/changelog/${file} is unused`)
  })
})
