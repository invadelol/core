#!/usr/bin/env node
/**
 * Refreshes the vendored @invadelol/ui (vendor/invadelol-ui) from a checkout of the package, for
 * as long as it is not on npm:
 *
 *   node scripts/sync_ui.mjs [path to the ui checkout]     (default: ../ui, or $INVADE_UI)
 *
 * Builds the package into vendor/invadelol-ui, reinstalls it (Bun copies `file:` dependencies)
 * and clears Vite's pre-bundled copy so the dev server picks it up. Commit the vendor folder.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ui = resolve(process.argv[2] ?? process.env.INVADE_UI ?? join(root, '..', 'ui'))
const vendor = join(ui, 'scripts', 'vendor.mjs')
if (!existsSync(vendor)) {
  console.error(`No @invadelol/ui checkout at ${ui}: node scripts/sync_ui.mjs <path>`)
  process.exit(1)
}

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' })
run('node', [vendor, join(root, 'vendor', 'invadelol-ui')], ui)
run('bun', ['install'], root)
rmSync(join(root, 'node_modules', '.vite'), { recursive: true, force: true })
