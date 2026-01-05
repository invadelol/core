import env from '#start/env'
import { defineConfig, store, drivers } from '@adonisjs/cache'

const cacheConfig = defineConfig({
  default: env.get('NODE_ENV') === 'test' ? 'memoryOnly' : 'default',

  stores: {
    memoryOnly: store().useL1Layer(drivers.memory()),

    default: store()
      .useL1Layer(drivers.memory())

      .useL2Layer(
        drivers.redis({
          connectionName: 'main',
        })
      ),
  },
})

export default cacheConfig

declare module '@adonisjs/cache/types' {
  interface CacheStores extends InferStores<typeof cacheConfig> {}
}
