import {
  C,
  FOOT,
  H,
  PAD,
  W,
  compact,
  contain,
  cover,
  figure,
  foot,
  heading,
  maybe,
  measure,
  perch,
  poro,
  portrait,
  render,
  roleIcon,
  stage,
  text,
  tierMark,
  type Mood,
  type Role,
  type Run,
} from '#services/og/kit'

/**
 * The link previews of the site's pages: a champion, the tier lists, the stats views, the home,
 * a patch's notes and the desktop app. Each is one stage of real art, the page's name, one real
 * figure (or the five best of a list) and its poro. The controllers read the facts and the art;
 * these only draw.
 */

type Bytes = Uint8Array | Buffer | null | undefined

/** `52.3%` as the figure and its unit. */
export const pct = (x: number, digits = 1) => ({ value: (x * 100).toFixed(digits), unit: '%' })

/* ── A champion ────────────────────────────────────────────────────────────────────────────── */
export interface ChampionCard {
  name: string
  role: Role
  roleLabel: string
  patch: string
  /** The rank group the figures are read in ("Emerald+"). */
  bracket: string
  /** Null when the champion has too few games in the role to be ranked. */
  tier: number | null
  rank: number | null
  /** How many champions the role ranks. */
  ranked: number | null
  winRate: number | null
  games: number | null
  splash: Bytes
}

/** S+ makes it cheeky, a heart for S, asleep in C and D; no figures yet, it waits with its sign. */
export function championMood(tier: number | null, winRate: number | null): Mood {
  if (winRate === null || tier === null) return 'snax'
  if (tier === 0) return 'cheeky'
  if (tier === 1) return 'love'
  if (tier >= 4) return 'snoozy'
  return 'peace'
}

/** `/og/champion/<slug>/<role>.jpg`: the splash, the name huge, its tier and win rate in the role. */
export async function championCard(card: ChampionCard) {
  const art = await maybe(card.splash, 1500)
  const base = stage({ art, box: { x: 300, y: 0, w: W - 300, h: H }, fadeLeft: 0.5 })
  let body = base.svg
  const head = heading([[card.name, C.text1]], null, { room: 700, max: 132, min: 64, lines: 1 })
  body += head.svg
  // The role: its mark, its name in violet, and the champion's place in it.
  const ry = head.bottom + 58
  body += roleIcon(card.role, PAD, ry - 30, 36, C.violet)
  body += text('kicker', card.roleLabel, C.violet, 36, PAD + 48, ry)
  if (card.rank && card.ranked) {
    const rx = PAD + 48 + measure('kicker', card.roleLabel, 36) + 18
    body += text('kicker', `#${card.rank} of ${card.ranked}`, C.text2, 36, rx, ry)
  }
  const mood = championMood(card.tier, card.winRate)
  if (card.winRate !== null) {
    const size = 168
    const base = 520
    const p = pct(card.winRate)
    const fig = figure(p.value, p.unit, W - PAD, base, size, { anchor: 'end' })
    body += fig.svg
    if (card.tier !== null) {
      const mark = tierMark(card.tier, 0, 0, 84)
      body += `<g transform="translate(${(fig.left - mark.width - 26).toFixed(1)} ${base - size * 0.7 + (size * 0.7 - 84) / 2})">${mark.svg}</g>`
    }
    body += await perch(mood, fig, base, size, 150, { at: 0.55 })
  } else {
    body += (await poro(mood, W - PAD - 190, FOOT + 30, 210)).svg
  }
  const games = card.games ? `, ${compact(card.games)} games` : ''
  body += foot(
    card.winRate !== null
      ? `Win rate, ${card.bracket}, patch ${card.patch}${games}`
      : `Not enough games yet, patch ${card.patch}`
  )
  return render(base.defs, body)
}

/* ── The tier lists ────────────────────────────────────────────────────────────────────────── */
export type TileKind = 'tall' | 'square' | 'icon' | 'pair'

export interface Tile {
  /** The picture (a loading screen portrait, an item, a keystone); two for a duo. */
  art: Bytes
  art2?: Bytes
  tier: number | null
  /** 0‥1 */
  winRate: number | null
  role?: Role | null
}

export interface TierListCard {
  /** The title's runs: the role (or the list's kind) in violet. */
  title: Run[]
  sub: string
  kind: TileKind
  tiles: Tile[]
  /** The first one's splash, faded far behind. */
  splash?: Bytes
  mood: Mood
  source: string
}

/**
 * `/og/tier-list/…`: the list's first five, poster size, their tier and win rate, with the poro
 * holding up its sign beside them: champions as their loading screen portraits, items and
 * keystones as their icons, duos as two portraits.
 */
