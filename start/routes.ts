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

router.post('/summoner/sync', [SummonersController, 'sync'])

router.get('/summoner/:platform/:summoner', [SummonersController, 'show'])

router
  .get('/summoners/:puuid/activity', [SummonersController, 'activity'])
  .use(middleware.httpCache())
router
  .get('/summoners/:puuid/friends', [SummonersController, 'friends'])
  .use(middleware.httpCache())
router.get('/summoners/:puuid/ranks', [SummonersController, 'ranks']).use(middleware.httpCache())
router.get('/summoners/:puuid/stats', [SummonersController, 'stats']).use(middleware.httpCache())
router
  .get('/summoners/:puuid/champions', [SummonersController, 'champions'])
  .use(middleware.httpCache())
router
  .get('/summoners/:puuid/matches', [SummonersController, 'matches'])
  .use(middleware.httpCache())

router.put('/summoners/:puuid/increment', [SummonersController, 'incrementViews'])

router.get('/swagger', async () => {
  return AutoSwagger.default.docs(router.toJSON(), swagger)
})

router.get('/docs', async () => {
  return AutoSwagger.default.scalar('/swagger')
})

router.get('/health', [HealthChecksController, 'handle'])
