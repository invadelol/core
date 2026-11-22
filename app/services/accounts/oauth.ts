import { createHash, randomBytes } from 'node:crypto'
import env from '#start/env'
import { accountOrigin } from '#services/accounts/session_service'
import type { AccountProvider } from '../../../inertia/lib/account_types.js'

/**
 * Sign-in with Discord and Google (OAuth 2.0 authorization code). Only the provider's stable id
 * and a display name are read: Discord's `identify` scope, Google's `openid profile`. No e-mail
 * address, no token kept: the access token is used once, for the identity, and dropped.
 */

interface ProviderConfig {
  authorize: string
  token: string
  identity: string
  scope: string
  /** Google takes PKCE; Discord's confidential clients use the secret and `state`. */
  pkce: boolean
}

const PROVIDERS: Record<AccountProvider, ProviderConfig> = {
  discord: {
    authorize: 'https://discord.com/oauth2/authorize',
    token: 'https://discord.com/api/oauth2/token',
    identity: 'https://discord.com/api/users/@me',
    scope: 'identify',
    pkce: false,
  },
  google: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    identity: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid profile',
    pkce: true,
  },
}

export const isProvider = (value: unknown): value is AccountProvider =>
  value === 'discord' || value === 'google'

/**
 * A local stand-in for both providers (`OAUTH_MOCK_ORIGIN`, e.g. `http://127.0.0.1:3364` served
 * by `scripts/oauth_mock.mjs`), never in production: the whole flow runs, minus Discord and
 * Google themselves.
 */
function mockOrigin() {
  const origin = env.get('OAUTH_MOCK_ORIGIN')
  return origin && env.get('NODE_ENV') !== 'production' ? origin.replace(/\/+$/, '') : null
}

function credentials(provider: AccountProvider) {
  const clientId =
    provider === 'discord' ? env.get('DISCORD_CLIENT_ID') : env.get('GOOGLE_CLIENT_ID')
  const secret =
    provider === 'discord' ? env.get('DISCORD_CLIENT_SECRET') : env.get('GOOGLE_CLIENT_SECRET')
  if (mockOrigin()) return { clientId: clientId || 'mock-client', secret: secret || 'mock-secret' }
  return clientId && secret ? { clientId, secret } : null
}

export function providerConfig(provider: AccountProvider): ProviderConfig {
  const mock = mockOrigin()
  if (!mock) return PROVIDERS[provider]
  return {
    ...PROVIDERS[provider],
    authorize: `${mock}/${provider}/authorize`,
    token: `${mock}/${provider}/token`,
    identity: `${mock}/${provider}/identity`,
  }
}

/** Which providers this server can sign in with (both env variables set, or the mock). */
export function availableProviders(): Record<AccountProvider, boolean> {
  return { discord: Boolean(credentials('discord')), google: Boolean(credentials('google')) }
}

/** The redirect URL registered with the provider. */
export const callbackUrl = (provider: AccountProvider) =>
  `${accountOrigin()}/auth/${provider}/callback`

/** What the short-lived flow cookie remembers between the redirect and the callback. */
export interface OAuthFlow {
  provider: AccountProvider
  state: string
  verifier: string
  next: string
  expires: number
}

export function startFlow(provider: AccountProvider, next: string) {
  const creds = credentials(provider)
  if (!creds) return null
  const config = providerConfig(provider)
  const flow: OAuthFlow = {
    provider,
    state: randomBytes(32).toString('base64url'),
    verifier: randomBytes(32).toString('base64url'),
    next,
    expires: Date.now() + 10 * 60_000,
  }
  const url = new URL(config.authorize)
  url.searchParams.set('client_id', creds.clientId)
  url.searchParams.set('redirect_uri', callbackUrl(provider))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', config.scope)
  url.searchParams.set('state', flow.state)
  if (provider === 'discord') url.searchParams.set('prompt', 'none')
  if (config.pkce) {
    url.searchParams.set(
      'code_challenge',
      createHash('sha256').update(flow.verifier).digest('base64url')
    )
    url.searchParams.set('code_challenge_method', 'S256')
  }
  return { flow, url: url.href }
}

/** The person the provider vouches for: its stable id and the name it gives. */
export async function identify(flow: OAuthFlow, code: string) {
  const creds = credentials(flow.provider)
  if (!creds) throw new Error('Sign-in provider is not configured')
  const config = providerConfig(flow.provider)
  const exchange = await fetch(config.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.secret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl(flow.provider),
      ...(config.pkce ? { code_verifier: flow.verifier } : {}),
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
  const subject = flow.provider === 'google' ? data.sub : data.id
  if (typeof subject !== 'string' || !subject || subject.length > 255) {
    throw new Error('OAuth identity has no subject')
  }
  // Google's `name` is a full legal name more often than not: the given name is enough here.
  const name =
    flow.provider === 'discord'
      ? (data.global_name ?? data.username)
      : (data.given_name ?? data.name)
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
