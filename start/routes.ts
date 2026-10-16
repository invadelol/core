/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import AutoSwaggerModule from 'adonis-autoswagger'

type SwaggerInstance = typeof AutoSwaggerModule extends { default: infer T }
  ? T
  : typeof AutoSwaggerModule
const AutoSwagger = ((AutoSwaggerModule as unknown as { default?: unknown }).default ??
  AutoSwaggerModule) as SwaggerInstance

import swagger from '#config/swagger'
import { middleware } from '#start/middleware'
import { ANALYTICS_PANELS, analyticsUrls } from '#constants/analytics'
import { BUGS_URL, DISCORD_URL, X_URL } from '../inertia/lib/links.js'

const SummonersController = () => import('#controllers/summoners_controller')
const HealthChecksController = () => import('#controllers/health_checks_controller')
const MatchesController = () => import('#controllers/matches_controller')
const PlayerInsightsController = () => import('#controllers/player_insights_controller')
const AssetsController = () => import('#controllers/assets_controller')
const DownloadsController = () => import('#controllers/downloads_controller')
const AppPageController = () => import('#controllers/app_page_controller')
const DesktopController = () => import('#controllers/desktop_controller')
const HomeController = () => import('#controllers/home_controller')
const LensController = () => import('#controllers/lens_controller')
const SynergyController = () => import('#controllers/synergy_controller')
const LegalController = () => import('#controllers/legal_controller')

// API routes group
router
  .group(() => {
    router.get('/summoners/search', [SummonersController, 'search'])
    router.post('/summoners/sync', [SummonersController, 'sync'])
    router.get('/summoners/:summoner', [SummonersController, 'show'])
    router.get('/summoners/:platform/:summoner', [SummonersController, 'show'])

    router.get('/summoners/puuid/:puuid/mastery', [PlayerInsightsController, 'mastery'])
    router.get('/summoners/puuid/:puuid/live', [PlayerInsightsController, 'live'])

    // PUUID-based routes
    router
      .get('/summoners/puuid/:puuid/activity', [SummonersController, 'activity'])
      .use(middleware.httpCache())

    router
      .get('/summoners/puuid/:puuid/friends', [SummonersController, 'friends'])
      .use(middleware.httpCache())

    router
      .get('/summoners/puuid/:puuid/synergy', [SynergyController, 'report'])
      .use(middleware.httpCache())

    router
      .get('/summoners/puuid/:puuid/synergy/:mate', [SynergyController, 'together'])
      .use(middleware.httpCache())

    router
      .get('/summoners/puuid/:puuid/ranks', [SummonersController, 'ranks'])
      .use(middleware.httpCache())

    router
      .get('/summoners/puuid/:puuid/stats', [SummonersController, 'stats'])
      .use(middleware.httpCache())

    router
      .get('/summoners/puuid/:puuid/champions', [SummonersController, 'champions'])
      .use(middleware.httpCache())

    router
      .get('/summoners/puuid/:puuid/matches', [SummonersController, 'matches'])
      .use(middleware.httpCache())

    router.get('/summoners/puuid/:puuid/lens', [LensController, 'show']).use(middleware.httpCache())

    router.get('/matches/:id', [MatchesController, 'show']).use(middleware.httpCache())

    router.put('/summoners/puuid/:puuid/increment', [SummonersController, 'incrementViews'])

    router.get('/health', [HealthChecksController, 'handle'])

    /** The desktop app's onboarding, match uploads, player snapshots and crash reports (docs/desktop-sync.md). */
    router
      .group(() => {
        router.get('/config', [DesktopController, 'config'])
        router.post('/devices', [DesktopController, 'register'])
        router.delete('/devices/me', [DesktopController, 'revoke']).use(middleware.desktopAuth())
        router.post('/link', [DesktopController, 'link']).use(middleware.desktopAuth())
        router.delete('/link/:puuid', [DesktopController, 'unlink']).use(middleware.desktopAuth())
        router
          .get('/resolve', [DesktopController, 'resolve'])
          .use(middleware.desktopAuth({ optional: true }))
        router.post('/matches', [DesktopController, 'upload']).use(middleware.desktopAuth())
        router.post('/matches/known', [DesktopController, 'known']).use(middleware.desktopAuth())
        router.post('/players', [DesktopController, 'players']).use(middleware.desktopAuth())
        router.post('/crashes', [DesktopController, 'crashes']).use(middleware.desktopAuth())
      })
      .prefix('/desktop')
  })
  .prefix('/api')

