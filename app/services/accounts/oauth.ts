import { randomBytes } from 'node:crypto'
import env from '#start/env'
import { accountOrigin } from '#services/accounts/session_service'

/**
 * Sign-in with Discord (OAuth 2.0 authorization code, `identify` scope). Only the person's
 * Discord id and display name are read: no e-mail address, no token kept. The access token is
 * used once, for the identity, and dropped.
 */

const DISCORD = {
  authorize: 'https://discord.com/oauth2/authorize',
  token: 'https://discord.com/api/oauth2/token',
  identity: 'https://discord.com/api/users/@me',
  scope: 'identify',
}

/**
 * A local stand-in for Discord (`OAUTH_MOCK_ORIGIN`, e.g. `http://127.0.0.1:3364` served by
 * `scripts/oauth_mock.mjs`), never in production: the whole flow runs, minus Discord itself.
 */
function mockOrigin() {
  const origin = env.get('OAUTH_MOCK_ORIGIN')
  return origin && env.get('NODE_ENV') !== 'production' ? origin.replace(/\/+$/, '') : null
}

function credentials() {
  const clientId = env.get('DISCORD_CLIENT_ID')
  const secret = env.get('DISCORD_CLIENT_SECRET')
  if (mockOrigin()) return { clientId: clientId || 'mock-client', secret: secret || 'mock-secret' }
  return clientId && secret ? { clientId, secret } : null
}

function endpoints() {
  const mock = mockOrigin()
  if (!mock) return DISCORD
  return {
    ...DISCORD,
    authorize: `${mock}/discord/authorize`,
    token: `${mock}/discord/token`,
    identity: `${mock}/discord/identity`,
  }
}

/** Whether this server can sign people in (both env variables set, or the mock). */
export const signInAvailable = () => Boolean(credentials())

/** The redirect URL registered with Discord. */
export const callbackUrl = () => `${accountOrigin()}/auth/discord/callback`

/** What the short-lived flow cookie remembers between the redirect and the callback. */
export interface OAuthFlow {
  state: string
  next: string
  expires: number
}

export function startFlow(next: string) {
  const creds = credentials()
  if (!creds) return null
  const flow: OAuthFlow = {
    state: randomBytes(32).toString('base64url'),
    next,
    expires: Date.now() + 10 * 60_000,
  }
  const url = new URL(endpoints().authorize)
  url.searchParams.set('client_id', creds.clientId)
  url.searchParams.set('redirect_uri', callbackUrl())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', DISCORD.scope)
  url.searchParams.set('state', flow.state)
  url.searchParams.set('prompt', 'none')
  return { flow, url: url.href }
}

/** The person Discord vouches for: their stable id and the name they go by. */
export async function identify(code: string) {
  const creds = credentials()
  if (!creds) throw new Error('Sign-in provider is not configured')
  const config = endpoints()
  const exchange = await fetch(config.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.secret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl(),
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!exchange.ok) throw new Error(`OAuth code exchange failed (${exchange.status})`)
  const token = (await exchange.json()) as { access_token?: unknown }
  if (typeof token.access_token !== 'string') throw new Error('OAuth exchange gave no token')

  const response = await fetch(config.identity, {
    headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`OAuth identity failed (${response.status})`)
  const data = (await response.json()) as Record<string, unknown>
  const subject = data.id
  if (typeof subject !== 'string' || !subject || subject.length > 255) {
    throw new Error('OAuth identity has no subject')
  }
  const name = data.global_name ?? data.username
  return { subject, name: typeof name === 'string' && name.trim() ? name : 'Player' }
}

/** Only a path on this site, never another host (`//evil`, `/\evil`). */
export function safeNext(value: unknown) {
  return typeof value === 'string' &&
    value.length <= 300 &&
    /^\/(?![/\\])[A-Za-z0-9_\-./%#?=&]*$/.test(value)
    ? value
    : '/account'
}
