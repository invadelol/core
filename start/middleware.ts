import router from '@adonisjs/core/services/router'

export const middleware = router.named({
    httpCache: () => import('#middleware/http_cache_middleware'),
})
