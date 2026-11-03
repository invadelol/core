import type { HttpContext } from '@adonisjs/core/http'

/**
 * What the champion, stats and pro pages tell search engines and link previews: their `social`
 * tags (title, description, canonical address, share card), their structured data (`jsonld`) and,
 * for thin or permutation pages, `robots`. The layout reads all three from the page's props.
 */

export const ORIGIN = 'https://invade.lol'

export interface Social {
  title: string
  description: string
  url: string
  canonical: string
  image: string
  imageType: 'image/jpeg'
  alt: string
  type: 'website' | 'profile'
}

/** A page's social tags: `path` is its canonical address, `image` its share card's path. */
export function social(opts: {
  title: string
  description: string
  path: string
  image: string
  version: string
  alt: string
  type?: Social['type']
}): Social {
  const url = `${ORIGIN}${opts.path}`
  return {
    title: opts.title,
    description: opts.description,
    url,
    canonical: url,
    image: `${ORIGIN}${opts.image}?v=${encodeURIComponent(opts.version)}`,
    imageType: 'image/jpeg',
    alt: opts.alt,
    type: opts.type ?? 'website',
  }
}

/** Today as `yyyymmdd` (UTC), the version of share cards that change daily. */
export const today = () => new Date().toISOString().slice(0, 10).replaceAll('-', '')

/** schema.org BreadcrumbList for the visible breadcrumb, the current page last. */
export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': items.map((i, k) => ({
      '@type': 'ListItem',
      'position': k + 1,
      'name': i.name,
      'item': `${ORIGIN}${i.path}`,
    })),
  }
}

/** schema.org ItemList of pages, in order. */
export function itemList(name: string, items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    'numberOfItems': items.length,
    'itemListElement': items.map((i, k) => ({
      '@type': 'ListItem',
      'position': k + 1,
      'name': i.name,
      'url': `${ORIGIN}${i.path}`,
    })),
  }
}

/** "52.1%" */
export const percent = (x: number | null | undefined, digits = 1) =>
  x === null || x === undefined ? '' : `${(x * 100).toFixed(digits)}%`

/** "12,408" */
export const count = (n: number) => Math.round(n).toLocaleString('en-US')

/** The rank bracket names in sentences. */
export const BRACKET_TEXT: Record<string, string> = {
  all: 'all ranks',
  iron: 'Iron',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  emerald: 'Emerald',
  diamond: 'Diamond',
  emerald_plus: 'Emerald and above',
  diamond_plus: 'Diamond and above',
  master_plus: 'Master and above',
}

/** A page's social tags and its meta description, to spread into its props. */
export function meta(opts: Parameters<typeof social>[0]) {
  const tags = social(opts)
  return { social: tags, description: tags.description }
}

/**
 * The site's own 404 page, for a champion, pro or team the address does not name. A bare
 * `response.notFound()` has no body: blank on a full load, and an error box ("a plain JSON
 * response was received") on an Inertia visit.
 */
export function notFoundPage({ inertia, response }: Pick<HttpContext, 'inertia' | 'response'>) {
  response.status(404)
  return inertia.render('errors/not_found', { error: { status: 404, message: null } })
}
