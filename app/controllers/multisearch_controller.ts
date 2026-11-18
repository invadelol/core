import type { HttpContext } from '@adonisjs/core/http'
import { rankFromCore, rankLabel, rankValue } from '@invadelol/ui/logic'
import summonerService from '#services/summoner_service'
import riotAssets from '#services/riot/assets'
import { RENDERER, renderLobbyCard, type LobbySeat } from '#services/lobby_card'
import { ByteCache } from '#utils/byte_cache'
import {
  multisearchPath,
  parseRiotIds,
  MULTISEARCH_REGIONS,
} from '../../inertia/lib/multisearch.js'
import type { RiotIdentity } from '../../inertia/lib/multisearch.js'

const DESCRIPTION =
  'Scout a whole League of Legends lobby at once: paste champion select and see the rank, recent games, main role and champions of every player side by side.'

/** A lobby's preview is drawn again at most every ten minutes. */
const cards = new ByteCache<Buffer>(32 * 1024 * 1024, 256)
const pending = new Map<string, Promise<Buffer>>()

interface RankRow {
  queueType: string
  tier: string
  division: string | null
  leaguePoints: number
}

const origin = (request: HttpContext['request']) => {
  const host = request.host() ?? 'invade.lol'
  return host.endsWith('invade.lol') ? `https://${host}` : `${request.protocol()}://${host}`
}

