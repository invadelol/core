import { randomBytes } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import Summoner from '#models/summoner'
import {
  change,
  deviceUser,
  digest,
  fail,
  snapshot,
  verifyDetected,
} from '#services/accounts/service'
import rateLimiter from '#services/desktop/rate_limiter'

export const accountOrigin = () =>
  (env.get('ACCOUNT_ORIGIN') || 'https://invade.lol').replace(/\/$/, '')
function user(ctx: HttpContext) {
  if (!ctx.invadeUser) throw fail('Sign in to continue.', 401)
  return ctx.invadeUser
}
export function sameOrigin(ctx: HttpContext) {
  if (ctx.request.header('origin') !== accountOrigin())
    throw fail('This request must come from invade.lol.', 403)
}
export default class AccountController {
  async page(ctx: HttpContext) {
    ctx.response.header('Cache-Control', 'private, no-store')
    if (!ctx.invadeUser)
      return ctx.response.redirect(
        `/signin?next=${encodeURIComponent(ctx.params.code ? `/account/link/${ctx.params.code}` : '/account')}`
      )
    return ctx.inertia.render('account', {
      account: await snapshot(ctx.invadeUser),
      pairingCode: ctx.params.code || null,
    })
  }
  async show(ctx: HttpContext) {
    ctx.response.header('Cache-Control', 'private, no-store')
    return ctx.response.ok(await snapshot(user(ctx)))
  }
  async mutate(ctx: HttpContext) {
    sameOrigin(ctx)
    const viewer = user(ctx)
    return ctx.response.ok(await change(viewer, ctx.request.body() as any))
  }
  async signout(ctx: HttpContext) {
    sameOrigin(ctx)
    const token = ctx.request.cookie('invade_session')
    if (typeof token === 'string')
      await db.from('invade_session').where('token_hash', digest(token)).delete()
    ctx.response.clearCookie('invade_session', { path: '/' })
    return ctx.response.redirect('/')
  }
  async pair(ctx: HttpContext) {
    const device = ctx.desktopDevice!
    const allowed = await rateLimiter.hit('account_pair', device.id, 20)
    if (!allowed.allowed) throw fail('Too many connection attempts. Try again later.', 429)
    const code = randomBytes(16).toString('hex')
    await db.from('invade_pairing').where('device_id', device.id).delete()
    await db
      .table('invade_pairing')
      .insert({
        device_id: device.id,
        code_hash: digest(code),
        expires_at: new Date(Date.now() + 10 * 60e3),
      })
    return ctx.response.created({
      url: `${accountOrigin()}/account/link/${code}`,
      expiresAt: Date.now() + 10 * 60e3,
    })
  }
  async approve(ctx: HttpContext) {
    sameOrigin(ctx)
    const viewer = user(ctx),
      code = ctx.request.input('code')
    if (typeof code !== 'string' || !/^[a-f\d]{32}$/.test(code))
      throw fail('This link is invalid or expired.', 410)
    await db.transaction(async (trx) => {
      const pair = await trx
        .from('invade_pairing')
        .where('code_hash', digest(code))
        .where('expires_at', '>', new Date())
        .whereNull('approved_at')
        .forUpdate()
        .first()
      if (!pair) throw fail('This link is invalid or expired. Start again in the desktop app.', 410)
      const device = await trx
        .from('desktop_device')
        .where('id', pair.device_id)
        .whereNull('revoked_at')
        .forUpdate()
        .first()
      if (!device) throw fail('This app is no longer available.', 410)
      const existing = await trx
        .from('invade_device_user')
        .where('device_id', pair.device_id)
        .first()
      if (existing && existing.user_id !== viewer.id)
        throw fail('This app is linked to another Invade account. Unlink it first.', 409)
      if (!existing)
        await trx
          .table('invade_device_user')
          .insert({ device_id: pair.device_id, user_id: viewer.id })
      await trx
        .from('invade_pairing')
        .where('code_hash', digest(code))
        .update({ approved_at: new Date() })
    })
    return ctx.response.ok(await snapshot(viewer))
  }
  async desktop(ctx: HttpContext) {
    const viewer = await deviceUser(ctx.desktopDevice!.id)
    ctx.response.header('Cache-Control', 'private, no-store')
    return ctx.response.ok(
      viewer
        ? await snapshot(viewer)
        : { user: null, mainPuuid: null, accounts: [], folders: [], favorites: [], devices: [] }
    )
  }
  async desktopChange(ctx: HttpContext) {
    const viewer = await deviceUser(ctx.desktopDevice!.id)
    if (!viewer) throw fail('Connect your Invade account first.', 401)
    const input = ctx.request.body() as any
    if (typeof input.puuid === 'string' && !(await Summoner.find(input.puuid))) {
      const alias = await db
        .from('riot_puuid_alias')
        .where('raw_puuid', input.puuid)
        .whereNot('status', 'conflict')
        .first()
        .catch(() => null)
      const named =
        typeof input.gameName === 'string' && typeof input.tagLine === 'string'
          ? await Summoner.query()
              .where('game_name', input.gameName)
              .where('tag_line', input.tagLine)
              .first()
          : null
      if (alias) input.puuid = alias.puuid
      else if (named) input.puuid = named.puuid
    }
    return ctx.response.ok(await change(viewer, input))
  }
  async verify(ctx: HttpContext) {
    return ctx.response.ok(
      await verifyDetected(ctx.desktopDevice!.id, ctx.request.input('rawPuuid'))
    )
  }
  async disconnect(ctx: HttpContext) {
    await db.from('invade_device_user').where('device_id', ctx.desktopDevice!.id).delete()
    return ctx.response.noContent()
  }
}
