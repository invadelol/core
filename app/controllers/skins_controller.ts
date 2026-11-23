import type { HttpContext } from '@adonisjs/core/http'
import skinCatalogue from '#services/skins/skin_catalogue'
import { hub, listPage, searchSkins, skinPage } from '#services/skins/skin_pages'
import {
  createList,
  deleteList,
  like,
  listSkin,
  mark,
  rate,
  review,
  updateList,
} from '#services/skins/skin_social'
import { cardOf } from '#services/skins/skin_ratings'
import { browserWriter } from '#services/profiles/browser_writes'
import { meta, notFoundPage, today } from '#services/page_meta'
import {
  listValidator,
  ratingValidator,
  reviewValidator,
  skinIdValidator,
  skinSearchValidator,
  toggleValidator,
} from '#validators/skins'

const skinPath = (id: number) => `/skins/${id}`

/**
 * The skins of the game as people rate them: the hub (`/skins`, its search), a skin's page
 * (`/skins/<id>`), a list (`/skins/lists/<id>`), and the signed-in person's marks, reviews, likes
 * and lists. Skin facts come from the catalogue; "owned" only from the desktop app (§13).
 */
export default class SkinsController {
  async hub(ctx: HttpContext) {
    const query = String(ctx.request.input('q') ?? '')
      .trim()
      .slice(0, 60)
    const [data, results] = await Promise.all([
      hub(ctx.invadeUser),
      query ? searchSkins(query) : null,
    ])
    return ctx.inertia.render('skins/hub', {
      ...data,
      query,
      results,
      ...meta({
        title: 'Skins: ratings, reviews and lists',
        description:
          'Every League of Legends skin, rated by players: popular this week, reviews, lists and the best rated of all time.',
        path: '/skins',
        image: '/og/home.jpg',
        version: today(),
        alt: 'Invade skins',
      }),
    })
  }

  async show(ctx: HttpContext) {
    const { id } = await skinIdValidator.validate(ctx.params).catch(() => ({ id: 0 }))
    const data = id ? await skinPage(id, ctx.invadeUser) : null
    if (!data) return notFoundPage(ctx)
    const { skin, ratings } = data
    return ctx.inertia.render('skins/skin', {
      ...data,
      ...meta({
        title: `${skin.name}: ratings and reviews`,
        description: `${skin.name}, a ${skin.championName} skin${
          ratings.average !== null
            ? `, rated ${ratings.average} out of 5 by ${ratings.count} ${ratings.count === 1 ? 'player' : 'players'}`
            : ''
        }. Reviews, lists and chromas on Invade.`,
        path: skinPath(skin.id),
        image: `/cdn/centered/${skin.championId}-${skin.num}.jpg`,
        version: today(),
        alt: `${skin.name}'s splash art`,
      }),
    })
  }

  async list(ctx: HttpContext) {
    const data = await listPage(String(ctx.params.id), ctx.invadeUser)
    if (!data) return notFoundPage(ctx)
    return ctx.inertia.render('skins/list', {
      list: data,
      ...meta({
        title: `${data.title}, a list by ${data.owner.name}`,
        description: data.body || `${data.count} skins, listed by ${data.owner.name} on Invade.`,
        path: `/skins/lists/${data.id}`,
        image: data.posters[0]
          ? `/cdn/centered/${data.posters[0].championId}-${data.posters[0].num}.jpg`
          : '/og/home.jpg',
        version: today(),
        alt: data.title,
      }),
    })
  }

  /** `GET /api/skins/search?q=`: skins by name, champion or line, for the pickers. */
  async search(ctx: HttpContext) {
    const { q } = await skinSearchValidator.validate(ctx.request.qs())
    const catalogue = await skinCatalogue.get()
    ctx.response.header('Cache-Control', 'public, max-age=300')
    return ctx.response.ok({ skins: catalogue.search(q, 24).map(cardOf) })
  }

  async rate(ctx: HttpContext) {
    const user = await browserWriter(ctx)
    const { id } = await skinIdValidator.validate(ctx.params)
    const { rating } = await ctx.request.validateUsing(ratingValidator)
    await rate(await skinCatalogue.get(), user, id, rating)
    return ctx.response.noContent()
  }

  async like(ctx: HttpContext) {
    const user = await browserWriter(ctx)
    const { id } = await skinIdValidator.validate(ctx.params)
    const { on } = await ctx.request.validateUsing(toggleValidator)
    await mark(await skinCatalogue.get(), user, 'like', id, on)
    return ctx.response.noContent()
  }

  async wish(ctx: HttpContext) {
    const user = await browserWriter(ctx)
    const { id } = await skinIdValidator.validate(ctx.params)
    const { on } = await ctx.request.validateUsing(toggleValidator)
    await mark(await skinCatalogue.get(), user, 'wish', id, on)
    return ctx.response.noContent()
  }

  async review(ctx: HttpContext) {
    const user = await browserWriter(ctx)
    const { id } = await skinIdValidator.validate(ctx.params)
    const { body } = await ctx.request.validateUsing(reviewValidator)
    const reviewId = await review(await skinCatalogue.get(), user, id, body)
    return ctx.response.ok({ id: reviewId })
  }

  async likeReview(ctx: HttpContext) {
    const user = await browserWriter(ctx)
    const { on } = await ctx.request.validateUsing(toggleValidator)
    await like(user, 'review', ctx.params.id, on)
    return ctx.response.noContent()
  }

  async createList(ctx: HttpContext) {
    const user = await browserWriter(ctx)
    const input = await ctx.request.validateUsing(listValidator)
    return ctx.response.created({ id: await createList(user, input) })
  }

  async updateList(ctx: HttpContext) {
    const user = await browserWriter(ctx)
    const input = await ctx.request.validateUsing(listValidator)
    await updateList(user, ctx.params.id, input)
    return ctx.response.noContent()
  }

  async deleteList(ctx: HttpContext) {
    const user = await browserWriter(ctx)
    await deleteList(user, ctx.params.id)
    return ctx.response.noContent()
  }

  async listSkin(ctx: HttpContext) {
    const user = await browserWriter(ctx)
    const { id } = await skinIdValidator.validate({ id: ctx.params.skin })
    const { on } = await ctx.request.validateUsing(toggleValidator)
    await listSkin(await skinCatalogue.get(), user, ctx.params.id, id, on)
    return ctx.response.noContent()
  }

  async likeList(ctx: HttpContext) {
    const user = await browserWriter(ctx)
    const { on } = await ctx.request.validateUsing(toggleValidator)
    await like(user, 'list', ctx.params.id, on)
    return ctx.response.noContent()
  }
}
