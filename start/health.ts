import { HealthChecks, DiskSpaceCheck, MemoryHeapCheck } from '@adonisjs/health'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import { DbCheck } from '@adonisjs/lucid/database'
import { RedisCheck } from '@adonisjs/redis'

export const healthChecks = new HealthChecks().register([
  new DiskSpaceCheck(),
  new MemoryHeapCheck(),
  new DbCheck(db.connection()),
  new RedisCheck(redis.connection()),
])