export async function tierListCard(card: TierListCard) {
  const art = await maybe(card.splash, 1400)
  const base = stage({
    art,
    box: { x: 560, y: 0, w: W - 560, h: H },
    fadeLeft: 0.7,
    dim: 0.6,
  })
  let body = base.svg
  body += heading(card.title, [[card.sub, C.text2]], { room: 760, max: 92, min: 56, lines: 1 }).svg

  const n = Math.min(5, card.tiles.length)
  const size =
    card.kind === 'tall'
      ? { w: 132, h: 236, gap: 18 }
      : card.kind === 'pair'
        ? { w: 168, h: 112, gap: 22 }
        : { w: 128, h: 128, gap: 26 }
  const top = card.kind === 'tall' ? 222 : 290
  const pics = await Promise.all(
    card.tiles.slice(0, n).map(async (t) => ({
      a: await maybe(t.art, card.kind === 'tall' ? 420 : 256, { alpha: card.kind === 'icon' }),
      b: await maybe(t.art2, 256),
    }))
  )
  for (let i = 0; i < n; i++) {
    const t = card.tiles[i]
    const x = PAD + i * (size.w + size.gap)
    const { a, b } = pics[i]
    if (card.kind === 'tall') {
      body += `<rect x="${x}" y="${top}" width="${size.w}" height="${size.h}" rx="16" fill="#0c0b12" filter="url(#lift)"/>`
      if (a) body += cover(a, x, top, size.w, size.h, { fx: 0.5, fy: 0.25, radius: 16 })
      body += `<rect x="${x + 0.75}" y="${top + 0.75}" width="${size.w - 1.5}" height="${size.h - 1.5}" rx="16" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="1.5"/>`
    } else if (card.kind === 'pair') {
      const s = size.h
      body += portrait(a, x, top, s, 16)
      body += portrait(b, x + size.w - s, top, s, 16)
    } else if (card.kind === 'icon') {
      body += `<rect x="${x}" y="${top}" width="${size.w}" height="${size.h}" rx="16" fill="#0f0e17" filter="url(#lift)"/>`
      if (a) body += contain(a, x + 12, top + 12, size.w - 24, size.h - 24)
      body += `<rect x="${x + 0.75}" y="${top + 0.75}" width="${size.w - 1.5}" height="${size.h - 1.5}" rx="16" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="1.5"/>`
    } else {
      body += portrait(a, x, top, size.w, 16)
    }
    if (t.tier !== null) {
      const mark = tierMark(t.tier, 0, 0, 38)
      body += `<g transform="translate(${x - 8} ${top - 12})">${mark.svg}</g>`
    }
    // A role's mark in the tile's top right corner, on the art.
    if (t.role) body += roleIcon(t.role, x + size.w - 40, top + 10, 30, C.text1)
    if (t.winRate !== null) {
      const p = pct(t.winRate)
      const width = figure(p.value, p.unit, 0, 0, 44).width
      body += figure(p.value, p.unit, x + (size.w - width) / 2, top + size.h + 56, 44).svg
    }
  }
  if (!n) body += text('kicker', 'The list fills as games come in', C.text2, 32, PAD, 340)
  const tilesRight = PAD + n * (size.w + size.gap)
  const ph = card.kind === 'tall' ? 250 : 236
  body += (await poro(card.mood, Math.max(tilesRight + 10, W - PAD - 250), FOOT + 34, ph)).svg
  body += foot(card.source, { right: tilesRight > 900 ? W - PAD : Math.max(tilesRight - 26, 760) })
  return render(base.defs, body)
}

/* ── A view's one figure ───────────────────────────────────────────────────────────────────── */
export interface FigureCard {
  title: Run[]
  sub: string
  value: string
  unit: string
  /** The foot's line: what the figure is. */
  caption: string
  splash: Bytes
  mood: Mood
}

/** `/og/stats/<view>.jpg` and the like: the view's name, one figure huge, a splash, a poro on it. */
export async function figureCard(card: FigureCard) {
  const art = await maybe(card.splash, 1500)
  const base = stage({ art, box: { x: 360, y: 0, w: W - 360, h: H }, fadeLeft: 0.55 })
  let body = base.svg
  body += heading(card.title, card.sub ? [[card.sub, C.text2]] : null, {
    room: 720,
    max: 110,
    min: 60,
  }).svg
  const size = 176
  const fig = figure(card.value, card.unit, W - PAD, 520, size, { anchor: 'end' })
  body += fig.svg
  body += await perch(card.mood, fig, 520, size, 150, { at: 0.5 })
  body += foot(card.caption)
  return render(base.defs, body)
}

/* ── The home ──────────────────────────────────────────────────────────────────────────────── */
export interface HomeCard {
  patch: string | null
  games: number | null
  splash: Bytes
  /** The best pick of each role, their portraits under the title. */
  picks: { art: Bytes; role: Role }[]
}

