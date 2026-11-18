import {
  C,
  FOOT,
  H,
  PAD,
  TIER,
  W,
  contain,
  cover,
  figure,
  fit,
  foot,
  heading,
  maybe,
  measure,
  perch,
  poro,
  poroWidth,
  portrait,
  rankName,
  render,
  roleIcon,
  stage,
  text,
  type Mood,
  type Pic,
  type Role,
  type Run,
} from '#services/og/kit'

/**
 * The link previews of the pros, the teams, the leagues, the esports overview and the ladders:
 * the people (pro photos, profile icons) and the crests (team and league logos) are the art, the
 * LP the figure, and the poro is a fan (a foam finger for the pros, the hype poro for esports, the
 * bouncer at the door of the apex ladder).
 */

type Bytes = Uint8Array | Buffer | null | undefined

/** A pro's cut-out photo standing on the card's foot, faded into the ink at its bottom. */
function standing(photo: Pic, x: number, w: number, h: number) {
  const scale = Math.min(w / photo.w, h / photo.h)
  const pw = photo.w * scale
  const ph = photo.h * scale
  const image = `<image href="${photo.href}" x="${(x + (w - pw) / 2).toFixed(1)}" y="${(H - ph).toFixed(1)}" width="${pw.toFixed(1)}" height="${ph.toFixed(1)}" preserveAspectRatio="none"/>`
  return `${image}<linearGradient id="standFoot" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${C.ink}" stop-opacity="0"/><stop offset="1" stop-color="${C.ink}" stop-opacity="0.96"/></linearGradient><rect x="${x - 4}" y="${H - 150}" width="${w + 8}" height="150" fill="url(#standFoot)"/>`
}

/* ── A pro ─────────────────────────────────────────────────────────────────────────────────── */
export interface ProCard {
  name: string
  team: { name: string; logo: Bytes } | null
  roleLabel: string | null
  role: Role | null
  photo: Bytes
  /** Their best account. */
  rank: { tier: string; division: string | null; lp: number; platform: string } | null
  emblem: Bytes
  league: string | null
}

/** `/og/pro/<slug>.jpg`: the pro's photo standing on the right, their name, team and LP. */
export async function proCard(card: ProCard) {
  const [photo, logo, emblem] = await Promise.all([
    maybe(card.photo, 640, { alpha: true }),
    maybe(card.team?.logo, 160, { alpha: true }),
    maybe(card.emblem, 300, { alpha: true, trim: true }),
  ])
  const base = stage()
  let body = base.svg
  if (photo) body += standing(photo, 690, 480, 560)
  const head = heading([[card.name, C.text1]], null, { room: 640, max: 132, min: 64, lines: 1 })
  body += head.svg
  // The team: its logo, its name in violet, the role.
  let y = head.bottom + 62
  let x = PAD
  if (logo) {
    body += contain(logo, x, y - 40, 48, 48)
    x += 60
  }
  const team = card.team?.name ?? 'Free agent'
  const t = fit('kicker', team, 420, 36, 26)
  body += text('kicker', t.text, C.violet, t.size, x, y)
  if (card.roleLabel) {
    x += measure('kicker', t.text, t.size) + 20
    if (card.role) body += roleIcon(card.role, x, y - 28, 32, C.text2)
    body += text('kicker', card.roleLabel, C.text2, 34, x + (card.role ? 42 : 0), y)
  }
  let mood: Mood = 'fan'
  if (card.rank) {
    // The LP huge, the emblem beside it, the poro on it.
    const size = 150
    const fig = figure(card.rank.lp.toLocaleString('en-US'), 'LP', PAD, 528, size, {
      fill: TIER[card.rank.tier.toLowerCase()] ?? C.text1,
    })
    body += fig.svg
    if (emblem) body += contain(emblem, fig.left + fig.width + 8, 528 - 124, 124, 124)
    if (card.rank.tier === 'CHALLENGER') mood = 'rocker'
    body += await perch(mood, fig, 528, size, 140, { at: 0.45 })
  } else {
    body += (await poro(mood, PAD + 400, FOOT + 30, 190)).svg
  }
  body += foot(
    card.rank
      ? `${rankName(card.rank.tier, card.rank.division)}, best solo queue account`
      : (card.league ?? ''),
    { right: 660 }
  )
  return render(base.defs, body)
}

