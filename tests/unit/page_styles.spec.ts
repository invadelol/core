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
  test('lists the stylesheets each page needs, beside the ones every page keeps', ({
    assert,
  }) => {
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
