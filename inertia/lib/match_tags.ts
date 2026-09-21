import { killParticipation, matchMinutes, rankLobby, teamTotals } from './match.js'
import type { LobbyRanking } from './match.js'
import type { Match, Participant } from './types.js'

export interface MatchTag {
  id: string
  label: string
  description: string
  tone: 'positive' | 'negative' | 'neutral' | 'gold'
}

const ROLES: Record<string, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MIDDLE: 'Mid',
  BOTTOM: 'Bot',
  UTILITY: 'Support',
}

/** Summary-only heuristics: no detail fetches, timeline guesses or inferred LP. */
export function matchTags(match: Match, puuid: string, ranking?: LobbyRanking): MatchTag[] {
  const me = match.participants.find((p) => p.puuid === puuid)
  if (!me || !Number.isFinite(match.duration) || match.duration <= 0) return []

  const tags: MatchTag[] = []
  const add = (
    id: string,
    label: string,
    description: string,
    tone: MatchTag['tone'] = 'neutral'
  ) => tags.push({ id, label, description, tone })

  // A short match is not necessarily a remake. Do not rate its performance.
  if (match.duration < 300) {
    add('short-game', 'Short game', 'This match ended in under 5 minutes.')
    return tags
  }

  // Comparative labels need a complete, conventional two-team scoreboard.
  const allies = match.participants.filter((p) => p.teamId === me.teamId)
  const enemies = match.participants.filter((p) => p.teamId !== me.teamId)
  const complete =
    match.participants.length === 10 &&
    allies.length === 5 &&
    enemies.length === 5 &&
    match.participants.some((p) => p.kills > 0) &&
    new Set(match.participants.map((p) => p.puuid)).size === 10 &&
    match.participants.every((p) =>
      [p.kills, p.deaths, p.assists, p.goldEarned, p.totalDamageDealtToChampions].every(
        (value) => Number.isFinite(value) && value >= 0
      )
    ) &&
    match.participants.every((p) => p.teamId === 100 || p.teamId === 200)
  const minutes = matchMinutes(match)
  const takedowns = me.kills + me.assists
  const ratio = takedowns / Math.max(me.deaths, 1)
  const totals = teamTotals(match)
  const ours = totals[me.teamId]
  const theirs = totals[me.teamId === 100 ? 200 : 100]
  const kp = killParticipation(me, totals)
  const share = ours?.damage > 0 ? (me.totalDamageDealtToChampions / ours.damage) * 100 : 0
  const rift = match.mapId === 11

  if (complete) {
    const lobby = ranking ?? rankLobby(match)
    if (me.win && share >= 35 && kp >= 60 && ratio >= 4) {
      add(
        'hard-carry',
        'Hard carry',
        `${Math.round(share)}% of team damage, ${Math.round(kp)}% kill participation and ${ratio.toFixed(1)} KDA in a win.`,
        'positive'
      )
    } else if (me.win && lobby.mvpPuuid === puuid) {
      add(
        'mvp',
        'MVP',
        'Highest performance score on the winning team, using the same rating as the scoreboard.',
        'gold'
      )
    } else if (!me.win && lobby.rank[puuid] <= 3) {
      add(
        'unlucky',
        'Unlucky',
        'A top-three performance score in this lobby despite the loss.',
        'positive'
      )
    } else if (!me.win && lobby.acePuuid === puuid) {
      add(
        'best-effort',
        'Best effort',
        'Highest performance score on your team despite the loss.',
        'positive'
      )
    }

    const teammates = allies.filter((p) => p.puuid !== puuid)
    if (me.win && teammates.filter((p) => lobby.rank[p.puuid] <= 5).length >= 3) {
      add(
        'amazing-team',
        'Amazing team',
        'At least three of your four teammates ranked in the top half of this lobby.',
        'positive'
      )
    } else if (!me.win && teammates.filter((p) => lobby.rank[p.puuid] >= 6).length >= 3) {
      add(
        'team-struggled',
        'Team struggled',
        'At least three of your four teammates ranked in the bottom half of this lobby.',
        'negative'
      )
    }

    // End-of-game role comparison, never presented as a laning-phase result.
    const opponents = enemies.filter((p) => p.position === me.position)
    if (
      rift &&
      ROLES[me.position] &&
      opponents.length === 1 &&
      allies.filter((p) => p.position === me.position).length === 1
    ) {
      const opponent = opponents[0]
      const goldDiff = me.goldEarned - opponent.goldEarned
      const kdaDiff = ratio - (opponent.kills + opponent.assists) / Math.max(opponent.deaths, 1)
      if (goldDiff >= 1500 && kdaDiff >= 1.5) {
        add(
          'role-diff',
          `${ROLES[me.position]} diff`,
          `Finished ${goldDiff.toLocaleString('en-US')} gold and ${kdaDiff.toFixed(1)} KDA ahead of the enemy ${ROLES[me.position].toLowerCase()}. This compares final stats, not the laning phase.`,
          'positive'
        )
      } else if (goldDiff <= -1500 && kdaDiff <= -1.5) {
        add(
          'role-outmatched',
          `${ROLES[me.position]} outmatched`,
          `Finished ${Math.abs(goldDiff).toLocaleString('en-US')} gold and ${Math.abs(kdaDiff).toFixed(1)} KDA behind your role opponent. This compares final stats, not the laning phase.`,
          'negative'
        )
      }
    }
  }

  if (me.deaths === 0 && takedowns >= 5) {
    add('deathless', 'Deathless', `${takedowns} takedowns without a single death.`, 'positive')
  } else if (ratio >= 5 && takedowns >= 10) {
    add(
      'great-kda',
      'Great KDA',
      `${ratio.toFixed(1)} KDA across ${takedowns} takedowns.`,
      'positive'
    )
  }
  if (me.kills >= 20)
    add('kill-machine', 'Kill machine', `${me.kills} kills this game.`, 'positive')
  else if (me.kills >= 10)
    add('double-digit-kills', '10+ kills', `${me.kills} kills this game.`, 'positive')
  if (me.assists >= 20)
    add('team-player', 'Team player', `${me.assists} assists this game.`, 'positive')
  if (complete && kp >= 75 && ours.kills >= 10) {
    add(
      'everywhere',
      'Everywhere',
      `Involved in ${Math.round(kp)}% of your team's ${ours.kills} kills.`,
      'positive'
    )
  }
  if (complete && share >= 35 && me.totalDamageDealtToChampions >= 10000) {
    add(
      'damage-dealer',
      'Damage dealer',
      `Dealt ${Math.round(share)}% of your team's champion damage.`,
      'positive'
    )
  }
  const leadsLobby = (read: (p: Participant) => number) =>
    complete && match.participants.every((p) => Number.isFinite(read(p)) && read(me) >= read(p))
  if (leadsLobby((p) => p.totalDamageDealtToChampions) && me.totalDamageDealtToChampions >= 10000) {
    add(
      'top-damage',
      'Top damage',
      `Lobby-leading ${me.totalDamageDealtToChampions.toLocaleString('en-US')} damage to champions.`,
      'positive'
    )
  }
  if (me.damageTaken >= 20000 && complete && me.damageTaken / ours.damageTaken >= 0.35) {
    add(
      'frontline',
      'Frontline',
      `Took ${Math.round((me.damageTaken / ours.damageTaken) * 100)}% of your team's incoming damage.`
    )
  }
  if (rift && minutes >= 10) {
    if (me.position !== 'UTILITY' && me.cs / minutes >= 8) {
      add('cs-machine', 'CS machine', `${(me.cs / minutes).toFixed(1)} CS per minute.`, 'gold')
    }
    if (me.goldEarned / minutes >= 450) {
      add(
        'gold-rush',
        'Gold rush',
        `${Math.round(me.goldEarned / minutes)} gold earned per minute.`,
        'gold'
      )
    }
    if (me.visionScore / minutes >= 2) {
      add(
        'vision-control',
        'Vision control',
        `${(me.visionScore / minutes).toFixed(1)} vision score per minute.`,
        'positive'
      )
    } else if (leadsLobby((p) => p.visionScore) && me.visionScore >= 30) {
      add(
        'vision-leader',
        'Vision leader',
        `Lobby-leading vision score of ${me.visionScore}.`,
        'positive'
      )
    }
  }
  if (Number.isFinite(me.deaths) && me.deaths >= 10 && me.deaths / minutes >= 0.35) {
    add(
      'rough-game',
      'Rough game',
      `${me.deaths} deaths — one every ${(minutes / me.deaths).toFixed(1)} minutes.`,
      'negative'
    )
  }
  if (complete && kp < 30 && ours.kills >= 15) {
    add(
      'low-involvement',
      'Low involvement',
      `Involved in ${Math.round(kp)}% of your team's kills.`,
      'negative'
    )
  }

  if (complete && rift && minutes >= 10) {
    const goldLead = ours.gold - theirs.gold
    const killLead = ours.kills - theirs.kills
    if (me.win && goldLead >= 10000 && killLead >= 10) {
      add(
        'stomp',
        'Stomp',
        `Your team finished ${goldLead.toLocaleString('en-US')} gold and ${killLead} kills ahead.`,
        'positive'
      )
    } else if (!me.win && goldLead <= -10000 && killLead <= -10) {
      add(
        'one-sided',
        'One-sided',
        `The enemy team finished ${Math.abs(goldLead).toLocaleString('en-US')} gold and ${Math.abs(killLead)} kills ahead.`,
        'negative'
      )
    } else if (Math.abs(goldLead) <= 3000 && Math.abs(killLead) <= 5) {
      add(
        'close-game',
        'Close game',
        'The teams finished within 3,000 gold and 5 kills of each other.'
      )
    }
    if ((ours.kills + theirs.kills) / minutes >= 2) {
      add(
        'action-packed',
        'Action packed',
        `${ours.kills + theirs.kills} total kills in ${Math.round(minutes)} minutes.`
      )
    }
    const blue = me.teamId === 100
    const towers = blue ? match.t1Towers : match.t2Towers
    const enemyTowers = blue ? match.t2Towers : match.t1Towers
    const dragons = blue ? match.t1Dragons : match.t2Dragons
    const enemyDragons = blue ? match.t2Dragons : match.t1Dragons
    const barons = blue ? match.t1Barons : match.t2Barons
    if (towers >= 8 && enemyTowers <= 3)
      add(
        'tower-control',
        'Tower control',
        `Your team took ${towers} towers to the enemy's ${enemyTowers}.`,
        'positive'
      )
    if (dragons >= 4 && dragons > enemyDragons)
      add(
        'dragon-control',
        'Dragon control',
        `Your team took ${dragons} dragons to the enemy's ${enemyDragons}.`,
        'positive'
      )
    if (barons >= 2)
      add('baron-control', 'Baron control', `Your team secured ${barons} Barons.`, 'positive')
  }
  if (rift && minutes >= 40) add('marathon', 'Marathon', `A ${Math.floor(minutes)}-minute game.`)
  else if (rift && minutes >= 10 && minutes <= 20 && me.win)
    add('quick-win', 'Quick win', 'Victory in 20 minutes or less.', 'positive')

  return tags
}
