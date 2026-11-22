import type { HttpContext } from '@adonisjs/core/http'
import clipService, { posterKey, videoKey } from '#services/clips/clip_service'
import { clipStore } from '#services/clips/storage'
import matchRepository from '#services/analytics/match_repository'
import { sameOrigin } from '#controllers/account_controller'
import { AccountError } from '#services/accounts/errors'
import { FixedWindowLimiter } from '#services/desktop/rate_limiter'
import { accountOrigin } from '#services/accounts/session_service'
import type { Clip } from '../../inertia/lib/clip_types.js'

const views = new FixedWindowLimiter('clip:view:')
const FILE = /^([A-Za-z0-9]{10})\.(mp4|jpg)$/

const EVENT_WORD: Record<Clip['event'], string> = {
  kill: 'Kill',
  death: 'Death',
  assist: 'Assist',
  objective: 'Objective',
  manual: 'Clip',
}
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** The match strip under the video: both fives, the result, the game's length. */
async function strip(matchId: string) {
  const match = await matchRepository.getSummaryById(matchId).catch(() => null)
  if (!match) return null
  interface Seat {
    championId: number
    puuid: string
    gameName: string
    tagLine: string
    kills: number
  }
  const side = (teamId: number): Seat[] =>
    match.participants
      .filter((p: any) => Number(p.teamId) === teamId)
      .map((p: any) => ({
        championId: Number(p.championId),
        puuid: p.puuid as string,
        gameName: (p.riotIdGameName ?? p.gameName ?? '') as string,
        tagLine: (p.riotIdTagLine ?? p.tagLine ?? '') as string,
        kills: Number(p.kills) || 0,
      }))
  const blue = side(100)
  const red = side(200)
  return {
    matchId,
    queueId: Number(match.queueId),
    gameStartMs: Number(match.gameStartMs),
    duration: Number(match.duration),
    blueWon: Boolean(Number(match.t1Win)),
    blue,
    red,
    score: [blue, red].map((t) => t.reduce((sum: number, p: Seat) => sum + p.kills, 0)),
  }
}

/**
 * Clips on the site: a clip's page (the video first, its match under it), its video and picture,
 * the lists the match page and a profile show, and deletion by its owner.
 */
export default class ClipsController {
  async page(ctx: HttpContext) {
    const clip = await clipService.find(ctx.params.id, ctx.invadeUser)
    if (!clip) return ctx.response.notFound()
    const [match, game] = await Promise.all([
      strip(clip.matchId),
      clipService.ofMatch(clip.matchId, ctx.invadeUser),
    ])
    if (!clip.mine) {
      const first = await views.hit(clip.id, ctx.request.ip(), 1, 86_400)
      if (first.allowed) await clipService.viewed(clip.id).catch(() => {})
    }
    const who = clip.player.gameName ? `${clip.player.gameName}#${clip.player.tagLine}` : 'A player'
    const line = `${EVENT_WORD[clip.event]} at ${clock(clip.gameTime)} in the game, ${Math.round(clip.durationMs / 1000)} seconds`
    return ctx.inertia.render('clips/clip', {
      clip,
      match,
      others: game.filter((c: Clip) => c.id !== clip.id),
      robots: clip.visibility === 'link' ? 'noindex, nofollow' : undefined,
      description: `${clip.title}: ${line}, posted by ${who} on Invade.`,
      social: {
        type: 'video.other',
        title: clip.title,
        description: `${line}. ${who}.`,
        url: clip.url,
        canonical: clip.url,
        image: `${accountOrigin()}${clip.poster ?? '/og/home.jpg'}`,
        imageType: clip.poster ? 'image/jpeg' : 'image/jpeg',
        imageWidth: clip.width ?? 1280,
        imageHeight: clip.height ?? 720,
        alt: clip.title,
        video: {
          url: `${accountOrigin()}${clip.video}`,
          width: clip.width ?? 1280,
          height: clip.height ?? 720,
        },
      },
    })
  }

  /** `/clips/<id>.mp4` and `/clips/<id>.jpg`: from the disk with byte ranges, or the storage's address. */
  async file({ params, request, response }: HttpContext) {
    const parts = FILE.exec(String(params.file ?? ''))
    if (!parts) return response.notFound()
    const [, id, ext] = parts
    // Any clip that is posted, whatever its visibility: the address is the clip's own.
    const clip = await clipService.find(id, null)
    if (!clip || (ext === 'jpg' && !clip.poster)) return response.notFound()
    const key = ext === 'mp4' ? videoKey(id) : posterKey(id)
    const store = clipStore()
    const remote = await store.url(key)
    if (remote) return response.redirect(remote)

    const range = /^bytes=(\d*)-(\d*)$/.exec(request.header('range') ?? '')
    const wanted = range
      ? { start: range[1] ? Number(range[1]) : 0, end: range[2] ? Number(range[2]) : undefined }
      : undefined
    const file = await store.read(key, wanted)
    if (!file) return response.notFound()
    response.header('Content-Type', ext === 'mp4' ? 'video/mp4' : 'image/jpeg')
    response.header('Accept-Ranges', 'bytes')
    // Not for shared caches: a deleted clip must stop playing.
    response.header('Cache-Control', 'private, max-age=3600')
    response.header('Content-Length', String(file.end - file.start + 1))
    if (range) {
      response.header('Content-Range', `bytes ${file.start}-${file.end}/${file.size}`)
      response.status(206)
    }
    return response.stream(file.stream)
  }

  /** `?match=<id>` (the match page) or `?puuid=<id>` (a profile): the public clips. */
  async list({ request, response, invadeUser }: HttpContext) {
    const match = request.input('match')
    const puuid = request.input('puuid')
    response.header('Cache-Control', 'private, no-cache')
    if (typeof match === 'string' && /^[A-Z0-9]{2,5}_\d{5,15}$/.test(match)) {
      return response.ok({ clips: await clipService.ofMatch(match, invadeUser) })
    }
    if (typeof puuid === 'string' && /^[A-Za-z0-9_-]{20,100}$/.test(puuid)) {
      return response.ok({ clips: await clipService.ofPlayer(puuid, invadeUser) })
    }
    return response.ok({ clips: [] })
  }

  async destroy(ctx: HttpContext) {
    sameOrigin(ctx)
    if (!ctx.invadeUser) throw AccountError.signedOut()
    await clipService.remove(ctx.invadeUser, ctx.params.id)
    return ctx.response.noContent()
  }
}
