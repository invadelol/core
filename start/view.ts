/*
|--------------------------------------------------------------------------
| Edge globals
|--------------------------------------------------------------------------
|
| What the layout (resources/views/inertia_layout.edge) reads besides the page.
|
*/

import edge from 'edge.js'
import vite from '@adonisjs/vite/services/main'
import { pageStylesJson } from '#services/page_styles'

/** The stylesheets each page needs, written once into the page for inertia/lib/page_styles.ts. */
edge.global('pageStyles', pageStylesJson)

/**
 * `@vite` with each tag once, at its first place. A page's chunk imports the entry's, so `@vite`
 * listed the entry's stylesheet again after the page's own: on a page opened directly the site's
 * stylesheet came last and overrode the page's rules, while on a page reached by a visit (and in
 * development) the page's stylesheet comes last. Without the repeat, the page's rules win
 * everywhere.
 */
edge.global('viteTags', async (entries: string[]) => {
  const seen = new Set<string>()
  const tags = await vite.generateEntryPointsTags(entries)
  return tags
    .filter((tag) => {
      const key = `${tag.tag} ${tag.attributes.rel ?? ''} ${tag.attributes.href ?? tag.attributes.src ?? tag.toString()}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .join('\n')
})
