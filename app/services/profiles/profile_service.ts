import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { SignedIn } from '#services/accounts/session_service'
import statsRepository from '#services/analytics/stats_repository'
import championStatsService from '#services/champion_stats_service'
import proService, { type ProAccount } from '#services/pro_service'
import { RANKED_SOLO } from '#services/ranked_stats'
import { loadProfileSocial } from '#services/social/profile_social'
import { loadProfileClips } from '#services/clips/profile_clips'
import { loadProfileBuilds } from '#services/builds/profile_builds'
import entitlements from '#services/profiles/entitlements'
import { platesOf, shownAccounts } from '#services/profiles/league_plates'
import { avatarUrl } from '#services/profiles/people'
import {
  effectiveSettings,
  parseSettings,
  settingsFromRow,
  type ProfileRow,
} from '#services/profiles/profile_settings'
import collectionService from '#services/skins/collection_service'
import skinCatalogue from '#services/skins/skin_catalogue'
import { favoriteSkins, profileSkins } from '#services/skins/skin_pages'
import { SEASON_START_MS } from '#config/constants'
import { ladderValue } from '../../../inertia/lib/lp_line.js'
import {
  linkUrl,
  type CustomizeData,
  type OverviewData,
  type ProfileBadge,
  type ProfileHead,
  type ProfileSettings,
  type ProfileTab,
  type SeasonLine,
  type SignatureChampion,
  type VerifiedPro,
} from '../../../inertia/lib/invade_profile.js'

/** A handle as the site writes it: lower case letters, digits and underscores. */
export const HANDLE = /^[a-z0-9_]{2,24}$/

/** The tabs of every profile, and those of a verified pro's. */
const PERSON_TABS: ProfileTab[] = ['overview', 'clips', 'skins', 'builds', 'friends']
const PRO_TABS: ProfileTab[] = ['overview', 'solo', 'champions', 'career']
export const PROFILE_TABS = new Set<ProfileTab>([...PERSON_TABS, ...PRO_TABS])

interface ProfileUser {
  id: string
  name: string
  handle: string
}

/** What `/u/<handle>` renders: the head, the tab, the tab's own data. */
export interface ProfilePage {
  head: ProfileHead
  tab: ProfileTab
  tabs: ProfileTab[]
  overview: OverviewData | null
  clips: Awaited<ReturnType<typeof loadProfileClips>> | null
  skins: Awaited<ReturnType<typeof profileSkins>> | null
  builds: Awaited<ReturnType<typeof loadProfileBuilds>> | null
  friends: { friends: OverviewData['friends']; playingNow: OverviewData['friends'] } | null
  pro: ProTabs | null
  customize: CustomizeData | null
}

type ProData = NonNullable<Awaited<ReturnType<typeof proService.player>>>

/** A verified pro's games, champions and career, from the pro data core keeps. */
export interface ProTabs {
  slug: string
  games: ProData['games']
  stored: Awaited<ReturnType<typeof proService.recentMatches>>
  builds: ProData['builds']
  record: ProData['record']
  teams: ProData['teams']
  names: Record<number, [string, string]>
}

async function championNames(): Promise<Record<number, [string, string]>> {
  const list = await championStatsService.champions().catch(() => [])
  return Object.fromEntries(list.map((c) => [c.id, [c.name, c.slug]]))
}

const splashOf = (championId: number, num = 0) =>
  `/cdn/splash/${championId}${num ? `-${num}` : ''}.jpg`

class ProfileService {
  async findByHandle(handle: string): Promise<ProfileUser | null> {
    if (!HANDLE.test(handle)) return null
    const row = await db
      .from('invade_user')
      .where('handle', handle)
      .select('id', 'display_name', 'handle')
      .first()
    return row ? { id: row.id, name: row.display_name, handle: row.handle } : null
  }

  /** The owner's stored choices (defaults when they never customised). */
  async settings(userId: string): Promise<ProfileSettings> {
    const row = (await db.from('invade_profile').where('user_id', userId).first()) as
      | ProfileRow
      | undefined
    return settingsFromRow(row ?? null)
  }

  /** Saves the owner's choices, checked against their grants and their skins. */
  async save(user: SignedIn, input: unknown): Promise<ProfileSettings> {
    const [catalogue, owned, granted] = await Promise.all([
      skinCatalogue.get(),
      collectionService.owned(user.id),
      entitlements.of(user.id),
    ])
    const settings = await parseSettings(input, {
      premium: granted.premium,
      owned: new Set(owned.keys()),
      known: (id) => catalogue.get(id) !== null,
    })
    const row = {
      user_id: user.id,
      bio: settings.bio,
      links: JSON.stringify(settings.links),
      backdrop_skin: settings.backdrop,
      avatar: settings.avatar,
      accent: settings.accent,
      frame: settings.frame,
      showcases: JSON.stringify(settings.showcases),
      favorite_skins: settings.favorites,
      updated_at: new Date(),
    }
    await db
      .knexQuery()
      .table('invade_profile')
      .insert(row)
      .onConflict('user_id')
      .merge(Object.keys(row).filter((k) => k !== 'user_id'))
    return settings
  }

