import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'

/**
 * The professional leagues the pro pages group teams by. They come from `pro_league` (filled
 * daily from esports data), each team's league from `pro_team.league_slug`. While that table is
 * empty or unreadable (before its migration), the six leagues below stand in, with their teams of
 * the 2026 season by slug.
 *
 * The catalog is read once every few minutes and kept in this process: loaders `await
 * leagueCatalog()` first, then read it synchronously (`catalog()`).
 */

export interface League {
  slug: string
  /** The short name every page shows (LEC, LCK…). */
  code: string
  name: string
  /** Where it plays ("EMEA", "Korea", "International"), when known. */
  region: string | null
  /** 0 international events, 1 major leagues, 2 regional leagues. */
  tier: number
  /** Order in lists and menus, ascending. */
  priority: number
  /** Its teams, by slug. */
  teams: string[]
}

/** The leagues used while `pro_league` is empty, with their teams of the 2026 season. */
export const FALLBACK_LEAGUES: League[] = [
  {
    slug: 'lec',
    code: 'LEC',
    name: 'League of Legends EMEA Championship',
    region: 'EMEA',
    tier: 1,
    priority: 10,
    teams: [
      'fnatic',
      'g2-esports',
      'giantx',
      'karmine-corp',
      'movistar-koi',
      'natus-vincere',
      'shifters',
      'sk-gaming',
      'team-heretics',
      'team-vitality',
    ],
  },
  {
    slug: 'lck',
    code: 'LCK',
    name: 'League of Legends Champions Korea',
    region: 'Korea',
    tier: 1,
    priority: 20,
    teams: [
      'bnk-fearx',
      'dn-soopers',
      'dplus-kia',
      'gen-g',
      'hanjin-brion',
      'hanwha-life-esports',
      'kiwoom-drx',
      'kt-rolster',
      'nongshim-redforce',
      't1',
    ],
  },
  {
    slug: 'lpl',
    code: 'LPL',
    name: 'League of Legends Pro League',
    region: 'China',
    tier: 1,
    priority: 30,
    teams: [
      'anyones-legend',
      'bilibili-gaming',
      'edward-gaming',
      'invictus-gaming',
      'jd-gaming',
      'lgd-gaming',
      'lng-esports',
      'ninjas-in-pyjamas',
      'oh-my-god',
      'royal-never-give-up',
      'team-we',
      'thundertalk-gaming',
      'top-esports',
      'ultra-prime',
      'weibo-gaming',
    ],
  },
  {
    slug: 'lcs',
    code: 'LCS',
    name: 'League Championship Series',
    region: 'North America',
    tier: 1,
    priority: 40,
    teams: [
      'cloud9',
      'dignitas',
      'disguised',
      'flyquest',
      'lyon',
      'sentinels',
      'shopify-rebellion',
      'team-liquid',
    ],
  },
  {
    slug: 'cblol',
    code: 'CBLOL',
    name: 'Campeonato Brasileiro de League of Legends',
    region: 'Brazil',
    tier: 1,
    priority: 50,
    teams: [
      'fluxo-w7m',
      'furia-esports',
      'leviatan',
      'loud',
      'pain-gaming',
      'red-canids',
      'vivo-keyd-stars',
    ],
  },
  {
    slug: 'lcp',
    code: 'LCP',
    name: 'League of Legends Championship Pacific',
    region: 'Asia Pacific',
    tier: 1,
    priority: 60,
    teams: [
      'ctbc-flying-oyster',
      'deep-cross-gaming',
      'detonation-focusme',
      'fukuoka-softbank-hawks-gaming',
      'gam-esports',
      'ground-zero-gaming',
      'mvk-esports',
      'team-secret-whales',
    ],
  },
]

/** The leagues known now, and which league each team plays in. */
export class LeagueCatalog {
  readonly #bySlug: Map<string, League>
  readonly #byTeam: Map<string, League>

