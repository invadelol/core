import { shallowRef } from 'vue'
import type { SiteNav } from './home.js'
import { patchName } from './patch.js'
import { SHOW_RUNES } from './features.js'

/**
 * What the header's menus show beside their links (`/api/site/nav`): the tier list's sample, the
 * pros' counts, the pro game being played now and the team logos of the menus' pictures. Nothing
 * is fetched with the page: the first hover, focus or tap on a menu asks for it, once for the
 * whole visit, and every header on every page reads the same answer. A menu opened before it
 * lands paints its links at once and its figures a moment later.
 */
export const siteNav = shallowRef<SiteNav | null>(null)

let asked: Promise<void> | null = null

export function loadSiteNav() {
  if (asked || typeof window === 'undefined') return
  asked = fetch('/api/site/nav', { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? (r.json() as Promise<SiteNav>) : Promise.reject(r.status)))
    .then((nav) => {
      siteNav.value = nav
    })
    // A failed answer is asked again on the next open; the links never depended on it.
    .catch(() => {
      asked = null
    })
}

/* ── The site's map ─────────────────────────────────────────────────
   One place for every link the header, its sub-row, the phone's menu and the footer show, so they
   never disagree. A link's `here` says which addresses light it up (its sub-row entry and its
   section's trigger). Pages that do not exist yet are listed by the address they will have. */

/** The pictures of the menus (components/header/MenuArt.vue). */
export type MenuArtName =
  | 'champions'
  | 'items'
  | 'runes'
  | 'duos'
  | 'aram'
  | 'overview'
  | 'pros'
  | 'leagues'
  | 'teams'
  | 'solo'
  | 'flex'
  | 'otp'
  | 'proladder'
  | 'multi'
  | 'stats'
  | 'app'
  | 'newdawn'

export type SectionKey = 'tier-list' | 'esports' | 'leaderboards' | 'tools'

/** What a menu's figures read: the menus' data and the patch players know (26.22). */
export interface NavContext {
  nav: SiteNav | null
  /** The newest patch the statistics show, as players name it ("26.22"), when known. */
  patch: string | null
}

export interface NavLink {
  key: string
  /** In the menu and the phone's menu. */
  label: string
  /** In the sub-row and the footer, when it differs (the menu's "Pro ladder" is the sub-row's "Pros"). */
  short?: string
  href: string
  art: MenuArtName
  /** The menu's two grey lines: plain words, a figure only when the menus' data has it. */
  line: (ctx: NavContext) => string
  /** Addresses that light this link (and its section) up. */
  here: (path: string) => boolean
  /** Left out of the footer's column. */
  noFooter?: boolean
  /** Left out everywhere (a page that is not ready to be found). */
  hidden?: boolean
}

export interface NavSection {
  key: SectionKey
  label: string
  links: NavLink[]
  /** The menu's hairline footer link. */
  foot?: (ctx: NavContext) => { label: string; href: string } | null
  /** No plain-text row of its pages under the header (its pages share no theme). */
  noSubRow?: boolean
}

/**
 * The ARAM tier list waits for ARAM games (the crawler reads ranked only): its menu row, sub-row
 * entry and footer link stay hidden until this is turned on.
 */
export const SHOW_ARAM = false

const n = (value: number) => value.toLocaleString('en-US')
const starts =
  (...prefixes: string[]) =>
  (path: string) =>
    prefixes.some((p) => path === p || path.startsWith(`${p}/`))
const exact =
  (...paths: string[]) =>
  (path: string) =>
    paths.includes(path)

/** The patch notes of a patch, by the name players know (`/patch/26.22`). */
export const patchPath = (patch: string) => `/patch/${patchName(patch)}`

/**
 * New Dawn, Riot's 2027 update: first in the Patch menu, the patch notes' sub-row, the phone's
 * menu and the footer's Invade column.
 */
export const NEW_DAWN_LINK = {
  label: 'New Dawn',
  href: '/new-dawn',
  art: 'newdawn' as MenuArtName,
  line: "Riot's posts, rumours, January",
  /** Where the menu's patch rows show their date. */
  note: 'Reveal in Jan',
  here: starts('/new-dawn'),
}