/**
 * Riot game art, proxied and mirrored so the site and the desktop app never
 * talk to Riot's CDNs directly (docs/cdn.md). `/:patch/:kind/:id` pins a patch
 * and is immutable; `/:kind/:id` follows the live one. Registered before the
 * summoner catch-all below.
 */
router
  .group(() => {
    router.get('/names/:kind', [AssetsController, 'names'])
    router.get('/:patch/:kind/:id', [AssetsController, 'show'])
    router.get('/:kind/:id', [AssetsController, 'show'])
  })
  .prefix('/cdn')

/** Desktop app installers, before the summoner catch-all below. */
router.get('/download/:platform', [DownloadsController, 'show'])

/** The desktop app's landing page, before the summoner catch-all below. */
router.get('/app', [AppPageController, 'show']).use(middleware.httpCache({ page: true }))

/** The privacy policy, the legal notice and its terms, before the summoner catch-all below. */
router.get('/privacy', [LegalController, 'privacy'])
router.get('/legal', [LegalController, 'legal'])
router.get('/terms', ({ response }) => response.redirect('/legal#terms', false, 302))

/** The community server, before the summoner catch-all below. */
router.get('/discord', ({ response }) => response.redirect(DISCORD_URL, false, 302))

/** The X account, before the summoner catch-all below. */
router.get('/x', ({ response }) => response.redirect(X_URL, false, 302))

/** The desktop app's "Report a bug" button, so its target can change without an app release. */
router.get('/bugs', ({ response }) => response.redirect(BUGS_URL, false, 302))

router.get('/swagger', async () => {
  return AutoSwagger.docs(router.toJSON(), swagger)
})

router.get('/docs', async () => {
  return AutoSwagger.ui('/swagger', swagger)
})

router.get('/og/:summoner', [() => import('#controllers/social_cards_controller'), 'show'])

/** The match page's og:image, one player's game: `/og/match/:matchId/Name-Tag.jpg`. */
router.get('/og/match/:matchId/:file', [
  () => import('#controllers/match_cards_controller'),
  'show',
])

/** The desktop app's Discord presence picture; its badge is the static `/presence/invade.png`. */
router.get('/presence/:file', [() => import('#controllers/presence_cards_controller'), 'show'])

router.get('/sitemap.xml', [() => import('#controllers/sitemaps_controller'), 'index'])

router.get('/', [HomeController, 'show']).use(middleware.httpCache({ page: true }))

router.get('/:summoner/match/:matchId', async ({ inertia, params }) => {
  const { default: matchShareService } = await import('#services/match_share_service')
  // Link previews read the meta tags without running the page: the game's result, its share
  // card and its canonical address, for a stored game the player was in. Otherwise the page
  // keeps no social tags, as before.
  const share = await matchShareService.find(params.matchId, params.summoner).catch(() => null)
  return inertia.render('match', {
    summoner: params.summoner,
    matchId: params.matchId,
    social: share?.social ?? null,
  })
})

router.get('/:summoner/:section?', async ({ inertia, params, response }) => {
  const section = params.section ?? 'overview'
  if (section === 'history')
    return response.redirect(`/${encodeURIComponent(params.summoner)}#matches`)
  if (!['overview', 'lens', 'champions', 'mastery', 'friends', 'compare', 'live'].includes(section))
    return response.notFound()
  const { default: summonerService } = await import('#services/summoner_service')
  // A stored profile can render in the HTML and removes the client lookup waterfall.
  // Unknown profiles still resolve through the API, where Riot errors are translated.
  const initialProfile = await summonerService.findStoredProfile(params.summoner).catch(() => null)

  /**
   * Knowing the puuid server-side means the browser can be told which
   * analytics requests are coming while it is still parsing the HTML, rather
   * than discovering them only after the bundle has downloaded, parsed and
   * hydrated. The panels' own `fetch` calls then land on connections that are
   * already open and, more often than not, on responses already in flight.
   */
  const preload = initialProfile ? analyticsUrls(initialProfile.puuid) : []

  return inertia.render('summoner', {
    summoner: params.summoner,
    section,
    initialProfile,
    social: initialProfile
      ? {
          title: `${initialProfile.gameName}#${initialProfile.tagLine} · invade.lol`,
          description: `${initialProfile.gameName}'s League of Legends profile, recent performance and champion pool.`,
          url: `https://invade.lol/${encodeURIComponent(`${initialProfile.gameName}-${initialProfile.tagLine}`)}`,
          image: `https://invade.lol/og/${encodeURIComponent(`${initialProfile.gameName}-${initialProfile.tagLine}`)}`,
        }
      : null,
    panels: ANALYTICS_PANELS,
    preload,
  })
})