/* ── A team ────────────────────────────────────────────────────────────────────────────────── */
export interface TeamCard {
  name: string
  league: string | null
  region: string | null
  logo: Bytes
  /** Its players now, in lane order, with their photos. */
  roster: { name: string; role: Role | null; photo: Bytes }[]
  /** Its place among the league's teams by solo queue LP. */
  place: { place: number; of: number } | null
}

/** `/og/team/<slug>.jpg`: the team's logo, its name, its five players' faces and names. */
export async function teamCard(card: TeamCard) {
  const [logo, ...photos] = await Promise.all([
    maybe(card.logo, 520, { alpha: true }),
    ...card.roster.slice(0, 5).map((p) => maybe(p.photo, 240, { alpha: true })),
  ])
  const base = stage()
  let body = base.svg
  const sub: Run[] = []
  if (card.league) sub.push([card.league, C.violet])
  if (card.place) sub.push([`#${card.place.place} of ${card.place.of} in solo queue`, C.text2])
  else if (card.region) sub.push([card.region, C.text2])
  body += heading([[card.name, C.text1]], sub, { room: 700, max: 112, min: 60, lines: 1 }).svg
  // The logo on the right, the buddies peeking over it.
  const ls = 340
  const lx = W - PAD - ls
  const ly = 92
  if (logo) body += contain(logo, lx, ly, ls, ls, ' filter="url(#lift)"')
  // The players: photo, lane, name.
  const s = 128
  const gap = 18
  const top = 300
  card.roster.slice(0, 5).forEach((p, i) => {
    const x = PAD + i * (s + gap)
    body += `<rect x="${x}" y="${top}" width="${s}" height="${s}" rx="16" fill="#221f31"/>`
    const photo = photos[i]
    if (photo) body += cover(photo, x, top, s, s, { fx: 0.5, fy: 0.3, radius: 16 })
    body += `<rect x="${x + 0.75}" y="${top + 0.75}" width="${s - 1.5}" height="${s - 1.5}" rx="16" fill="none" stroke="#fff" stroke-opacity="0.14" stroke-width="1.5"/>`
    const n = fit('kicker', p.name, s + gap - 6, 26, 17)
    body += text('kicker', n.text, C.text1, n.size, x + s / 2, top + s + 38, { anchor: 'middle' })
    if (p.role) body += roleIcon(p.role, x + s / 2 - 12, top + s + 52, 24, C.text3)
  })
  const ph = 170
  const pw = await poroWidth('buddies', ph)
  body += (await poro('buddies', lx + ls / 2 - pw / 2, FOOT + 34, ph)).svg
  body += foot('', {})
  return render(base.defs, body)
}

/* ── Pros, a league, the pro ladder ────────────────────────────────────────────────────────── */
export interface ProsCard {
  title: Run[]
  sub: string
  /** A league's logo beside the title. */
  logo?: Bytes
  /** The first five, best LP first. */
  pros: {
    name: string
    photo: Bytes
    lp: number | null
    tier: string | null
    team: string | null
  }[]
  source: string
}

