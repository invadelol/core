import { Exception } from '@adonisjs/core/exceptions'

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
    return new Exception('Riot is rate limiting requests, try again in a moment', {
      status: 503,
      code: 'E_RIOT_RATE_LIMITED',
    })
  }

  if (status === 401 || status === 403) {
    return new Exception('Riot rejected our API key', {
      status: 503,
      code: 'E_RIOT_KEY_REJECTED',
    })
  }

  if (status && status >= 500) {
    return new Exception('Riot API is unavailable', { status: 503, code: 'E_RIOT_UNAVAILABLE' })
  }

  return error
}
