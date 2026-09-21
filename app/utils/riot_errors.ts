import { Exception } from '@adonisjs/core/exceptions'

/** Bentocache wraps application exceptions in a generic 500 factory error. */
export function unwrapCacheFactoryError(error: unknown): unknown {
  const seen = new Set<unknown>()
  while (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'E_FACTORY_ERROR' &&
    'cause' in error &&
    error.cause &&
    !seen.has(error)
  ) {
    seen.add(error)
    error = error.cause
  }
  return error
}

/** Safe upstream context, without retaining headers or credentials. */
export class RiotUpstreamException extends Exception {
  constructor(
    message: string,
    code: string,
    public upstreamStatus: number,
    public retryAfter?: number
  ) {
    super(message, { status: 503, code })
  }
}

export function riotRetryAfter(error: any): number {
  // @fightmegg/riot-rate-limiter exposes retryAfter in milliseconds.
  const milliseconds = Number(error?.retryAfter)
  if (Number.isFinite(milliseconds) && milliseconds > 0) return Math.ceil(milliseconds / 1000)
  const headers = error?.headers ?? error?.response?.headers
  const raw =
    typeof headers?.get === 'function'
      ? headers.get('retry-after')
      : (headers?.['retry-after'] ?? headers?.['Retry-After'])
  const seconds = Number(raw)
  if (raw !== null && raw !== undefined && Number.isFinite(seconds) && seconds >= 0)
    return Math.max(1, Math.ceil(seconds))
  const date = typeof raw === 'string' ? Date.parse(raw) : Number.NaN
  if (Number.isFinite(date)) return Math.max(1, Math.ceil((date - Date.now()) / 1000))
  return 60
}

/**
 * The Riot client throws the failed response rather than a typed error, and
 * the status hides in a different place depending on which call failed.
 */
export function riotErrorStatus(error: any): number | null {
  const candidates = [
    error?.status,
    error?.statusCode,
    error?.response?.status,
    error?.response?.statusCode,
    error?.body?.status?.status_code,
  ]

  for (const candidate of candidates) {
    const status = Number(candidate)
    if (Number.isFinite(status) && status >= 100 && status < 600) return status
  }

  return null
}

/**
 * Turns a failed Riot call into an exception that says what actually went
 * wrong. Without this every upstream problem, including an expired key or a
 * rate limit, reaches the client as a bare 500 and the UI has no choice but
 * to report it as "not found".
 */
export function translateRiotError(error: unknown): unknown {
  // Exceptions we raised ourselves already carry the right status.
  if (error instanceof Exception) return error

  const status = riotErrorStatus(error)

  if (status === 404) {
    return new Exception('Summoner not found', { status: 404, code: 'E_SUMMONER_NOT_FOUND' })
  }

  if (status === 429) {
    return new RiotUpstreamException(
      'Riot is rate limiting requests, try again in a moment',
      'E_RIOT_RATE_LIMITED',
      status,
      riotRetryAfter(error)
    )
  }

  if (status === 401 || status === 403) {
    return new RiotUpstreamException('Riot rejected our API key', 'E_RIOT_KEY_REJECTED', status)
  }

  if (status && status >= 500) {
    return new RiotUpstreamException('Riot API is unavailable', 'E_RIOT_UNAVAILABLE', status)
  }

  return error
}
