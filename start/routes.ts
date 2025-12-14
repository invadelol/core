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
