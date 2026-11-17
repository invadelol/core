import type { HttpContext } from '@adonisjs/core/http'
import summonerService from '#services/summoner_service'
import riotAssets from '#services/riot/assets'
import { RENDERER, renderShareCard, type ShareCardInput } from '#services/share_card'
import { ByteCache } from '#utils/byte_cache'
import { rankFromCore, rankLabel, rankValue } from '@invadelol/ui/logic'
import {
  championLines,
  linesFor,
  parseCard,
  windowLabel,
  type CardData,
  type CardRank,
} from '../../inertia/lib/share_card.js'

/** A card is drawn again at most every five minutes: a shared link keeps up with the player. */
const TTL = 300_000
const cards = new ByteCache<Buffer>(48 * 1024 * 1024, 256)
const pending = new Map<string, Promise<Buffer>>()

const DAY = 864e5
/** A stored rank as the ranks service serializes it. */
interface RankRow {
  queueType: string
  tier: string
  division: string | null
  leaguePoints: number
  wins: number
  losses: number | null
  fetchedAt: string | null
}
const regionOf = (platform: string) =>
  ({
    EUW1: 'EUW',
    EUN1: 'EUNE',
    NA1: 'NA',
    KR: 'KR',
    BR1: 'BR',
    LA1: 'LAN',
    LA2: 'LAS',
    OC1: 'OCE',
    TR1: 'TR',
    RU: 'RU',
    JP1: 'JP',
    ME1: 'ME',
    SG2: 'SEA',
    TW2: 'TW',
    VN2: 'VN',
  })[platform] ?? platform

async function bytes(kind: Parameters<typeof riotAssets.get>[0], id: string) {
  const asset = await riotAssets.get(kind, id).catch(() => null)
  return asset && !asset.placeholder ? Buffer.from(asset.body) : null
}

/**
 * `/card/:summoner/:design.png`: the profile's share card, drawn from the day's data with the
 * settings its link carries (`?q=` queue, `n=` games, `l=` lines, `c=` champion, `s=` skin).
 */
