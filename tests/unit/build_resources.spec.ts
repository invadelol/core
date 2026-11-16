import { test } from '@japa/runner'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../..')

/** Every `.ts` file under a folder. */
async function sources(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((e) => {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) return sources(full)
      return Promise.resolve(e.name.endsWith('.ts') ? [full] : [])
    })
  )
  return files.flat()
}

test.group('Production build', () => {
  test('copies every resources folder the server reads at run time', async ({ assert }) => {
    // `node ace build` copies only the metaFiles patterns: a folder missing there is absent in
    // production, where its pages then come up empty.
    const rc = await readFile(path.join(ROOT, 'adonisrc.ts'), 'utf8')
    const read = new Set<string>()
    for (const file of await sources(path.join(ROOT, 'app'))) {
      const text = await readFile(file, 'utf8')
      for (const m of text.matchAll(/makePath\(\s*'resources(?:\/([\w-]+)|',\s*'([\w-]+))/g))
        read.add(m[1] ?? m[2])
    }
    assert.isAbove(read.size, 0)
    for (const dir of read) assert.include(rc, `'resources/${dir}/**'`, `resources/${dir}`)
  })
})
