import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import patchNotesService from '#services/patch_notes_service'
import rateLimiter from '#services/desktop/rate_limiter'
import votes, { VOTER_COOKIE, VOTER_DAYS, newVoterId, voterId } from '#services/new_dawn_votes'
import { ORIGIN, breadcrumbs, meta } from '#services/page_meta'
import {
  FAQ,
  NEW_DAWN,
  NEW_DAWN_META,
  NEW_DAWN_TABS,
  plain,
  type NewDawnTab,
} from '../../inertia/lib/new_dawn.js'

/** Votes an address may send per hour, across the rumours: far above what reading allows. */
const VOTES_PER_HOUR = 30

const voteValidator = vine.compile(vine.object({ choice: vine.enum(['yes', 'no'] as const) }))

/**
 * A POST from one of the site's own pages: the browser's own `Origin` (and `Sec-Fetch-Site` when
 * it sends one) must name this host. Cross-site pages cannot forge either.
 */
function sameOrigin(request: HttpContext['request']) {
  const site = request.header('sec-fetch-site')
  if (site && site !== 'same-origin') return false
  const origin = request.header('origin')
  if (!origin) return false
  try {
    return new URL(origin).host === request.host()
  } catch {
    return false
  }
}

export default class NewDawnController {
  /**
   * `/new-dawn`, `/new-dawn/posts`, `/new-dawn/rumours`: the New Dawn hub, one page with three
   * tabs, each its own address. What Riot said comes from the page's data file
   * (inertia/lib/new_dawn.ts); the rumours' vote counts and the visitor's own votes are read here.
   */
  async overview(ctx: HttpContext) {
    return this.render(ctx, 'overview')
  }

  async posts(ctx: HttpContext) {
    return this.render(ctx, 'posts')
  }

  async rumours(ctx: HttpContext) {
    return this.render(ctx, 'rumours')
  }

  private async render({ inertia, request }: HttpContext, tab: NewDawnTab) {
    const [patches, tallies] = await Promise.all([
      patchNotesService.list().catch(() => [] as string[]),
      votes.tallies(voterId(request.cookie(VOTER_COOKIE))),
    ])
    const here = NEW_DAWN_TABS.find((t) => t.key === tab)!
    const head = NEW_DAWN_META[tab]
    const crumbs = [
      { name: 'Patch notes', path: '/patch' },
      { name: 'New Dawn', path: '/new-dawn' },
      ...(tab === 'overview' ? [] : [{ name: here.label, path: here.href }]),
    ]
    return inertia.render('new_dawn', {
      tab,
      patches,
      votes: tallies,
      ...meta({
        title: head.title,
        description: head.description,
        path: here.href,
        image: '/new-dawn-art/og.jpg',
        version: NEW_DAWN.modified.slice(0, 10).replaceAll('-', ''),
        alt: "Riot's still of a dawn over Runeterra, from the New Dawn teaser",
      }),
      jsonld: [
        breadcrumbs(crumbs),
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          'name': head.title,
          'url': `${ORIGIN}${here.href}`,
          'dateModified': NEW_DAWN.modified,
        },
        ...(tab === 'overview'
          ? [
              {
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                'mainEntity': FAQ.map((f) => ({
                  '@type': 'Question',
                  'name': f.q,
                  'acceptedAnswer': { '@type': 'Answer', 'text': plain(f.a) },
                })),
              },
            ]
          : []),
      ],
    })
  }

  /**
   * A visitor's yes or no on an open rumour, from the hub's own page. Answers the rumour's counts
   * and the visitor's vote; a visitor who already voted keeps their first vote.
   * @requestBody {"choice":"yes"}
   * @responseBody 200 - {"outcome":"counted","yes":12,"no":4,"mine":"yes"}
   * @responseBody 403 - Not from the site's own page
   * @responseBody 429 - Too many votes from this address
   */
  async vote({ request, response, params }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    if (!sameOrigin(request)) return response.forbidden({ error: 'Votes come from the site' })
    const rumour = String(params.rumour ?? '')
    if (!votes.takes(rumour)) return response.notFound({ error: 'No vote on this rumour' })

    const hit = await rateLimiter.hit('new-dawn-votes', request.ip(), VOTES_PER_HOUR)
    if (!hit.allowed) {
      response.header('Retry-After', String(hit.retryAfter))
      return response.status(429).send({ error: 'Too many votes, try again later' })
    }
    const { choice } = await request.validateUsing(voteValidator)

    let voter = voterId(request.cookie(VOTER_COOKIE))
    if (!voter) {
      voter = newVoterId()
      response.cookie(VOTER_COOKIE, voter, {
        maxAge: `${VOTER_DAYS}d`,
        httpOnly: true,
        sameSite: 'lax',
      })
    }
    try {
      const result = await votes.vote(rumour, choice, voter, request.ip())
      return response.ok({ outcome: result.outcome, ...result.tally })
    } catch {
      return response.serviceUnavailable({ error: 'Votes are unavailable, try again later' })
    }
  }
}
