/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'

const SummonersController = () => import('#controllers/summoners_controller')

router.get('/', async () => {
  return {
    hello: 'world',
  }
})

router.post('/summoners/sync', [SummonersController, 'sync'])

router.get('/summoner/:summoner', [SummonersController, 'show'])

router.get('/summoners/:puuid/activity', [SummonersController, 'activity'])
router.get('/summoners/:puuid/friends', [SummonersController, 'friends'])
router.get('/summoners/:puuid/ranks', [SummonersController, 'ranks'])
router.get('/summoners/:puuid/stats', [SummonersController, 'stats'])
router.get('/summoners/:puuid/champions', [SummonersController, 'champions'])