export default class ShareCardsController {
  async show({ params, request, response }: HttpContext) {
    const profile = await summonerService.findStoredProfile(params.summoner)
    if (!profile) return response.notFound()
    const s = parseCard(params.design, request.qs())
    const day = new Date().toISOString().slice(0, 10)
    const key = JSON.stringify([
      RENDERER,
      profile.puuid,
      profile.gameName,
      profile.tagLine,
      profile.profileIconId,
      s,
      day,
    ])

    let body = cards.get(key)
    if (!body) {
      let job = pending.get(key)
      if (!job) {
        job = (async () => {
          const [stats, ranks] = await Promise.all([
            summonerService
              .getStats(profile.puuid, {
                count: s.count,
                type: s.queue === 'all' ? undefined : s.queue,
              })
              .catch(() => null),
            summonerService.getRanks(profile.puuid).catch(() => null),
          ])
          const played = [...(stats?.champions ?? [])].sort((a, b) => b.games - a.games)

          /* The rank of the card's queue, and its LP over the last 30 days. */
          const wanted = s.queue === 'flex' ? 'RANKED_FLEX_SR' : 'RANKED_SOLO_5x5'
          const current = ((ranks?.current ?? []) as unknown as RankRow[]).filter((r) => r.tier)
          const history = (ranks?.history ?? []) as unknown as RankRow[]
          const row =
            current.find((r) => r.queueType === wanted) ??
            current.find(
              (r) => r.queueType === 'RANKED_SOLO_5x5' || r.queueType === 'RANKED_FLEX_SR'
            )
          const ladder = (r: { tier: string; division: string | null; leaguePoints: number }) => {
            const v = rankValue(rankFromCore(r as never))
            return v === null ? null : Math.round(v * 100)
          }
          const rank: CardRank | null = row
            ? {
                name: rankLabel(rankFromCore(row as never), false),
                tier: row.tier.toLowerCase(),
                lp: row.leaguePoints,
                queue: row.queueType === 'RANKED_FLEX_SR' ? 'Flex' : 'Solo/Duo',
              }
            : null
          let lp: { days: number[]; gain: number } | null = null
          if (row) {
            const pts = history
              .filter((r) => r.queueType === row.queueType && r.tier && r.fetchedAt)
              .map((r) => ({ t: new Date(String(r.fetchedAt)).getTime(), v: ladder(r) }))
              .filter((p): p is { t: number; v: number } => p.v !== null)
              .sort((a, b) => a.t - b.t)
            const first = Date.now() - 29 * DAY
            const inside = pts.filter((p) => p.t >= first)
            if (inside.length >= 2) {
              let prev = pts.filter((p) => p.t < first).at(-1)?.v ?? inside[0].v
              const start = prev
              const days: number[] = []
              for (let i = 0; i < 30; i++) {
                const d = inside.filter(
                  (p) => p.t >= first + i * DAY && p.t < first + (i + 1) * DAY
                )
                if (d.length) prev = d.at(-1)!.v
                days.push(prev)
              }
              lp = { days, gain: days.at(-1)! - start }
            }
          }

          /* The art: the champion asked for, else the most played of the window. */
          const champion =
            s.kind === 'champion'
              ? (played.find((c) => c.championId === s.champion) ?? played[0])
              : null
          const art =
            s.kind === 'champion' && champion
              ? champion.championId
              : s.champion || played[0]?.championId || 0
          const skin = art === s.champion ? s.skin : 0
          const names = await riotAssets
            .names('champion')
            .catch(() => ({}) as Record<string, string>)
          const tiers = rank ? [rank.tier] : []
          const [icon, splash, ...emblems] = await Promise.all([
            champion
              ? bytes('champion', String(champion.championId))
              : bytes('profile-icon', String(profile.profileIconId ?? 29)),
            art ? bytes('splash', skin ? `${art}-${skin}` : String(art)) : null,
            ...tiers.map((t) => bytes('emblem', t)),
          ])

          const total = stats?.global.total ?? 0
          const data: CardData = { figures: stats?.global ?? null, role: null, rank }
          const region = regionOf(profile.platform)
          const input: ShareCardInput = {
            format: s.format,
            kind: s.kind,
            title: profile.gameName,
            subtitle: `#${profile.tagLine}${region ? ` · ${region}` : ''}`,
            icon,
            splash,
            kicker: total ? windowLabel(total, s.queue) : 'No games in this window',
            kickerRight: '',
            lines: linesFor(data, s.lines),
            emblems: Object.fromEntries(tiers.map((t, i) => [t, emblems[i]])),
            date: new Date().toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }),
          }
          if (s.kind === 'ranked' && rank && row) {
            const games = row.losses === null ? 0 : row.wins + row.losses
            input.kicker = `Ranked ${rank.queue}`
            input.kickerRight = games
              ? `${row.wins}W ${row.losses}L · ${Math.round((row.wins / games) * 100)}%`
              : ''
            input.ranked = {
              tier: rank.tier,
              name: rank.name,
              lp: rank.lp,
              days: lp?.days ?? [],
              gain: lp?.gain ?? 0,
            }
          } else if (s.kind === 'champion' && champion) {
            input.title = names[String(champion.championId)] ?? 'Champion'
            input.subtitle = `${profile.gameName} #${profile.tagLine}`
            input.kicker = total
              ? `Most played, ${windowLabel(total, s.queue).replace(/^Last /, 'last ')}`
              : 'Most played'
            input.lines = championLines(champion)
          } else {
            input.kind = 'stats'
          }
          const png = await renderShareCard(input)
          cards.set(key, png, png.byteLength, TTL)
          return png
        })().finally(() => pending.delete(key))
        pending.set(key, job)
      }
      body = await job
    }
    response.header('Content-Type', 'image/png')
    response.header('Cache-Control', 'public, max-age=300')
    response.header('Access-Control-Allow-Origin', '*')
    return response.send(body)
  }
}
