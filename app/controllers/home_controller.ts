import type { HttpContext } from '@adonisjs/core/http'
import championStatsService from '#services/champion_stats_service'
import homeService from '#services/home_service'
import proService from '#services/pro_service'
import { championSlug } from '../../inertia/lib/champions.js'
import { DISCORD_URL, REPO_URL, X_URL } from '../../inertia/lib/links.js'

const SITE = 'https://invade.lol'

const DESCRIPTION =
  'Look up any League of Legends player: rank, match history and a score for every game. Get Invade, the free desktop app for Windows and macOS.'

export default class HomeController {
  /**
   * `/`: the search with the profiles this browser opened (kept on the device, so not sent from
   * here), then the tier list's best picks, the pros, the lanes, the desktop app, the bans and
   * the Discord, all read from what invade.lol already stores, each through its own cache, in
   * one round: the page never fetches more after it loads.
   */
  async show({ inertia }: HttpContext) {
    const sections = await homeService.page()
    const version = sections.picks?.patch ?? new Date().toISOString().slice(0, 10).replace(/-/g, '')
    return inertia.render('home', {
      ...sections,
      description: DESCRIPTION,
      social: {
        type: 'website',
        title: 'invade.lol | League of Legends profiles and the Invade desktop app',
        description: DESCRIPTION,
        url: `${SITE}/`,
        canonical: `${SITE}/`,
        image: `${SITE}/og/home.jpg?v=${version}`,
        imageType: 'image/jpeg',
        alt: 'invade.lol: League of Legends profiles, champion stats and pros',
      },
      jsonld: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          'name': 'invade.lol',
          'url': `${SITE}/`,
          'potentialAction': {
            '@type': 'SearchAction',
            'target': { '@type': 'EntryPoint', 'urlTemplate': `${SITE}/search?q={query}` },
            'query-input': 'required name=query',
          },
        },
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          'name': 'Invade',
          'url': `${SITE}/`,
          'logo': `${SITE}/icons/icon-512.png`,
          'sameAs': [X_URL, DISCORD_URL, REPO_URL],
        },
      ],
    })
  }

  /**
   * `/search?q=`: the site's search as an address (the WebSite's SearchAction). A Riot ID opens
   * its profile, a champion its page, a pro or a team theirs; anything else lands on the home.
   */
  async search({ request, response }: HttpContext) {
    const q = String(request.input('q', '')).trim().slice(0, 64)
    const hash = q.indexOf('#')
    if (hash > 0 && hash < q.length - 1) {
      const name = `${q.slice(0, hash).trim()}-${q.slice(hash + 1).trim()}`
      return response.redirect(`/${encodeURIComponent(name)}`, false, 302)
    }
    if (q.length >= 2) {
      const champion = await championStatsService.champion(championSlug(q)).catch(() => null)
      if (champion) return response.redirect(`/champions/${champion.slug}`, false, 302)
      const found = await proService.search(q, 1).catch(() => null)
      if (found?.pros[0]) return response.redirect(`/pro/${found.pros[0].slug}`, false, 302)
      if (found?.teams[0]) return response.redirect(`/team/${found.teams[0].slug}`, false, 302)
    }
    return response.redirect('/', false, 302)
  }

  /** `/api/site/nav`: what the header's menus show beside their links, the same for everyone. */
  async nav({ response }: HttpContext) {
    const nav = await homeService.nav()
    response.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
    return response.ok(nav)
  }
}
