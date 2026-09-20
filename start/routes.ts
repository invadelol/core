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
const AssetsController = () => import('#controllers/assets_controller')

// API routes group
router
  .group(() => {
    router.get('/summoners/search', [SummonersController, 'search'])
    router.post('/summoners/sync', [SummonersController, 'sync'])
    router.get('/summoners/:summoner', [SummonersController, 'show'])
    router.get('/summoners/:platform/:summoner', [SummonersController, 'show'])

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

router.get('/swagger', async () => {
  return AutoSwagger.docs(router.toJSON(), swagger)
})

router.get('/docs', async () => {
  return AutoSwagger.ui('/swagger', swagger)
})

router.on('/').renderInertia('home')

router.get('/:summoner/match/:matchId', ({ inertia, params }) => {
  return inertia.render('match', {
    summoner: params.summoner,
    matchId: params.matchId,
  })
})

router.get('/:summoner', async ({ inertia, params }) => {
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
    initialProfile,
    panels: ANALYTICS_PANELS,
    preload,
  })
})