const ALL_SECTIONS: NavSection[] = [
  {
    key: 'tier-list',
    label: 'Tier list',
    links: [
      {
        key: 'champions',
        label: 'Champions',
        href: '/tier-list',
        art: 'champions',
        line: ({ nav, patch }) =>
          nav?.tierList
            ? `Every champion in every role, from ${n(nav.tierList.games)} games on ${patchName(nav.tierList.patch)}`
            : `Every champion in every role${patch ? ` on ${patch}` : ''}, from our ranked games`,
        // A champion's own page and its matchups belong to the champions' tier list.
        here: (p) =>
          exact('/tier-list')(p) || starts('/tier-list/champions', '/champions', '/matchup')(p),
      },
      {
        key: 'items',
        label: 'Items',
        href: '/tier-list/items',
        art: 'items',
        line: () => 'Win and pick rate of every item, by role and class',
        here: starts('/tier-list/items'),
      },
      {
        key: 'runes',
        label: 'Runes',
        href: '/tier-list/runes',
        art: 'runes',
        line: () => 'Keystones, secondary trees and shards, with their win rates',
        here: starts('/tier-list/runes'),
        hidden: !SHOW_RUNES,
      },
      {
        key: 'duos',
        label: 'Duos',
        href: '/tier-list/duos',
        art: 'duos',
        line: () => 'Bot lane pairs, ranked by how often they win together',
        here: starts('/tier-list/duos'),
      },
      {
        key: 'aram',
        label: 'ARAM',
        href: '/tier-list/aram',
        art: 'aram',
        line: () => 'ARAM and Mayhem champions, and the augments they take',
        here: starts('/tier-list/aram'),
        hidden: !SHOW_ARAM,
      },
    ],
    foot: ({ patch }) =>
      patch ? { label: `What changed in ${patch}`, href: `/patch/${patch}` } : null,
  },
  {
    key: 'esports',
    label: 'Esports',
    links: [
      {
        key: 'overview',
        label: 'Overview',
        href: '/esports',
        art: 'overview',
        line: ({ nav }) =>
          nav?.live
            ? `${nav.live.league?.name ?? nav.live.tournament ?? 'A pro game'} live, every league and its results`
            : 'The games of the week, the power ranking and every league',
        here: starts('/esports'),
      },
      {
        key: 'leagues',
        label: 'Leagues',
        href: '/leagues',
        art: 'leagues',
        line: ({ nav }) => {
          const codes = (nav?.leagues ?? []).slice(0, 4).map((l) => l.code ?? l.short)
          return codes.length
            ? `${codes.join(', ')} and more: standings, playoffs and results`
            : 'Standings, playoffs and results of every league'
        },
        here: starts('/leagues', '/league'),
      },
      {
        key: 'teams',
        label: 'Teams',
        href: '/teams',
        art: 'teams',
        line: () => 'Starting fives, staff and results, season by season',
        here: starts('/teams', '/team'),
      },
      {
        key: 'pros',
        label: 'Pros',
        // The pros are found on their ladder; a pro's own page still belongs to Esports.
        href: '/leaderboards/pros',
        art: 'pros',
        line: ({ nav }) =>
          nav?.pros?.counts
            ? `${n(nav.pros.counts.players)} pros by their best solo queue account, and the champions they play`
            : 'Pros by their best solo queue account, and the champions they play',
        here: starts('/pros', '/pro'),
      },
    ],
  },
  {
    key: 'leaderboards',
    label: 'Leaderboards',
    links: [
      {
        key: 'solo',
        label: 'Solo/Duo',
        href: '/leaderboards/solo',
        art: 'solo',
        line: () => 'Challenger, Grandmaster and Master, in every region',
        here: (p) => exact('/leaderboards')(p) || starts('/leaderboards/solo')(p),
      },
      {
        key: 'flex',
        label: 'Flex',
        href: '/leaderboards/flex',
        art: 'flex',
        line: () => 'The best flex players, and the groups they climb with',
        here: starts('/leaderboards/flex'),
      },
      {
        key: 'one-tricks',
        label: 'One-tricks',
        href: '/leaderboards/one-tricks',
        art: 'otp',
        line: () => 'The best player on each champion, in every region',
        here: starts('/leaderboards/one-tricks'),
      },
      {
        key: 'pro-ladder',
        label: 'Pro ladder',
        short: 'Pros',
        href: '/leaderboards/pros',
        art: 'proladder',
        line: ({ nav }) =>
          nav?.pros?.counts
            ? `${n(nav.pros.counts.players)} pros, ranked by their best solo queue account`
            : 'Pros, ranked by their best solo queue account',
        here: starts('/leaderboards/pros'),
      },
    ],
  },
  {
    key: 'tools',
    label: 'Tools',
    noSubRow: true,
    links: [
      {
        key: 'multisearch',
        label: 'Multisearch',
        href: '/multisearch',
        art: 'multi',
        line: () => 'Paste five names from champion select and scout the lobby',
        here: starts('/multisearch'),
      },
      {
        key: 'stats',
        label: 'Stats',
        href: '/stats',
        art: 'stats',
        line: () => 'Champion stats by phase of the game, from Emerald+ games',
        here: starts('/stats'),
      },
      {
        key: 'app',
        label: 'Desktop app',
        href: '/app',
        art: 'app',
        line: () => 'Builds in champion select, and a score after each game',
        here: starts('/app'),
      },
    ],
    foot: () => ({ label: 'Free for Windows and macOS', href: '/app' }),
  },
]

/** The sections as every menu shows them: hidden pages left out. */
export const SECTIONS: NavSection[] = ALL_SECTIONS.map((s) => ({
  ...s,
  links: s.links.filter((l) => !l.hidden),
}))

/** The section an address belongs to, and its link there (none: home, a profile, a match…). */
export function placeOf(path: string): { section: NavSection; link: NavLink } | null {
  for (const section of ALL_SECTIONS) {
    const link = section.links.find((l) => l.here(path))
    if (link) return { section, link }
  }
  return null
}

/** The footer's columns: three sections and Invade itself. */
export const FOOTER_COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Tier list',
    links: SECTIONS[0].links
      .filter((l) => l.key !== 'duos')
      .map((l) => ({ label: l.short ?? l.label, href: l.href })),
  },
  {
    title: 'Leaderboards',
    links: SECTIONS[2].links.map((l) => ({ label: l.label, href: l.href })),
  },
  {
    title: 'Esports',
    links: SECTIONS[1].links.map((l) => ({ label: l.short ?? l.label, href: l.href })),
  },
]