/** `/og/pros/<league>.jpg`: the league's (or every league's) five best pros by LP, faces first. */
export async function prosCard(card: ProsCard) {
  const [logo, ...photos] = await Promise.all([
    maybe(card.logo, 200, { alpha: true }),
    ...card.pros.slice(0, 5).map((p) => maybe(p.photo, 300, { alpha: true })),
  ])
  const base = stage()
  let body = base.svg
  const lx = logo ? PAD + 104 : PAD
  if (logo) body += contain(logo, PAD, PAD + 4, 84, 84)
  body += heading(card.title, [[card.sub, C.text2]], {
    x: lx,
    room: 860 - lx,
    max: 96,
    min: 56,
    lines: 1,
  }).svg
  const w = 146
  const h = 176
  const gap = 18
  const top = 236
  card.pros.slice(0, 5).forEach((p, i) => {
    const x = PAD + i * (w + gap)
    body += `<rect x="${x}" y="${top}" width="${w}" height="${h}" rx="16" fill="#221f31"/>`
    const photo = photos[i]
    if (photo) body += cover(photo, x, top, w, h, { fx: 0.5, fy: 0.2, radius: 16 })
    else
      body += text(
        'display',
        [...p.name][0]?.toUpperCase() ?? '',
        C.text3,
        84,
        x + w / 2,
        top + h / 2 + 30,
        { anchor: 'middle' }
      )
    body += `<rect x="${x + 0.75}" y="${top + 0.75}" width="${w - 1.5}" height="${h - 1.5}" rx="16" fill="none" stroke="#fff" stroke-opacity="0.14" stroke-width="1.5"/>`
    body += text('figure', `${i + 1}`, C.text1, 30, x + 14, top + 40)
    const n = fit('kicker', p.name, w, 28, 18)
    body += text('kicker', n.text, C.text1, n.size, x + w / 2, top + h + 40, { anchor: 'middle' })
    if (p.lp !== null) {
      const lp = `${p.lp.toLocaleString('en-US')} LP`
      body += text('label', lp, C.text2, 24, x + w / 2, top + h + 72, { anchor: 'middle' })
    }
  })
  const right = PAD + Math.max(1, Math.min(5, card.pros.length)) * (w + gap)
  body += (await poro('fan', Math.max(right + 4, W - PAD - 230), FOOT + 34, 236)).svg
  body += foot(card.source, { right: Math.min(right - gap, W - PAD - 240) })
  return render(base.defs, body)
}

/* ── Esports ───────────────────────────────────────────────────────────────────────────────── */
export interface EsportsCard {
  /** A match live or next: its teams and league. */
  match: {
    league: string
    when: string
    a: { name: string; logo: Bytes }
    b: { name: string; logo: Bytes }
    live: boolean
  } | null
  /** The leagues' logos otherwise. */
  leagues: { code: string; logo: Bytes }[]
  pros: number | null
}

