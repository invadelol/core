/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),

  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring ClickHouse connection
  |----------------------------------------------------------
  */
  CLICKHOUSE_URL: Env.schema.string({ format: 'url', tld: false }),
  CLICKHOUSE_USER: Env.schema.string(),
  CLICKHOUSE_PASSWORD: Env.schema.string.optional(),
  CLICKHOUSE_DB: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the drive package
  |----------------------------------------------------------
  */
  DRIVE_DISK: Env.schema.enum(['r2'] as const),
  R2_KEY: Env.schema.string(),
  R2_SECRET: Env.schema.string(),
  R2_BUCKET: Env.schema.string(),
  R2_ENDPOINT: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the riot service
  |----------------------------------------------------------
  */
  RIOT_API_KEY: Env.schema.string(),

  REDIS_HOST: Env.schema.string({ format: 'host' }),
  REDIS_PORT: Env.schema.number(),
  REDIS_PASSWORD: Env.schema.string.optional(),
  /** Logical database, so a second checkout can share one Redis without sharing keys. */
  REDIS_DB: Env.schema.number.optional(),

  /*
  |----------------------------------------------------------
  | Desktop app sync (docs/desktop-sync.md)
  |----------------------------------------------------------
  | Kill switches, read by the app through GET /api/desktop/config.
  | Both default to on; `false` pauses the feature with a 503.
  */
  DESKTOP_UPLOADS_ENABLED: Env.schema.boolean.optional(),
  DESKTOP_RESOLVE_ENABLED: Env.schema.boolean.optional(),
  /** Oldest app version allowed to upload, e.g. "0.2.7". Unset means any. */
  DESKTOP_MIN_APP_VERSION: Env.schema.string.optional(),
})
