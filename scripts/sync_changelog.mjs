#!/usr/bin/env node
/**
 * Refreshes the desktop app's changelog on invade.lol (/app/changelog) from a checkout of the app:
 *
 *   node scripts/sync_changelog.mjs <path to the app checkout>     (or $INVADE_APP)
 *
 * Copies what the app's "What's new" page shows, and nothing else:
 *   CHANGELOG.md                        → resources/changelog/CHANGELOG.md
 *   src/changelog/shots/*.webp          → public/changelog/ (shots the app dropped are removed)
 *   src/assets/emotes/cheeky-poro.webp  → resources/changelog/cheeky-poro.webp (the version image)
 *
 * The site parses the file on the server (app/services/changelog.ts) and draws each version's
 * link preview (app/services/changelog_card.ts), so a release only needs this sync, then
 * `node ace test --files tests/unit/changelog*` and a commit.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = process.argv[2] ?? process.env.INVADE_APP
if (!source || !existsSync(join(resolve(source), 'CHANGELOG.md'))) {
  console.error('No app checkout with a CHANGELOG.md: node scripts/sync_changelog.mjs <path>')
  process.exit(1)
}
const app = resolve(source)

const content = join(root, 'resources', 'changelog')
const shots = join(root, 'public', 'changelog')
mkdirSync(content, { recursive: true })
mkdirSync(shots, { recursive: true })

copyFileSync(join(app, 'CHANGELOG.md'), join(content, 'CHANGELOG.md'))

const poro = join(app, 'src', 'assets', 'emotes', 'cheeky-poro.webp')
if (existsSync(poro)) copyFileSync(poro, join(content, 'cheeky-poro.webp'))

const from = join(app, 'src', 'changelog', 'shots')
const wanted = readdirSync(from).filter((name) => name.endsWith('.webp'))
for (const name of wanted) copyFileSync(join(from, name), join(shots, name))
for (const name of readdirSync(shots)) {
  if (name.endsWith('.webp') && !wanted.includes(name)) rmSync(join(shots, name))
}

const versions = readFileSync(join(content, 'CHANGELOG.md'), 'utf8')
  .split(/\r?\n/)
  .filter((line) => /^##\s/.test(line))
  .map((line) => line.replace(/^##\s+/, ''))
console.log(`CHANGELOG.md: ${versions.join(', ')}`)
console.log(`public/changelog: ${wanted.length} shots`)
