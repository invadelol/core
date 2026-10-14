import env from '#start/env'
import logger from '@adonisjs/core/services/logger'

/**
 * Server events for OpenPanel (self-hosted: API at opapi.lschvn.foo, dashboard at op.lschvn.foo), next to the web script in the
 * layout. Fire and forget: a request never waits on analytics, and a failure is only logged.
 * Without OPENPANEL_CLIENT_SECRET nothing is sent (local checkouts, tests).
 */
const API_URL = (env.get('OPENPANEL_API_URL') || 'https://opapi.lschvn.foo').replace(/\/$/, '')
/** The web script is served by the dashboard, not the API. */
const SCRIPT_URL = env.get('OPENPANEL_SCRIPT_URL') || 'https://op.lschvn.foo/op1.js'
const CLIENT_ID = env.get('OPENPANEL_CLIENT_ID') || '9a2c508e-3e56-415e-bf7f-bf76fd0741e2'

export interface TrackOptions {
  /** A stable id to group events under (the desktop device id), never a Riot identity. */
  profileId?: string
  /** The visitor's IP and user agent, so OpenPanel ties the event to the same web visitor. */
  ip?: string
  userAgent?: string
}

export function track(
  name: string,
  properties: Record<string, string | number | boolean | null> = {},
  options: TrackOptions = {}
) {
  const secret = env.get('OPENPANEL_CLIENT_SECRET')
  if (!secret) return
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'openpanel-client-id': CLIENT_ID,
    'openpanel-client-secret': secret,
  }
  if (options.ip) headers['x-client-ip'] = options.ip
  if (options.userAgent) headers['user-agent'] = options.userAgent
  fetch(`${API_URL}/track`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      type: 'track',
      payload: { name, properties, ...(options.profileId ? { profileId: options.profileId } : {}) },
    }),
    signal: AbortSignal.timeout(5000),
  })
    .then((response) => {
      if (!response.ok) logger.warn({ status: response.status, name }, 'openpanel: event refused')
    })
    .catch((error) => logger.warn({ err: error, name }, 'openpanel: event not sent'))
}

/** What the web script needs: shared with every page and read by the layout. */
export function webAnalytics() {
  return {
    apiUrl: API_URL,
    clientId: CLIENT_ID,
    scriptUrl: SCRIPT_URL,
  }
}
