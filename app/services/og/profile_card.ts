import {
  C,
  FOOT,
  PAD,
  TIER,
  W,
  drawable,
  figure,
  foot,
  maybe,
  measure,
  poro,
  perch,
  portrait,
  rankName,
  render,
  stage,
  text,
  title,
  contain,
  type Mood,
} from '#services/og/kit'

export interface ProfileCard {
  gameName: string
  tagLine: string
  /** "EUW". */
  region: string
  icon: Uint8Array | null
  /** The most played champion's centred splash. */
  splash: Uint8Array | null
  rank: { tier: string; division: string | null; lp: number } | null
  emblem: Uint8Array | null
  /** The recent games the figures cover. */
  games: number
  winRate: number | null
  /** Wins (positive) or losses (negative) in a row, newest first. */
  streak: number
}

/** The poro that reacts to the player: the rocker at Master+, asleep on a losing run, … */
export function profileMood(
  card: Pick<ProfileCard, 'rank' | 'games' | 'winRate' | 'streak'>
): Mood {
  if (card.rank && ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(card.rank.tier)) return 'rocker'
  if (card.streak <= -3) return 'snoozy'
  if (card.streak >= 4) return 'cheeky'
  if (card.winRate !== null && card.games >= 10 && card.winRate >= 0.55) return 'cheeky'
  if (card.winRate !== null && card.games >= 10 && card.winRate < 0.42) return 'ghost'
  return 'peace'
}

/**
 * `/og/:summoner`: the player's profile icon and name big over their most played champion's
 * splash, their rank with its emblem, and their recent win rate huge on the right with a poro
 * perched on it that reacts to it.
 */
export async function profileCard(card: ProfileCard) {
  const [art, icon, emblem] = await Promise.all([
    maybe(card.splash, 1400),
    maybe(card.icon, 240),
    maybe(card.emblem, 360, { alpha: true, trim: true }),
  ])
  const base = stage({ art, box: { x: 400, y: 0, w: W - 400, h: 630 }, fadeLeft: 0.6 })
  let body = base.svg

  // The figure first: the name keeps clear of it.
  const hasFigure = card.winRate !== null && card.games > 0
  const fig = hasFigure
    ? figure(String(Math.round(card.winRate! * 100)), '%', W - PAD, 520, 176, { anchor: 'end' })
    : null

  // The player: the icon, the name, the tag and the server.
  const iconSize = 112
  body += portrait(icon, PAD, PAD, iconSize, 16)
  const named = drawable('display', card.gameName.replace(/\s/g, ''))
  const room = 680
  const name = title(
    named ? [[card.gameName, C.text1]] : [[`${card.region} player`, C.text1]],
    PAD,
    PAD + iconSize + 34,
    room,
    { max: 116, min: 58, lines: 1 }
  )
  body += name.svg
  const tagBase = name.baseline + 52
  const tag = `#${card.tagLine}`
  body += text('display', tag, C.violet, 36, PAD, tagBase, { tracking: -0.01 })
  // A tag that is the server's name says it once.
  if (card.tagLine.toUpperCase() !== card.region.toUpperCase())
    body += text(
      'kicker',
      card.region,
      C.text3,
      30,
      PAD + measure('display', tag, 36, -0.01) + 18,
      tagBase
    )

  // The rank: the emblem, its name in its colour, the LP.
  if (card.rank) {
    const size = 128
    const top = tagBase + 28
    if (emblem) body += contain(emblem, PAD - 10, top, size, size)
    const rx = PAD + (emblem ? size + 10 : 0)
    const tier = card.rank.tier.toLowerCase()
    body += text(
      'display',
      rankName(card.rank.tier, card.rank.division),
      TIER[tier] ?? C.text1,
      58,
      rx,
      top + 66,
      { tracking: -0.02 }
    )
    body += text('kicker', `${card.rank.lp.toLocaleString('en-US')} LP`, C.text2, 32, rx, top + 108)
  }

  // The figure, with the poro on top of it.
  const mood = profileMood(card)
  if (fig) {
    body += fig.svg
    body += await perch(mood, fig, 520, 176, mood === 'rocker' ? 176 : 156)
  } else {
    body += (await poro(mood, W - PAD - 220, FOOT - 30, 190)).svg
  }
  const caption = hasFigure
    ? `Win rate, last ${card.games} game${card.games === 1 ? '' : 's'}`
    : 'No recent games'
  body += foot(caption)
  return render(base.defs, body)
}
