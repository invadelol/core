import { HealthChecks, DiskSpaceCheck, MemoryHeapCheck } from '@adonisjs/health'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import { DbCheck } from '@adonisjs/lucid/database'
import { RedisCheck } from '@adonisjs/redis'
import env from '#start/env'

const checks = [
  new DiskSpaceCheck(),
  new MemoryHeapCheck(),
  new DbCheck(db.connection()),
]

if (env.get('NODE_ENV') !== 'test') {
  checks.push(new RedisCheck(redis.connection()))
}

export const healthChecks = new HealthChecks().register(checks)