  /** `/u/<handle>`: null when nobody has that handle. */
  async page(
    handle: string,
    tab: ProfileTab,
    viewer: SignedIn | null
  ): Promise<ProfilePage | null> {
    const user = await this.findByHandle(handle)
    if (!user) return null
    const viewerId = viewer?.id ?? null
    const owner = viewerId === user.id
    const [stored, granted, accounts, social, clips, builds, skinsOwned, verified] =
      await Promise.all([
        this.settings(user.id),
        entitlements.of(user.id),
        shownAccounts(user.id),
        loadProfileSocial(viewerId, user.id),
        loadProfileClips(user.id, viewerId),
        loadProfileBuilds(user.id, viewerId),
        this.ownedSkins(user.id),
        this.verifiedPro(user.id),
      ])
    const settings = effectiveSettings(stored, granted.premium)
    const plates = await platesOf(accounts)
    const main = plates.find((p) => p.main) ?? null
    const signature = main ? await this.signature(main.puuid) : []

    const backdropSkin =
      settings.backdrop !== null && skinsOwned.has(settings.backdrop) ? settings.backdrop : null
    const backdropChampion = verified?.signature ?? signature[0]?.championId ?? null
    const backdrop = backdropSkin
      ? { url: splashOf(Math.floor(backdropSkin / 1000), backdropSkin % 1000), skin: backdropSkin }
      : backdropChampion
        ? { url: splashOf(backdropChampion), skin: null }
        : null
    const icon = main?.profileIconId ?? null

    const badges: ProfileBadge[] = []
    if (granted.premium) badges.push({ kind: 'plus', label: 'Invade+' })
    if (granted.beta) badges.push({ kind: 'beta', label: 'Beta tester' })

    const tabs = verified
      ? [
          ...PRO_TABS,
          ...(['clips', 'skins', 'builds'] as const).filter(
            (t) =>
              (t === 'clips' && clips.clips.length + (clips.pinned ? 1 : 0) > 0) ||
              (t === 'skins' && skinsOwned.size > 0) ||
              (t === 'builds' && builds.length > 0)
          ),
        ]
      : PERSON_TABS
    const shownTab = tabs.includes(tab) ? tab : 'overview'

    const head: ProfileHead = {
      id: user.id,
      name: user.name,
      handle: user.handle,
      platform: main?.platform ?? null,
      bio: settings.bio,
      links: settings.links.map((l) => ({ ...l, url: linkUrl(l.kind, l.handle) })),
      badges,
      accent: settings.accent,
      frame: settings.frame,
      avatarUrl: verified?.pro.photo
        ? `/cdn/pro/${verified.pro.slug}`
        : avatarUrl({ avatar: settings.avatar, backdropSkin, iconId: icon }),
      backdrop,
      followers: social.followers,
      following: social.following,
      viewerFollows: social.viewerFollows,
      followsViewer: social.followsViewer,
      plates,
      pro: verified?.pro ?? null,
      owner,
      premium: granted.premium,
      counts: {
        clips: clips.clips.length + (clips.pinned ? 1 : 0),
        skins: skinsOwned.size,
        builds: builds.length,
        friends: social.friends.length,
      },
    }

    const on = settings.showcases.filter((s) => s.on).map((s) => s.key)
    const needs = (key: (typeof on)[number]) => shownTab === 'overview' && on.includes(key)
    const [favorites, season, skins, pro, customize] = await Promise.all([
      needs('favorites') ? favoriteSkins(user.id, settings.favorites) : [],
      needs('season') && main ? this.season(main.puuid) : null,
      shownTab === 'skins' ? profileSkins(user.id, viewerId, settings.favorites) : null,
      verified && PRO_TABS.includes(shownTab) ? this.proTabs(verified.data) : null,
      owner ? this.customize(user.id, stored, backdropChampion, icon) : null,
    ])

    return {
      head,
      tab: shownTab,
      tabs,
      overview:
        shownTab === 'overview'
          ? {
              showcases: on,
              pinned: clips.pinned,
              clips: clips.clips.slice(0, 3),
              favorites,
              signature,
              builds: builds.slice(0, 3),
              friends: social.friends.slice(0, 6),
              season,
            }
          : null,
      clips: shownTab === 'clips' ? clips : null,
      skins,
      builds: shownTab === 'builds' ? builds : null,
      friends:
        shownTab === 'friends' ? { friends: social.friends, playingNow: social.playingNow } : null,
      pro,
      customize,
    }
  }

