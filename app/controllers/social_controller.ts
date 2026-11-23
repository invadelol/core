import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import accountService from '#services/accounts/account_service'
import followService, { isFollowKind } from '#services/social/follows'
import savedService, { isSavedKind } from '#services/social/saved'
import { AccountError } from '#services/accounts/errors'
import { limit, sameOrigin, signedIn } from '#controllers/account_controller'

/** Rows a page of followers or following holds. */
const PAGE = 50
const LISTS = { followers: 'Followers', following: 'Following' } as const
type ListKind = keyof typeof LISTS

/**
 * Follows and saved items from the site's buttons: the Follow button of a person, a League
 * account or a pro (answers whether the visitor follows, and how many do), the star of a clip or
 * a match, and the lists of a person's followers and of who they follow. Writes are the signed-in
 * visitor's, from the site itself; the lists are public.
 */
export default class SocialController {
  async follow(ctx: HttpContext) {
    return this.setFollow(ctx, true)
  }

  async unfollow(ctx: HttpContext) {
    return this.setFollow(ctx, false)
  }

  private async setFollow(ctx: HttpContext, on: boolean) {
    sameOrigin(ctx)
    const user = signedIn(ctx)
    await limit('follows:user', user.id, 300)
    const { kind, id } = ctx.params
    if (!isFollowKind(kind)) throw AccountError.invalid('Unknown person or player to follow.')
    await db.transaction(async (trx) => {
      await trx.from('invade_user').where('id', user.id).forUpdate().firstOrFail()
      if (on) await followService.follow(trx, user.id, kind, id)
      else await followService.unfollow(trx, user.id, kind, id)
    })
    ctx.response.header('Cache-Control', 'no-store')
    return ctx.response.ok(await followService.state(user.id, kind, id))
  }

  async save(ctx: HttpContext) {
    return this.setSaved(ctx, true)
  }

  async unsave(ctx: HttpContext) {
    return this.setSaved(ctx, false)
  }

  private async setSaved(ctx: HttpContext, on: boolean) {
    sameOrigin(ctx)
    const user = signedIn(ctx)
    await limit('saved:user', user.id, 300)
    const { kind, id } = ctx.params
    if (!isSavedKind(kind)) throw AccountError.invalid('Unknown item.')
    await db.transaction(async (trx) => {
      await trx.from('invade_user').where('id', user.id).forUpdate().firstOrFail()
      if (on) await savedService.save(trx, user.id, kind, id, ctx.request.input('puuid'))
      else await savedService.unsave(trx, user.id, kind, id)
    })
    ctx.response.header('Cache-Control', 'no-store')
    return ctx.response.ok({ saved: on })
  }

  /** The stars of a page: what the signed-in visitor keeps. */
  async savedKeys(ctx: HttpContext) {
    const user = signedIn(ctx)
    ctx.response.header('Cache-Control', 'no-store')
    return ctx.response.ok(await savedService.keys(user.id))
  }

  /** `GET /api/users/:handle/:list`: a page of followers or following. */
  async list(ctx: HttpContext) {
    const list = ctx.params.list as ListKind
    const person = Object.hasOwn(LISTS, list)
      ? await accountService.byHandle(ctx.params.handle)
      : null
    if (!person) throw AccountError.notFound('No one has this handle.')
    ctx.response.header('Cache-Control', 'private, no-store')
    return ctx.response.ok(await this.page(list, person.id, ctx))
  }

  /** `/u/:handle/followers` and `/u/:handle/following`. */
  async listPage(ctx: HttpContext) {
    const list = ctx.params.list as ListKind
    const person = Object.hasOwn(LISTS, list)
      ? await accountService.byHandle(ctx.params.handle)
      : null
    if (!person) {
      ctx.response.status(404)
      return ctx.inertia.render('errors/not_found', { error: { status: 404, message: null } })
    }
    const [page, counts] = await Promise.all([
      this.page(list, person.id, ctx),
      followService.counts(person.id),
    ])
    return ctx.inertia.render('social/follow_list', {
      person,
      list,
      page,
      counts: { followers: counts.followers, following: counts.following },
      robots: 'noindex, follow',
    })
  }

  private page(list: ListKind, personId: string, ctx: HttpContext) {
    const options = { limit: PAGE, cursor: ctx.request.input('cursor') }
    const viewerId = ctx.invadeUser?.id ?? null
    return list === 'followers'
      ? followService.followers('user', personId, viewerId, options)
      : this.followingOf(personId, viewerId, options)
  }

  /** Who a person follows, each marked when the visitor follows it too. */
  private async followingOf(
    personId: string,
    viewerId: string | null,
    options: { limit: number; cursor?: unknown }
  ) {
    const page = await followService.following(personId, options)
    if (!viewerId)
      return { ...page, items: page.items.map((c) => ({ ...c, viewerFollows: false })) }
    const mine = await db
      .from('invade_follow')
      .where('follower_id', viewerId)
      .whereIn(
        'target_id',
        page.items.map((c) => c.id)
      )
      .select('target_kind', 'target_id')
    const followed = new Set(mine.map((f) => `${f.target_kind}:${f.target_id}`))
    return {
      ...page,
      items: page.items.map((c) => ({ ...c, viewerFollows: followed.has(`${c.kind}:${c.id}`) })),
    }
  }
}
