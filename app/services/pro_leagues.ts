/**
 * The professional leagues the pro pages group teams by: each league's name, its logo (served by
 * `/cdn/league/:slug` from `resources/leagues`) and its teams of the 2026 season, by their slug in
 * `pro_team`. The pro tables hold teams and rosters but not which league a team plays in, so the
 * membership is kept here, one line per team, and changes when a league's teams do (once a year
 * for the franchised leagues).
 */

export interface League {
  slug: string
  /** The short name every page shows (LEC, LCK…). */
  code: string
  name: string
  /** Its teams, by slug. */
  teams: string[]
}

export const LEAGUES: League[] = [
  {
    slug: 'lec',
    code: 'LEC',
    name: 'League of Legends EMEA Championship',
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

const BY_TEAM = new Map(LEAGUES.flatMap((l) => l.teams.map((t) => [t, l] as const)))

export const leagueBySlug = (slug: unknown) =>
  LEAGUES.find((l) => l.slug === String(slug ?? '').toLowerCase()) ?? null

/** The league a team plays in (by its slug), or null. */
export const leagueOfTeam = (teamSlug: string | null | undefined) =>
  (teamSlug && BY_TEAM.get(teamSlug)) || null

/** What a page needs of a league: its address, short name, full name. */
export const leagueRef = (l: League) => ({ slug: l.slug, code: l.code, name: l.name })
export type LeagueRef = ReturnType<typeof leagueRef>
