import vite from '@adonisjs/vite/services/main'

/** A chunk of Vite's build manifest, as far as stylesheets go. */
export interface ManifestChunk {
  file: string
  src?: string
  isEntry?: boolean
  css?: string[]
  imports?: string[]
  dynamicImports?: string[]
}

/** Which stylesheets each page needs (`/assets/…` paths), and those every page keeps. */
export interface PageStyles {
  always: string[]
  pages: Record<string, string[]>
}

const ENTRY = 'inertia/app/app.ts'
const PAGES = /^inertia\/pages\/(.+)\.vue$/

/**
 * The stylesheets a page's chunk brings, its own and those of every chunk it imports, statically
 * or lazily (a lazy component's styles arrive with it). Other pages reached through a lazy import
 * are not followed: they are pages of their own.
 */
function stylesOf(manifest: Record<string, ManifestChunk>, key: string, seen = new Set<string>()) {
  const out = new Set<string>()
  const walk = (name: string) => {
    if (seen.has(name)) return
    seen.add(name)
    const chunk = manifest[name]
    if (!chunk) return
    for (const css of chunk.css ?? []) out.add(css)
    for (const next of chunk.imports ?? []) walk(next)
    for (const next of chunk.dynamicImports ?? []) if (!PAGES.test(next)) walk(next)
  }
  walk(key)
  return out
}

/**
 * Built from the manifest: each page component (`esports/team`) and the stylesheets it needs.
 * Vite adds a page's stylesheet the first time that page is visited and never removes it, so
 * the browser (inertia/lib/page_styles.ts) switches off, on every visit, the ones the page shown
 * does not need: a page then looks the same whether it was opened directly or reached from
 * another one.
 */
export function pageStylesFrom(
  manifest: Record<string, ManifestChunk>,
  url: (file: string) => string
): PageStyles {
  const always = stylesOf(manifest, ENTRY)
  const pages: Record<string, string[]> = {}
  for (const key of Object.keys(manifest)) {
    const match = PAGES.exec(key)
    if (!match) continue
    pages[match[1]] = [...stylesOf(manifest, key)].filter((css) => !always.has(css)).map(url)
  }
  return { always: [...always].map(url), pages }
}

let cached: string | null | undefined

/**
 * The map as JSON for the layout to write once into the page (`<` escaped), or null in
 * development, where Vite serves each stylesheet itself and there is no manifest.
 */
export function pageStylesJson(): string | null {
  if (cached !== undefined) return cached
  try {
    // In development `manifest()` throws: there is none.
    const base = (vite.assetsUrl() ?? '').replace(/\/$/, '')
    const styles = pageStylesFrom(
      vite.manifest() as Record<string, ManifestChunk>,
      (file) => `${base}/${file}`
    )
    cached = JSON.stringify(styles).split('<').join('\\u003c')
  } catch {
    // No manifest (development): the stylesheets stay as Vite leaves them.
    cached = null
  }
  return cached
}
