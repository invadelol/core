import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from '@japa/runner'
import { pageStylesFrom, type ManifestChunk } from '#services/page_styles'

/** A small build: the entry, two pages sharing a layout, a lazy component, a lazy page. */
const MANIFEST: Record<string, ManifestChunk> = {
  'inertia/app/app.ts': {
    file: 'app-1.js',
    isEntry: true,
    css: ['app-1.css'],
    dynamicImports: ['inertia/pages/home.vue', 'inertia/pages/esports/team.vue'],
  },
  '_SiteLayout-1.js': {
    file: 'SiteLayout-1.js',
    css: ['SiteLayout-1.css'],
    imports: ['inertia/app/app.ts'],
    dynamicImports: ['_SeasonLayer-1.js'],
  },
  '_SeasonLayer-1.js': { file: 'SeasonLayer-1.js', css: ['SeasonLayer-1.css'] },
  '_Chart-1.js': { file: 'Chart-1.js', css: ['Chart-1.css'] },
  'inertia/pages/home.vue': {
    file: 'home-1.js',
    src: 'inertia/pages/home.vue',
    css: ['home-1.css'],
    imports: ['inertia/app/app.ts', '_SiteLayout-1.js'],
    // A page that leads to another page lazily does not take that page's styles.
    dynamicImports: ['inertia/pages/esports/team.vue'],
  },
  'inertia/pages/esports/team.vue': {
    file: 'team-1.js',
    src: 'inertia/pages/esports/team.vue',
    css: ['esports-1.css'],
    imports: ['inertia/app/app.ts', '_SiteLayout-1.js'],
    dynamicImports: ['_Chart-1.js'],
  },
}

test.group('Page styles', () => {
  test('lists the stylesheets each page needs, beside the ones every page keeps', ({ assert }) => {
    const styles = pageStylesFrom(MANIFEST, (file) => `/assets/${file}`)
    assert.deepEqual(styles.always, ['/assets/app-1.css'])
    assert.sameMembers(styles.pages['home'], [
      '/assets/home-1.css',
      '/assets/SiteLayout-1.css',
      '/assets/SeasonLayer-1.css',
    ])
    assert.sameMembers(styles.pages['esports/team'], [
      '/assets/esports-1.css',
      '/assets/SiteLayout-1.css',
      '/assets/SeasonLayer-1.css',
      '/assets/Chart-1.css',
    ])
  })

  test('never gives a page another page’s stylesheet', ({ assert }) => {
    const styles = pageStylesFrom(MANIFEST, (file) => `/assets/${file}`)
    assert.notInclude(styles.pages['home'], '/assets/esports-1.css')
    assert.notInclude(styles.pages['esports/team'], '/assets/home-1.css')
  })
})

/*
 * A page's stylesheet applies only on its pages, but there it sits beside the site's header, search
 * list and footer, which every page shows. A page rule led by a class the shell also uses restyles
 * the shell on that page: the home's `.tm` once reached the search list's team pictures, the
 * profile's and the patch notes' `.ct` the header's sub-row.
 */
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SHELL = [
  'inertia/components/AppHeader.vue',
  'inertia/components/SearchBar.vue',
  'inertia/components/SiteFooter.vue',
  'inertia/components/SiteLayout.vue',
  'inertia/components/SeasonLayer.vue',
  ...readdirSync(join(ROOT, 'inertia/components/header'))
    .filter((file) => file.endsWith('.vue'))
    .map((file) => `inertia/components/header/${file}`),
]
/** Page rules that style the shell on purpose: the home styles its own big search field. */
const ALLOWED = new Set(['hf'])

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]
  )
}

/** The stylesheets pages import themselves (inertia/pages/**), by file name. */
function pageStylesheets() {
  const names = new Set<string>()
  for (const file of files(join(ROOT, 'inertia/pages')).filter((f) => f.endsWith('.vue'))) {
    for (const match of readFileSync(file, 'utf8').matchAll(/import '([^']+\.css)'/g)) {
      names.add(basename(match[1]))
    }
  }
  return [...names]
}

/** The first class after `.vb ` in each of a stylesheet's selectors, with the selector. */
function leadClasses(css: string) {
  const out = new Map<string, string>()
  for (const match of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)) {
    for (const selector of match[1].split(',')) {
      const lead = selector
        .trim()
        .match(/^(?:\[data-theme[^\]]*\]\s+)?\.vb\s+(?::is\(|:where\()?\.([a-zA-Z][\w-]*)/)
      if (lead && !out.has(lead[1])) out.set(lead[1], selector.trim())
    }
  }
  return out
}

/** Every class the shell's templates write, plain or bound. */
function shellClasses() {
  const out = new Set<string>()
  for (const file of SHELL) {
    const template = readFileSync(join(ROOT, file), 'utf8').split('<template>')[1] ?? ''
    for (const match of template.matchAll(/\sclass="([^"]+)"/g)) {
      match[1].split(/\s+/).forEach((name) => name && out.add(name))
    }
    for (const match of template.matchAll(/:class="([^"]+)"/g)) {
      for (const name of match[1].matchAll(/'([a-zA-Z][\w-]*)'|([a-zA-Z][\w-]*)\s*:/g)) {
        out.add(name[1] ?? name[2])
      }
    }
  }
  return out
}

test.group('Page styles and the shell', () => {
  test('no page stylesheet leads with a class the header, search or footer uses', ({ assert }) => {
    const shell = shellClasses()
    const clashes: string[] = []
    for (const name of pageStylesheets()) {
      const css = readFileSync(join(ROOT, 'inertia/css', name), 'utf8')
      for (const [lead, selector] of leadClasses(css)) {
        if (shell.has(lead) && !ALLOWED.has(lead)) clashes.push(`${name}: ${selector}`)
      }
    }
    assert.deepEqual(clashes, [])
  })
})
