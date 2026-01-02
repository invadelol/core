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

router.put('/summoners/puuid/:puuid/increment', [SummonersController, 'incrementViews'])

router.get('/swagger', async () => {
  // @ts-expect-error
  return AutoSwagger.docs(router.toJSON(), swagger)
})

router.get('/docs', async ({ response }) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invade API - Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url: '/swagger',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
        layout: 'BaseLayout'
      });
    };
  </script>
</body>
</html>`
  return response.header('Content-Type', 'text/html').send(html)
})

router.get('/health', [HealthChecksController, 'handle'])
