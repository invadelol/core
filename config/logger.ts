import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, targets } from '@adonisjs/core/logger'

const loggerConfig = defineConfig({
  default: 'app',

  /**
   * The loggers object can be used to define multiple loggers.
   * By default, we configure only one logger (named "app").
   */
  loggers: {
    app: {
      enabled: true,
      name: env.get('APP_NAME'),
      level: env.get('LOG_LEVEL'),
      /**
       * Credentials never reach a log line, whatever object carries them:
       * request headers (the desktop app's bearer token and request
       * signature), and the device token and signing secret by name.
       */
      redact: {
        paths: [
          'authorization',
          'headers.authorization',
          'headers["x-invade-signature"]',
          'req.headers.authorization',
          'req.headers["x-invade-signature"]',
          'request.headers.authorization',
          'request.headers["x-invade-signature"]',
          'err.config.headers',
          'err.headers.authorization',
          'token',
          'secret',
          'signature',
          '*.token',
          '*.secret',
          '*.signature',
        ],
        censor: '[redacted]',
      },
      transport: {
        targets: targets()
          .pushIf(!app.inProduction, targets.pretty())
          .pushIf(app.inProduction, targets.file({ destination: 1 }))
          .toArray(),
      },
    },
  },
})

export default loggerConfig

/**
 * Inferring types for the list of loggers you have configured
 * in your application.
 */
declare module '@adonisjs/core/types' {
  export interface LoggersList extends InferLoggers<typeof loggerConfig> {}
}
