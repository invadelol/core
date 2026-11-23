import type { HttpContext } from '@adonisjs/core/http'
import { queueName } from '@invadelol/ui/logic'
import clipService, { CLIP_ID } from '#services/clips/clip_service'
import commentService from '#services/clips/comments'
import { clipMatch } from '#services/clips/clip_match'
import { CLIP_FILES, clipKey, clipStore, localUploadKey } from '#services/clips/storage'
import { renderClipCover } from '#services/clips/cover'
import { H as COVER_H, W as COVER_W } from '#services/og/kit'
import riotAssets from '#services/riot/assets'
import followService from '#services/social/follows'
import { limit, sameOrigin, signedIn } from '#controllers/account_controller'
import { AccountError } from '#services/accounts/errors'
import { FixedWindowLimiter } from '#services/desktop/rate_limiter'
import { accountOrigin } from '#services/accounts/session_service'
import type { Clip, ClipMatch } from '../../inertia/lib/clip_types.js'

const views = new FixedWindowLimiter('clip:view:')
const FILE = /^([A-Za-z0-9]{10})\.(mp4|jpg)$/
const clock = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** A clip the visitor may watch, or the site's 404. */
async function watchable(ctx: HttpContext): Promise<Clip> {
  const clip = await clipService.find(ctx.params.id, ctx.invadeUser?.id ?? null)
  if (!clip) throw AccountError.notFound('This clip is not available.')
  return clip
}

/**
 * The link preview's words: who on what, what happened and when, then how the game went ("Ember on
 * Ezreal, solo kill on Lee Sin at 9:12. Victory in 31:24, Ranked Solo/Duo.").
 */
async function describe(clip: Clip, card: ClipMatch | null) {
  const names = await riotAssets.names('champion').catch((): Record<string, string> => ({}))
  const champion = names[clip.championId] ?? 'a champion'
  const what = clip.moment
    ? `${clip.moment.charAt(0).toLowerCase()}${clip.moment.slice(1)} at ${clock(clip.momentAt ?? clip.startMs)}`
    : `at ${clock(clip.startMs)} in the game`
  const seat = card?.match.participants.find((p) => p.puuid === card.puuid)
  const game =
    card && seat
      ? ` ${seat.win ? 'Victory' : 'Defeat'} in ${clock(card.match.duration * 1000)}, ${queueName(card.match.queueId)}.`
      : ''
  return `${clip.author.name} on ${champion}, ${what}.${game}`
}

/**
 * Clips on the site: a clip's page (the video, what happened in it, its comments, its match),
 * its files, the lists of a match and a League account, the comments and GGs, its owner's
 * controls, its link preview's cover, and the local stand-in for the storage's upload addresses.
 */
export default class ClipsController {
  async page(ctx: HttpContext) {
    const clip = await clipService.find(ctx.params.id, ctx.invadeUser?.id ?? null)
    if (!clip) {
      ctx.response.status(404)
      return ctx.inertia.render('errors/not_found', { error: { status: 404, message: null } })
    }
    const viewerId = ctx.invadeUser?.id ?? null
    const [match, game, comments, canComment, follow] = await Promise.all([
      clipMatch(clip),
      clipService.ofMatch(clip.matchId, viewerId),
      commentService.list(clip, viewerId),
      this.canComment(clip, viewerId),
      followService.state(viewerId, 'user', clip.author.id),
    ])
    if (!clip.mine) {
      const first = await views.hit(clip.id, ctx.request.ip(), 1, 86_400)
      if (first.allowed) await clipService.viewed(clip.id).catch(() => {})
    }
    const cover = `${accountOrigin()}/og/clip/${clip.id}.jpg`
    const description = await describe(clip, match)
    return ctx.inertia.render('clips/clip', {
      clip,
      match,
      others: game.filter((c) => c.id !== clip.id),
      comments,
      canComment,
      follow,
      robots: clip.visibility === 'everyone' ? undefined : 'noindex, nofollow',
      description,
      social: {
        type: 'video.other',
        title: clip.title,
        description,
        url: clip.url,
        canonical: clip.url,
        image: cover,
        imageType: 'image/jpeg',
        imageWidth: COVER_W,
        imageHeight: COVER_H,
        alt: `${clip.title}: ${clip.moment ?? 'a moment'} at ${clock(clip.momentAt ?? clip.startMs)}`,
        video: { url: `${accountOrigin()}${clip.video}`, width: 1280, height: 720 },
      },
    })
  }

  /** Whether the visitor may comment: signed in, and as the clip's rule says. */
  private async canComment(clip: Clip, viewerId: string | null) {
    if (!viewerId) return false
    if (clip.mine || clip.comments === 'everyone') return true
    if (clip.comments === 'off') return false
    return (await commentService.championIn(viewerId, clip.matchId)) !== null
  }