  private async ownedSkins(userId: string) {
    const [catalogue, owned] = await Promise.all([
      skinCatalogue.get(),
      collectionService.owned(userId),
    ])
    return new Map(catalogue.pick(owned.keys()).map((skin) => [skin.id, owned.get(skin.id)!]))
  }

  /** The three champions the main account played most this season, in ranked Solo/Duo. */
  private async signature(puuid: string): Promise<SignatureChampion[]> {
    try {
      const [pool, names] = await Promise.all([
        statsRepository.getSeasonPool(puuid, {
          sinceMs: SEASON_START_MS,
          queueIds: [RANKED_SOLO],
        }),
        championNames(),
      ])
      return pool.champions.slice(0, 3).map((c) => ({
        championId: c.championId,
        name: names[c.championId]?.[0] ?? '',
        games: c.games,
        wins: c.wins,
      }))
    } catch (error) {
      logger.warn({ err: error }, 'profile signature unreadable')
      return []
    }
  }

  /** The main account's Solo/Duo season: every change of rank since the season started. */
  private async season(puuid: string): Promise<SeasonLine | null> {
    const result = await db.rawQuery(
      `SELECT tier, division, league_points, fetched_at FROM riot_rank
       WHERE puuid = ? AND queue_type = 'RANKED_SOLO_5x5' AND fetched_at >= ? AND tier IS NOT NULL
       ORDER BY fetched_at`,
      [puuid, new Date(SEASON_START_MS)]
    )
    const points: SeasonLine['points'] = []
    for (const row of result.rows as Record<string, any>[]) {
      const value = ladderValue({
        tier: row.tier,
        division: row.division,
        leaguePoints: row.league_points,
      })
      if (value !== null && points.at(-1)?.value !== value) {
        points.push({ at: new Date(row.fetched_at).getTime(), value })
      }
    }
    if (points.length < 2) return null
    const first = result.rows[0]
    const last = result.rows.at(-1)
    return {
      points,
      from: { tier: first.tier, division: first.division ?? null },
      to: { tier: last.tier, division: last.division ?? null },
    }
  }

  /** The pro an administrator verified this account as, with the pro's facts. */
  private async verifiedPro(
    userId: string
  ): Promise<{ pro: VerifiedPro; data: ProData; signature: number | null } | null> {
    const link = await db
      .from('invade_verified_pro as v')
      .join('pro_player as p', 'p.id', 'v.player_id')
      .where('v.user_id', userId)
      .select('p.slug')
      .first()
    if (!link) return null
    const data = await proService.player(link.slug)
    if (!data) return null
    const signature = await proService.signature(data.id)
    const realName = [data.about?.firstName, data.about?.lastName].filter(Boolean).join(' ')
    return {
      data,
      signature: signature?.champion ?? null,
      pro: {
        slug: data.slug,
        name: data.name,
        realName: realName || null,
        country: data.about?.nationality ?? data.country ?? null,
        role: data.role ?? null,
        team: data.team ? { id: data.team.id, slug: data.team.slug, name: data.team.name } : null,
        league: data.league ? { slug: data.league.slug, code: data.league.code } : null,
        photo: data.photo ?? null,
        socials: data.socials,
        accounts: data.accounts.map((a: ProAccount) => ({
          id: a.id,
          platform: a.platform,
          gameName: a.gameName,
          tagLine: a.tagLine,
          tier: a.tier,
          division: a.division,
          lp: a.lp,
          wins: a.wins,
          losses: a.losses,
          peakTier: a.peakTier,
          peakDivision: a.peakDivision,
          peakLp: a.peakLp,
        })),
      },
    }
  }

  private async proTabs(data: ProData): Promise<ProTabs> {
    const [stored, names] = await Promise.all([
      proService.recentMatches(data.games),
      championNames(),
    ])
    return {
      slug: data.slug,
      games: data.games,
      stored,
      builds: data.builds,
      record: data.record,
      teams: data.teams,
      names,
    }
  }

  /** What the owner's Customize panel offers: their skins as backdrops, and their choices. */
  private async customize(
    userId: string,
    settings: ProfileSettings,
    fallbackChampion: number | null,
    iconId: number | null
  ): Promise<CustomizeData> {
    const [catalogue, owned] = await Promise.all([
      skinCatalogue.get(),
      collectionService.owned(userId),
    ])
    const backdrops = catalogue
      .pick(owned.keys())
      .sort(
        (a, b) =>
          (owned.get(b.id)?.getTime() ?? 0) - (owned.get(a.id)?.getTime() ?? 0) || b.id - a.id
      )
      .map((skin) => ({ id: skin.id, championId: skin.championId, num: skin.num, name: skin.name }))
    return { settings, backdrops, fallbackChampion, iconId }
  }
}

export default new ProfileService()
