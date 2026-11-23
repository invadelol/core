import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import matchRepository from '#services/analytics/match_repository'
import liveService from '#services/live/live_service'
import followService from '#services/social/follows'
import { SHOWN_MAIN_COLUMNS, SHOWN_MAIN_JOIN, avatarOf, shownMainOf } from '#services/social/cards'
import type { FriendCard } from '../../../inertia/lib/profile_types.js'

type Row = Record<string, unknown>

/** Friends a profile lists at most (the Friends tab; its showcase draws the first few). */
const FRIENDS = 200
/** The champions of a friend's latest games a card draws. */
const RECENT = 3

/** What a profile's games read costs at most before the page goes on without it. */
const READ_TIMEOUT_MS = 1500

const withTimeout = <T>(work: Promise<T>, fallback: T) =>
  Promise.race([
    work,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), READ_TIMEOUT_MS).unref()),
  ])

/** A profile's friends as cards: their main account (when shown), latest games, live game. */
async function friendCards(ids: string[], viewerId: string | null): Promise<FriendCard[]> {
  if (!ids.length) return []
  const rows = await db.rawQuery(
    `SELECT u.id, u.display_name, u.handle, ${SHOWN_MAIN_COLUMNS}
     FROM invade_user u ${SHOWN_MAIN_JOIN}
     WHERE u.id = ANY(?::uuid[])`,
    [ids]
  )
  const byId = new Map<string, Row>(rows.rows.map((r: Row) => [String(r.id), r]))
  const people = ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))
  const mains = people.map(shownMainOf)
  const puuids = mains.flatMap((m) => (m ? [m.puuid] : []))

  const [latest, live] = await Promise.all([
    withTimeout(
      matchRepository.getLatestOfPlayers(puuids, RECENT).catch((error) => {
        logger.warn({ err: error }, 'friends latest games unavailable')
        return new Map()
      }),
      new Map()
    ),
    Promise.all(mains.map((m) => (m ? liveService.kept(m.puuid, m.platform) : null))),
  ])

  // Who of the friends sits in the same live game as each one.
  const inGame = new Map<number, string[]>()
  live.forEach((game, i) => {
    if (game) {
      inGame.set(game.gameId, [...(inGame.get(game.gameId) ?? []), String(people[i].display_name)])
    }
  })

  return people.map((row, i) => {
    const main = mains[i]
    const game = live[i]
    const me = game?.participants.find((p) => p.puuid === main?.puuid)
    const games = main ? (latest.get(main.puuid) ?? []) : []
    return {
      id: String(row.id),
      name: String(row.display_name),
      handle: String(row.handle),
      avatarUrl: avatarOf(row),
      main,
      recentChampions: games.map((g: { championId: number }) => g.championId),
      live:
        game && me
          ? {
              championId: me.championId,
              queueId: game.gameQueueConfigId,
              startedAt: game.gameStartTime,
              with: (inGame.get(game.gameId) ?? []).filter((name) => name !== row.display_name),
            }
          : null,
      lastGame: games[0]
        ? {
            championId: games[0].championId,
            endedAt: new Date(games[0].endedAtMs).toISOString(),
            win: games[0].win,
          }
        : null,
      isViewer: viewerId === row.id,
    }
  })
}

/**
 * The follows around an Invade profile, as its head and its Friends tab show them: how many
 * follow the person and how many they follow, whether the visitor and the person follow each
 * other, their friends (people who follow each other), and those of them in a game now. A live
 * game comes only from a check someone made lately (`live_service`): a profile never asks Riot.
 */
export async function loadProfileSocial(
  viewerId: string | null,
  profileUserId: string
): Promise<{
  followers: number
  following: number
  viewerFollows: boolean
  followsViewer: boolean
  friends: FriendCard[]
  playingNow: FriendCard[]
}> {
  const others = viewerId && viewerId !== profileUserId
  const [counts, viewerFollows, followsViewer, ids] = await Promise.all([
    followService.counts(profileUserId),
    others ? followService.isFollowing(viewerId, 'user', profileUserId) : false,
    others ? followService.isFollowing(profileUserId, 'user', viewerId) : false,
    followService.friendIds(profileUserId),
  ])
  const friends = await friendCards(ids.slice(0, FRIENDS), viewerId)
  return {
    followers: counts.followers,
    following: counts.following,
    viewerFollows,
    followsViewer,
    friends,
    playingNow: friends.filter((f) => f.live),
  }
}