  constructor(
    /** Every league, international events included, by priority. */
    readonly all: League[],
    /** True when they come from `pro_league`, false for the fallback. */
    readonly fromTable: boolean
  ) {
    this.#bySlug = new Map(all.map((l) => [l.slug, l]))
    this.#byTeam = new Map(all.flatMap((l) => l.teams.map((t) => [t, l] as const)))
  }

  /** The leagues with teams, by priority: what `/pros`, the menus and the sitemap list. */
  get listed() {
    return this.all.filter((l) => l.teams.length)
  }

  /** The league `/pros` opens on. */
  get first(): League | null {
    return this.listed[0] ?? null
  }

  bySlug(slug: unknown): League | null {
    return this.#bySlug.get(String(slug ?? '').toLowerCase()) ?? null
  }

  /** The league a team plays in (by its slug), or null. */
  ofTeam(teamSlug: string | null | undefined): League | null {
    return (teamSlug && this.#byTeam.get(teamSlug)) || null
  }

  /**
   * Where an address of a league this catalog does not know went: a league with that code, else
   * the league most of a fallback league's teams play in now (`lcs` when North America's league
   * has another slug).
   */
  successor(slug: unknown): League | null {
    const asked = String(slug ?? '').toLowerCase()
    if (!asked || this.#bySlug.has(asked)) return null
    const byCode = this.listed.find((l) => l.code.toLowerCase() === asked)
    if (byCode) return byCode
    const old = FALLBACK_LEAGUES.find((l) => l.slug === asked)
    if (!old) return null
    const votes = new Map<League, number>()
    for (const team of old.teams) {
      const now = this.ofTeam(team)
      if (now) votes.set(now, (votes.get(now) ?? 0) + 1)
    }
    const [best] = [...votes].sort((a, b) => b[1] - a[1])
    return best && best[1] * 2 >= old.teams.length ? best[0] : null
  }
}

const FALLBACK = new LeagueCatalog(FALLBACK_LEAGUES, false)
/** Read again after this long; a failed read is tried again sooner. */
const FRESH_MS = 5 * 60_000
const RETRY_MS = 60_000

let current = FALLBACK
let readAt = 0
let loading: Promise<LeagueCatalog> | null = null

async function read(): Promise<LeagueCatalog> {
  const { rows } = await db.rawQuery(
    `SELECT l.slug, l.code, l.name, l.region, l.tier, l.priority,
            coalesce(array_agg(t.slug ORDER BY t.name) FILTER (WHERE t.id IS NOT NULL), '{}') AS teams
     FROM pro_league l LEFT JOIN pro_team t ON t.league_slug = l.slug
     GROUP BY l.slug
     ORDER BY l.priority, l.slug`
  )
  if (!rows.length) return FALLBACK
  return new LeagueCatalog(
    rows.map((r: Record<string, any>) => ({
      slug: String(r.slug),
      code: String(r.code),
      name: String(r.name),
      region: r.region ?? null,
      tier: Number(r.tier ?? 1),
      priority: Number(r.priority ?? 100),
      teams: (r.teams ?? []) as string[],
    })),
    true
  )
}

/** The catalog, read again when it is a few minutes old. Never throws: the fallback stands in. */
export function leagueCatalog(): Promise<LeagueCatalog> {
  if (Date.now() - readAt < FRESH_MS) return Promise.resolve(current)
  loading ??= read()
    .then((c) => {
      current = c
      readAt = Date.now()
      return c
    })
    .catch((error) => {
      logger.warn({ err: error }, 'pro leagues unreadable, using the built-in list')
      readAt = Date.now() - FRESH_MS + RETRY_MS
      return current
    })
    .finally(() => (loading = null))
  return loading
}

/** The catalog as last read (the fallback before the first read). */
export const catalog = () => current

/** What a page needs of a league: its address, short name, full name and region. */
export const leagueRef = (l: League) => ({
  slug: l.slug,
  code: l.code,
  name: l.name,
  region: l.region,
})
export type LeagueRef = ReturnType<typeof leagueRef>