/** `/og/home.jpg`: the site's one line, how many games it read this patch, the poro on top. */
export async function homeCard(card: HomeCard) {
  const art = await maybe(card.splash, 1500)
  const base = stage({ art, box: { x: 420, y: 0, w: W - 420, h: H }, fadeLeft: 0.6 })
  let body = base.svg
  const head = heading(
    [
      ['Look up', C.text1],
      ['any', C.violet],
      ['League player', C.text1],
    ],
    [['Rank, match history and a score for every game', C.text2]],
    { room: 700, max: 100, min: 60 }
  )
  body += head.svg
  // The patch's best pick of each role.
  const pics = await Promise.all(card.picks.slice(0, 5).map((p) => maybe(p.art, 200)))
  const s = 84
  pics.forEach((p, i) => {
    const x = PAD + i * (s + 16)
    body += portrait(p, x, 410, s, 16)
    body += roleIcon(card.picks[i].role, x + s / 2 - 13, 410 + s + 14, 26, C.text3)
  })
  if (card.games) {
    const size = 150
    const fig = figure(compact(card.games), '', W - PAD, 520, size, { anchor: 'end' })
    body += fig.svg
    body += await perch('cheeky', fig, 520, size, 150, { at: 0.55 })
  } else {
    body += (await poro('cheeky', W - PAD - 220, FOOT + 30, 220)).svg
  }
  body += foot(
    card.games && card.patch
      ? `Ranked games read on patch ${card.patch}`
      : 'League of Legends stats and the Invade desktop app'
  )
  return render(base.defs, body)
}

/* ── A patch ───────────────────────────────────────────────────────────────────────────────── */
export interface PatchCard {
  patch: string
  published: string | null
  buffs: { art: Bytes }[]
  nerfs: { art: Bytes }[]
  splash: Bytes
}

/** `/og/patch/<version>.jpg`: the patch's name huge, the champions it buffed and nerfed. */
export async function patchCard(card: PatchCard) {
  const art = await maybe(card.splash, 1400)
  const base = stage({ art, box: { x: 620, y: 0, w: W - 620, h: H }, fadeLeft: 0.6, dim: 0.75 })
  let body = base.svg
  body += heading(
    [
      ['Patch', C.text1],
      [card.patch, C.violet],
    ],
    null,
    { room: 900, max: 132, min: 80, lines: 1 }
  ).svg
  const s = 76
  const row = async (list: { art: Bytes }[], y: number, label: string, fill: string) => {
    if (!list.length) return ''
    let svg = text('figure', String(list.length), fill, 64, PAD, y + s / 2 + 22)
    svg += text(
      'kicker',
      label,
      C.text2,
      28,
      PAD + measure('figure', String(list.length), 64) + 12,
      y + s / 2 + 20
    )
    const x0 = PAD + 210
    const shown = list.slice(0, 7)
    const pics = await Promise.all(shown.map((c) => maybe(c.art, 160)))
    pics.forEach((p, i) => (svg += portrait(p, x0 + i * (s + 12), y, s, 16)))
    if (list.length > shown.length)
      svg += text(
        'kicker',
        `+${list.length - shown.length}`,
        C.text3,
        28,
        x0 + shown.length * (s + 12) + 4,
        y + s / 2 + 10
      )
    return svg
  }
  body += await row(card.buffs, 262, card.buffs.length === 1 ? 'buff' : 'buffs', C.win)
  body += await row(card.nerfs, 372, card.nerfs.length === 1 ? 'nerf' : 'nerfs', C.loss)
  body += (await poro('peace', W - PAD - 200, FOOT + 36, 210, { flip: true })).svg
  body += foot(card.published ? `Released ${card.published}` : '', { right: W - PAD - 230 })
  return render(base.defs, body)
}

/* ── The desktop app ───────────────────────────────────────────────────────────────────────── */
export interface AppCard {
  version: string | null
  /** A screenshot of the app's Home. */
  shot: Bytes
}

/** `/og/app.jpg`: the app's Home in its window, the poro leaning on its top edge. */
export async function appCard(card: AppCard) {
  const base = stage()
  let body = base.svg
  body += heading(
    [
      ['Invade for', C.text1],
      ['desktop', C.violet],
    ],
    [['Free on Windows and macOS', C.text2]],
    { room: 520, max: 100, min: 60 }
  ).svg
  const shot = await maybe(card.shot, 1400)
  const x = 560
  const y = 150
  const w = 760
  const h = shot ? (shot.h / shot.w) * w : 430
  body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="24" fill="#0c0b12" filter="url(#lift)"/>`
  if (shot) body += cover(shot, x, y, w, h, { fx: 0, fy: 0, radius: 24 })
  body += `<rect x="${x + 0.75}" y="${y + 0.75}" width="${w - 1.5}" height="${h - 1.5}" rx="24" fill="none" stroke="#fff" stroke-opacity="0.18" stroke-width="1.5"/>`
  // The window's foot sinks into the ink.
  body += `<linearGradient id="shotFoot" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${C.ink}" stop-opacity="0"/><stop offset="1" stop-color="${C.ink}"/></linearGradient><rect x="${x - 2}" y="${H - 170}" width="${w + 4}" height="170" fill="url(#shotFoot)"/>`
  body += (await poro('cheeky', x + 70, y + 26, 150)).svg
  body += foot(card.version ? `Version ${card.version}` : '', { right: x - 30 })
  return render(base.defs, body)
}
