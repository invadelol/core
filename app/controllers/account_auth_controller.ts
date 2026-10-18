import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import { fail, session } from '#services/accounts/service'
import { accountOrigin } from './account_controller.js'

type Provider = 'google' | 'discord'
const providers = {
  google: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    identity: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid profile',
  },
  discord: {
    authorize: 'https://discord.com/oauth2/authorize',
    token: 'https://discord.com/api/oauth2/token',
    identity: 'https://discord.com/api/users/@me',
    scope: 'identify',
  },
}
function config(raw: string) {
  if (raw !== 'google' && raw !== 'discord') throw fail('Unknown sign-in provider.', 404)
  const provider = raw as Provider
  const clientId = env.get(provider === 'google' ? 'GOOGLE_CLIENT_ID' : 'DISCORD_CLIENT_ID')
  const secret = env.get(provider === 'google' ? 'GOOGLE_CLIENT_SECRET' : 'DISCORD_CLIENT_SECRET')
  return {
    provider,
    ...providers[provider],
    clientId,
    secret,
    callback: `${accountOrigin()}/auth/${provider}/callback`,
  }
}
const safeNext = (value: unknown) =>
  typeof value === 'string' && /^\/(?!\/)[a-zA-Z0-9_\-/%]+$/.test(value) ? value : '/account'
const cookieOptions = () => ({
  httpOnly: true,
  secure: accountOrigin().startsWith('https:'),
  sameSite: 'lax' as const,
  path: '/',
})
export default class AccountAuthController {
  async page({ inertia, request, response }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    return inertia.render('signin', {
      next: safeNext(request.input('next')),
      authError: request.input('error') || null,
      providers: {
        google: !!env.get('GOOGLE_CLIENT_ID') && !!env.get('GOOGLE_CLIENT_SECRET'),
        discord: !!env.get('DISCORD_CLIENT_ID') && !!env.get('DISCORD_CLIENT_SECRET'),
      },
    })
  }
  async redirect(ctx: HttpContext) {
    const c = config(ctx.params.provider)
    if (!c.clientId || !c.secret) return ctx.response.redirect('/signin?error=unavailable')
    const state = randomBytes(32).toString('base64url'),
      verifier = randomBytes(32).toString('base64url')
    ctx.response.encryptedCookie(
      'invade_oauth',
      {
        state,
        verifier,
        provider: c.provider,
        next: safeNext(ctx.request.input('next')),
        expires: Date.now() + 10 * 60e3,
      },
      { ...cookieOptions(), maxAge: 600 }
    )
    const url = new URL(c.authorize)
    for (const [k, v] of Object.entries({
      client_id: c.clientId,
      redirect_uri: c.callback,
      response_type: 'code',
      scope: c.scope,
      state,
      ...(c.provider === 'google'
        ? {
            code_challenge: createHash('sha256').update(verifier).digest('base64url'),
            code_challenge_method: 'S256',
          }
        : {}),
    }))
      url.searchParams.set(k, v)
    return ctx.response.redirect(url.href)
  }
  async callback(ctx: HttpContext) {
    const c = config(ctx.params.provider),
      flow = ctx.request.encryptedCookie('invade_oauth'),
      state = ctx.request.input('state'),
      code = ctx.request.input('code')
    ctx.response.clearCookie('invade_oauth', { path: '/' })
    if (
      !flow ||
      flow.provider !== c.provider ||
      flow.expires < Date.now() ||
      typeof state !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(state) ||
      typeof code !== 'string' ||
      state.length !== flow.state?.length ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(flow.state))
    )
      return ctx.response.redirect('/signin?error=expired')
    if (!c.clientId || !c.secret) return ctx.response.redirect('/signin?error=unavailable')
    try {
      const response = await fetch(c.token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: c.clientId,
          client_secret: c.secret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: c.callback,
          ...(c.provider === 'google' ? { code_verifier: flow.verifier } : {}),
        }),
        signal: AbortSignal.timeout(10000),
      })
      if (!response.ok) throw new Error('OAuth exchange failed')
      const token = (await response.json()) as { access_token: string }
      const identity = await fetch(c.identity, {
        headers: { Authorization: `Bearer ${token.access_token}` },
        signal: AbortSignal.timeout(10000),
      })
      if (!identity.ok) throw new Error('OAuth identity failed')
      const data = (await identity.json()) as any,
        subject = c.provider === 'google' ? data.sub : data.id
      if (typeof subject !== 'string' || !subject) throw new Error('Missing provider subject')
      // Provider subject is the identity. Never merge accounts by an unverified email address.
      const rows = await db
        .knexQuery()
        .table('invade_user')
        .insert({
          provider: c.provider,
          subject,
          display_name: String(data.global_name || data.name || data.username || 'Player').slice(
            0,
            100
          ),
        })
        .onConflict(['provider', 'subject'])
        .merge(['display_name'])
        .returning('id')
      const tokenValue = await session(rows[0].id)
      ctx.response.cookie('invade_session', tokenValue, { ...cookieOptions(), maxAge: 30 * 86400 })
      return ctx.response.redirect(safeNext(flow.next))
    } catch {
      return ctx.response.redirect('/signin?error=failed')
    }
  }
}
