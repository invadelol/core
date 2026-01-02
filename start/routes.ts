/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import AutoSwagger from 'adonis-autoswagger'
import swagger from '#config/swagger'

import { middleware } from '#start/middleware'

const SummonersController = () => import('#controllers/summoners_controller')
const HealthChecksController = () => import('#controllers/health_checks_controller')

router.get('/', async () => {
  return {
    hello: 'world',
  }
})

router.get('/summoners/search', [SummonersController, 'search'])

router.post('/summoners/sync', [SummonersController, 'sync'])

router.get('/summoners/:platform/:summoner', [SummonersController, 'show'])

router
  .get('/summoners/puuid/:puuid/activity', [SummonersController, 'activity'])
  .use(middleware.httpCache())
router
  .get('/summoners/puuid/:puuid/friends', [SummonersController, 'friends'])
  .use(middleware.httpCache())
router.get('/summoners/puuid/:puuid/ranks', [SummonersController, 'ranks']).use(middleware.httpCache())
router.get('/summoners/puuid/:puuid/stats', [SummonersController, 'stats']).use(middleware.httpCache())
router
  .get('/summoners/puuid/:puuid/champions', [SummonersController, 'champions'])
  .use(middleware.httpCache())
router
  .get('/summoners/puuid/:puuid/matches', [SummonersController, 'matches'])
  .use(middleware.httpCache())

router.put('/summoners/puuid/:puuid/increment', [SummonersController, 'incrementViews'])

router.get('/swagger', async () => {
  // @ts-expect-error
  return AutoSwagger.docs(router.toJSON(), swagger)
})

router.get('/docs', async () => {
  // @ts-expect-error
  return AutoSwagger.scalar('/swagger')
})

router.get('/health', [HealthChecksController, 'handle'])