export default class MultisearchController {
  /**
   * `/multisearch/:region?summoners=Name#TAG,Name#TAG`: the players are read from the address here
   * so the page draws their cards from its first paint; each card then loads its own player. An
   * unknown region is dropped rather than refused, so an op.gg link with ours swapped in still works.
   */
  async show({ inertia, params, request, response }: HttpContext) {
    const raw = String(params.region ?? '').toLowerCase()
    const region = (MULTISEARCH_REGIONS as readonly string[]).includes(raw) ? raw : null
    if (raw && !region) {
      return response.redirect(multisearchPath(this.players(request), null), false, 302)
    }

    // The players come from the site's search or the page's own field (Riot IDs separated by
    // commas): with none, the page opens on its empty field.
    const players = this.players(request)
    const base = origin(request)
    const names = players.map((p) => p.gameName)
    const image = `${base}/og/multisearch.jpg${players.length ? `?summoners=${encodeURIComponent(players.map((p) => `${p.gameName}#${p.tagLine}`).join(','))}` : ''}`

    return inertia.render('multisearch', {
      players,
      region,
      description: DESCRIPTION,
      social: {
        type: 'website',
        title: players.length
          ? `${names.slice(0, 3).join(', ')}${names.length > 3 ? ` and ${names.length - 3} more` : ''} | Lobby scout, invade.lol`
          : 'Multisearch: scout your League of Legends lobby | invade.lol',
        description: players.length
          ? `Rank, recent games, main role and champions of ${names.length === 1 ? names[0] : `${names.length} players`} side by side.`
          : DESCRIPTION,
        url: `https://invade.lol${multisearchPath(players, region)}`,
        canonical: 'https://invade.lol/multisearch',
        image,
        imageType: 'image/jpeg',
        alt: players.length
          ? `The lobby: ${names.join(', ')}, with their ranks`
          : 'Five empty seats waiting for a lobby, and a sleepy poro',
      },
      // A lobby is a moment, not a page to index: it still shows its card when shared.
      robots: players.length ? 'noindex, follow' : undefined,
      jsonld: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          'name': 'invade.lol Multisearch',
          'url': 'https://invade.lol/multisearch',
          'applicationCategory': 'GameApplication',
          'operatingSystem': 'Any',
          'description': DESCRIPTION,
          'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'EUR' },
          'isPartOf': { '@type': 'WebSite', 'name': 'invade.lol', 'url': 'https://invade.lol' },
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          'itemListElement': [
            {
              '@type': 'ListItem',
              'position': 1,
              'name': 'invade.lol',
              'item': 'https://invade.lol',
            },
            {
              '@type': 'ListItem',
              'position': 2,
              'name': 'Multisearch',
              'item': 'https://invade.lol/multisearch',
            },
          ],
        },
      ],
    })
  }

  /**
   * `/og/multisearch.jpg?summoners=…`: the lobby's link preview, from stored players only (no Riot
   * call): their icon, rank and the best player's main champion behind the seats.
   */
  async card({ request, response }: HttpContext) {
    const players = this.players(request).slice(0, 10)
    const key = JSON.stringify([
      RENDERER,
      players.map((p) => `${p.gameName}#${p.tagLine}`.toLowerCase()),
    ])
    let body = cards.get(key)
    if (!body) {
      let job = pending.get(key)
      if (!job) {
        job = this.draw(players)
          .then((jpg) => {
            cards.set(key, jpg, jpg.byteLength, 600_000)
            return jpg
          })
          .finally(() => pending.delete(key))
        pending.set(key, job)
      }
      body = await job
    }
    response.header('Content-Type', 'image/jpeg')
    response.header('Cache-Control', 'public, max-age=600')
    return response.send(body)
  }

  private async draw(players: RiotIdentity[]) {
    const bytes = async (kind: Parameters<typeof riotAssets.get>[0], id: string) => {
      const asset = await riotAssets.get(kind, id).catch(() => null)
      return asset && !asset.placeholder ? Buffer.from(asset.body) : null
    }
    const found = await Promise.all(
      players.map(async (p) => {
        const profile = await summonerService
          .findStoredProfile(`${p.gameName}-${p.tagLine}`)
          .catch(() => null)
        if (!profile) return { p, profile: null, solo: null, champion: null }
        const [ranks, champions] = await Promise.all([
          summonerService.getRanks(profile.puuid).catch(() => null),
          summonerService.getChampionStats(profile.puuid, 20).catch(() => null),
        ])
        const current = ((ranks?.current ?? []) as unknown as RankRow[]).filter((r) => r.tier)
        const solo = current.find((r) => r.queueType === 'RANKED_SOLO_5x5') ?? current[0] ?? null
        return { p, profile, solo, champion: champions?.[0]?.championId ?? null }
      })
    )
    const value = (r: RankRow | null) => (r ? (rankValue(rankFromCore(r as never)) ?? -1) : -1)
    const best = [...found].sort((a, b) => value(b.solo) - value(a.solo)).find((f) => f.champion)
    const tiers = [
      ...new Set(
        found.map((f) => f.solo?.tier.toLowerCase()).filter((t): t is string => Boolean(t))
      ),
    ]
    const [art, icons, emblems] = await Promise.all([
      best?.champion ? bytes('centered', String(best.champion)) : null,
      Promise.all(
        found.map((f) =>
          f.profile ? bytes('profile-icon', String(f.profile.profileIconId ?? 29)) : null
        )
      ),
      Promise.all(tiers.map((t) => bytes('emblem', t))),
    ])
    const seats: LobbySeat[] = found.map((f, i) => ({
      gameName: f.profile?.gameName ?? f.p.gameName,
      tagLine: f.profile?.tagLine ?? f.p.tagLine,
      icon: icons[i],
      tier: f.solo ? f.solo.tier.toLowerCase() : null,
      rank: f.solo
        ? `${rankLabel(rankFromCore(f.solo as never), false)}${['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(f.solo.tier) ? `, ${f.solo.leaguePoints} LP` : ''}`
        : null,
    }))
    return renderLobbyCard({
      seats,
      art,
      emblems: Object.fromEntries(tiers.map((t, i) => [t, emblems[i]])),
    })
  }

  private players(request: HttpContext['request']) {
    const value = request.input('summoners', '')
    return parseRiotIds(Array.isArray(value) ? value.join(',') : String(value))
  }
}
