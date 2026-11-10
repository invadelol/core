import { rows } from '#services/ranked_games_service'
import { buildsOf, itemKinds, type ProBuild } from '#services/pro_service'

/** Summoner's Rift queues: draft, solo, blind, flex, quickplay, swiftplay. ARAM builds differ. */
const RIFT_QUEUES = [400, 420, 430, 440, 480, 490]

/**
 * How one player builds one champion, read from their stored games on it (Summoner's Rift, newest
 * 60): the three items they finish most, their boots, keystone and secondary tree, summoner spells
 * and the order they max their skills. The same summary as a pro's builds, for anyone.
 */
export async function playerBuild(puuid: string, champion: number): Promise<ProBuild | null> {
  const found = await rows(
    `SELECT win, kills, deaths, assists, item0, item1, item2, item3, item4, item5,
            spell1, spell2, keystone, secondary_style, skill_order
     FROM participants
     WHERE puuid = {puuid:String} AND champion_id = {champion:UInt16}
       AND queue_id IN {queues:Array(UInt16)}
     ORDER BY game_start_ms DESC
     LIMIT 1 BY match_id
     LIMIT 60`,
    { puuid, champion, queues: RIFT_QUEUES }
  )
  if (!found.length) return null
  let wins = 0
  let kills = 0
  let deaths = 0
  let assists = 0
  const games = found.map((r) => {
    const [win, k, d, a, ...rest] = r
    const items = rest.slice(0, 6).map(Number)
    const [s1, s2, keystone, secondary] = rest.slice(6, 10).map(Number)
    const skills = (rest[10] as unknown[] | null) ?? []
    const won = Number(win) === 1
    if (won) wins++
    kills += Number(k)
    deaths += Number(d)
    assists += Number(a)
    return {
      champion,
      items,
      spells: [s1, s2] as [number, number],
      keystone,
      secondaryStyle: secondary,
      skillOrder: skills.slice(0, 18).map(Number),
      win: won,
    }
  })
  const kda = (kills + assists) / Math.max(1, deaths)
  const [build] = buildsOf(games, await itemKinds(), [{ champion, games: games.length, wins, kda }])
  return build ?? null
}