/** `/esports`: the match on now (or next), its two crests face to face; else the leagues. */
export async function esportsCard(card: EsportsCard) {
  const base = stage()
  let body = base.svg
  if (card.match) {
    const m = card.match
    const [a, b] = await Promise.all([
      maybe(m.a.logo, 400, { alpha: true }),
      maybe(m.b.logo, 400, { alpha: true }),
    ])
    body += heading(
      m.live
        ? [
            ['Live', C.violet],
            [m.league, C.text1],
          ]
        : [
            [m.league, C.text1],
            [m.when, C.violet],
          ],
      null,
      { room: 1000, max: 96, min: 56, lines: 1 }
    ).svg
    const s = 250
    const y = 200
    if (a) body += contain(a, PAD + 10, y, s, s, ' filter="url(#lift)"')
    if (b) body += contain(b, W / 2 + 20, y, s, s, ' filter="url(#lift)"')
    body += text(
      'display',
      'vs',
      C.text3,
      64,
      PAD + 10 + s + (W / 2 + 20 - PAD - 10 - s) / 2,
      y + s / 2 + 22,
      { anchor: 'middle' }
    )
    const na = fit('kicker', m.a.name, s + 60, 34, 22)
    const nb = fit('kicker', m.b.name, s + 60, 34, 22)
    body += text('kicker', na.text, C.text1, na.size, PAD + 10 + s / 2, y + s + 50, {
      anchor: 'middle',
    })
    body += text('kicker', nb.text, C.text1, nb.size, W / 2 + 20 + s / 2, y + s + 50, {
      anchor: 'middle',
    })
    body += (await poro('hype', W - PAD - 210, FOOT + 34, 236, { flip: true })).svg
    body += foot('', {})
    return render(base.defs, body)
  }
  body += heading(
    [['Esports', C.text1]],
    [['Live matches, leagues and pros in solo queue', C.text2]],
    {
      room: 900,
      max: 120,
      min: 64,
      lines: 1,
    }
  ).svg
  const logos = await Promise.all(
    card.leagues.slice(0, 6).map((l) => maybe(l.logo, 200, { alpha: true }))
  )
  const s = 112
  logos.forEach((logo, i) => {
    const x = PAD + i * (s + 30)
    body += `<rect x="${x}" y="300" width="${s}" height="${s}" rx="16" fill="#221f31"/>`
    if (logo) body += contain(logo, x + 16, 316, s - 32, s - 32)
    const c = fit('kicker', card.leagues[i].code, s + 20, 26, 18)
    body += text('kicker', c.text, C.text2, c.size, x + s / 2, 300 + s + 40, { anchor: 'middle' })
  })
  body += (await poro('hype', W - PAD - 210, FOOT + 34, 236, { flip: true })).svg
  body += foot(
    card.pros ? `${card.pros.toLocaleString('en-US')} pros followed in solo queue` : '',
    {
      right: W - PAD - 240,
    }
  )
  return render(base.defs, body)
}

/* ── The ladders ───────────────────────────────────────────────────────────────────────────── */
export interface LadderCard {
  title: Run[]
  sub: string
  /** Who leads it. */
  leader: {
    name: string
    tag: string | null
    icon: Bytes
    tier: string
    division: string | null
    lp: number
    /** Their champion's splash, behind. */
    splash: Bytes
    /** "Ahri one-trick", a pro's team. */
    note: string | null
  } | null
  emblem: Bytes
  mood: Mood
  source: string
}

/** `/leaderboards/…`: who leads the ladder, their LP huge, the poro at the door. */
export async function ladderCard(card: LadderCard) {
  const l = card.leader
  const [art, icon, emblem] = await Promise.all([
    maybe(l?.splash, 1400),
    maybe(l?.icon, 220),
    maybe(card.emblem, 300, { alpha: true, trim: true }),
  ])
  const base = stage({ art, box: { x: 420, y: 0, w: W - 420, h: H }, fadeLeft: 0.6, dim: 0.75 })
  let body = base.svg
  body += heading(card.title, [[card.sub, C.text2]], { room: 760, max: 100, min: 56, lines: 1 }).svg
  if (l) {
    const y = 250
    body += portrait(icon, PAD, y, 104, 16)
    body += text('figure', '#1', C.violet, 40, PAD + 128, y + 38)
    const n = fit('display', l.name, 560, 64, 36, -0.02)
    body += text('display', n.text, C.text1, n.size, PAD + 128, y + 98, { tracking: -0.02 })
    if (l.note) body += text('kicker', l.note, C.text2, 28, PAD + 128 + 70, y + 38)
    const size = 150
    const fig = figure(l.lp.toLocaleString('en-US'), 'LP', PAD, 528, size, {
      fill: TIER[l.tier.toLowerCase()] ?? C.text1,
    })
    body += fig.svg
    if (emblem) body += contain(emblem, fig.left + fig.width + 10, 528 - 130, 130, 130)
  } else if (emblem) {
    body += contain(emblem, PAD - 20, 230, 300, 300)
  }
  const ph = card.mood === 'bouncer' ? 300 : 236
  body += (await poro(card.mood, W - PAD - (await poroWidth(card.mood, ph)) + 20, FOOT + 40, ph))
    .svg
  body += foot(card.source, { right: W - PAD - 260 })
  return render(base.defs, body)
}