  /**
   * `/clips/<id>.mp4` and `/clips/<id>.jpg`: a signed address of the storage, or the local file
   * with byte ranges. Never in a shared cache: a deleted clip must stop playing.
   */
  async file({ params, request, response, invadeUser }: HttpContext) {
    const parts = FILE.exec(String(params.file ?? ''))
    if (!parts) return response.notFound()
    const [, id, ext] = parts
    const clip = await clipService.find(id, invadeUser?.id ?? null)
    if (!clip) return response.notFound()
    const key = clipKey(id, ext === 'mp4' ? 'video' : 'poster')
    const store = clipStore()
    response.header('Cache-Control', 'private, max-age=3600')
    const remote = await store.url(key)
    if (remote) return response.redirect(remote)

    const range = /^bytes=(\d*)-(\d*)$/.exec(request.header('range') ?? '')
    const wanted = range
      ? { start: range[1] ? Number(range[1]) : 0, end: range[2] ? Number(range[2]) : undefined }
      : undefined
    const file = await store.read(key, wanted)
    if (!file) return response.notFound()
    response.header('Content-Type', ext === 'mp4' ? CLIP_FILES.video.type : CLIP_FILES.poster.type)
    response.header('Accept-Ranges', 'bytes')
    response.header('Content-Length', String(file.end - file.start + 1))
    if (range) {
      response.header('Content-Range', `bytes ${file.start}-${file.end}/${file.size}`)
      response.status(206)
    }
    return response.stream(file.stream)
  }

  /** The link preview's cover, 1280 x 720: the title, the duel, the moment. */
  async cover({ params, response }: HttpContext) {
    const id = /^([A-Za-z0-9]{10})\.jpg$/.exec(String(params.file ?? ''))?.[1]
    // A link-only clip has a preview too: whoever has the link may share it.
    const clip = id ? await clipService.find(id, null) : null
    if (!clip) return response.notFound()
    response.header('Content-Type', 'image/jpeg')
    response.header('Cache-Control', 'public, max-age=3600')
    return response.send(await renderClipCover(clip))
  }

  /** `?match=<id>` (the match page) or `?puuid=<id>` (a League profile): the public clips. */
  async list({ request, response, invadeUser }: HttpContext) {
    const match = request.input('match')
    const puuid = request.input('puuid')
    const viewerId = invadeUser?.id ?? null
    response.header('Cache-Control', 'private, no-cache')
    if (typeof match === 'string' && /^[A-Z0-9]{2,6}_\d{1,15}$/.test(match)) {
      return response.ok({ clips: await clipService.ofMatch(match, viewerId) })
    }
    if (typeof puuid === 'string' && /^[A-Za-z0-9_-]{20,100}$/.test(puuid)) {
      return response.ok({ clips: await clipService.ofPlayer(puuid, viewerId) })
    }
    return response.ok({ clips: [] })
  }

  /** Its owner: who may watch it, who may comment. */
  async update(ctx: HttpContext) {
    sameOrigin(ctx)
    const user = signedIn(ctx)
    await clipService.edit(user, ctx.params.id, ctx.request.only(['visibility', 'comments']))
    return ctx.response.ok(await clipService.find(ctx.params.id, user.id))
  }

  async pin(ctx: HttpContext) {
    sameOrigin(ctx)
    const user = signedIn(ctx)
    await clipService.pin(user, ctx.params.id, ctx.request.method() === 'PUT')
    return ctx.response.noContent()
  }

  async destroy(ctx: HttpContext) {
    sameOrigin(ctx)
    await clipService.remove(signedIn(ctx), ctx.params.id)
    return ctx.response.noContent()
  }

  /** A comment or a reply; answers the clip's comments as they now are. */
  async comment(ctx: HttpContext) {
    sameOrigin(ctx)
    const user = signedIn(ctx)
    await limit('comments:user', user.id, 120)
    const clip = await watchable(ctx)
    await commentService.add(user, clip, ctx.request.only(['body', 'parentId', 'atMs']))
    return ctx.response.ok({ comments: await commentService.list(clip, user.id) })
  }

  async uncomment(ctx: HttpContext) {
    sameOrigin(ctx)
    const user = signedIn(ctx)
    const clip = await watchable(ctx)
    await commentService.remove(user, clip, ctx.params.comment)
    return ctx.response.ok({ comments: await commentService.list(clip, user.id) })
  }

  /** A GG on the clip (`/gg`) or one of its comments (`/comments/:comment/gg`), or none. */
  async gg(ctx: HttpContext) {
    sameOrigin(ctx)
    const user = signedIn(ctx)
    await limit('gg:user', user.id, 600)
    const clip = await watchable(ctx)
    const target = ctx.params.comment
      ? { kind: 'comment' as const, id: String(ctx.params.comment) }
      : { kind: 'clip' as const, id: clip.id }
    return ctx.response.ok(
      await commentService.gg(user, clip, target, ctx.request.method() === 'PUT')
    )
  }

  /**
   * The local stand-in for the storage's signed upload addresses (development): the app sends a
   * clip's file here on the address `create` gave it.
   */
  async upload({ request, response, desktopRawBody }: HttpContext) {
    const store = clipStore()
    const key = store.kind === 'local' ? localUploadKey(request.qs()) : null
    if (!key || !CLIP_ID.test(key.split('/')[1])) return response.forbidden()
    await store.put(key, desktopRawBody ?? Buffer.alloc(0))
    return response.ok({ ok: true })
  }
}
