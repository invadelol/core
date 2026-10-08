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

const SummonersController = () => import('#controllers/summoners_controller')
const HealthChecksController = () => import('#controllers/health_checks_controller')
const MatchesController = () => import('#controllers/matches_controller')
const PlayerInsightsController = () => import('#controllers/player_insights_controller')
const AssetsController = () => import('#controllers/assets_controller')
const DownloadsController = () => import('#controllers/downloads_controller')
const AppPageController = () => import('#controllers/app_page_controller')
const DesktopController = () => import('#controllers/desktop_controller')

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

    router.get('/matches/:id', [MatchesController, 'show']).use(middleware.httpCache())

    router.put('/summoners/puuid/:puuid/increment', [SummonersController, 'incrementViews'])

    router.get('/health', [HealthChecksController, 'handle'])

    /** The desktop app's onboarding and match uploads (docs/desktop-sync.md). */
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
      })
      .prefix('/desktop')
  })
  .prefix('/api')

/**
 * Riot game art, proxied and mirrored so the client never talks to Riot's
 * CDNs directly. Registered before the summoner catch-all below.
 */
router
  .group(() => {
    router.get('/names/:kind', [AssetsController, 'names'])
    router.get('/:kind/:id', [AssetsController, 'show'])
  })
  .prefix('/cdn')

/** Desktop app installers, before the summoner catch-all below. */
router.get('/download/:platform', [DownloadsController, 'show'])

/** The desktop app's landing page, before the summoner catch-all below. */
router.get('/app', [AppPageController, 'show'])

router.get('/swagger', async () => {
  return AutoSwagger.docs(router.toJSON(), swagger)
})

router.get('/docs', async () => {
  return AutoSwagger.ui('/swagger', swagger)
})

router.get('/og/:summoner', [() => import('#controllers/social_cards_controller'), 'show'])

router.get('/sitemap.xml', [() => import('#controllers/sitemaps_controller'), 'index'])

router.on('/').renderInertia('home')

router.get('/:summoner/match/:matchId', ({ inertia, params }) => {
  return inertia.render('match', {
    summoner: params.summoner,
    matchId: params.matchId,
  })
})

router.get('/:summoner/:section?', async ({ inertia, params, response }) => {
  const section = params.section ?? 'overview'
  if (section === 'history')
    return response.redirect(`/${encodeURIComponent(params.summoner)}#matches`)
  // "Lens" showed champion mastery next to a second copy of the performance
  // panel. Mastery now lives inside Champions, where a champion pool belongs.
  if (section === 'lens')
    return response.redirect(`/${encodeURIComponent(params.summoner)}/champions`)
  if (!['overview', 'champions', 'friends', 'compare', 'live'].includes(section))
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
