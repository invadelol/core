import type { IconName } from '@invadelol/ui'
import { compact } from '../../lib/format.js'
import type { SiteNav } from '../../lib/home.js'

/**
 * The site's sections, as the header's menus, the phone's menu and the footer list them: one
 * place for every link, so the three never disagree. A line under a link says what is there; one
 * that needs a figure reads it from the menus' data (`/api/site/nav`) and has a plain line until
 * it lands. Only pages the site has are listed.
 */

export type SectionKey = 'champions' | 'pros' | 'stats' | 'tools'

export interface SectionLink {
  href: string
  label: string
  /** A label that reads the menus' data (the patch's number); `label` until it lands. */
  title?: (nav: SiteNav | null) => string | null
  icon: IconName
  /** The line under the label; null leaves the link out of the menu (its data says it has none). */
  line: (nav: SiteNav | null) => string | null
  /** Also listed in the footer's column. */
  footer?: boolean
}

export interface Section {
  key: SectionKey
  label: string
  icon: IconName
  /** The pages that belong to the section: its trigger reads as the current place there. */
  here: (path: string) => boolean
  links: SectionLink[]
}

const fixed = (text: string) => () => text
const n = (value: number) => value.toLocaleString('en-US')

export const SECTIONS: Section[] = [
  {
    key: 'champions',
    label: 'Champions',
    icon: 'grid',
    here: (p) => p.startsWith('/champions') || p.startsWith('/tier-list'),
    links: [
      {
        href: '/tier-list',
        label: 'Tier list',
        icon: 'chart',
        line: (nav) =>
          nav?.tierList
            ? `Every role ranked on ${compact(nav.tierList.games)} games`
            : 'Every role ranked',
        footer: true,
      },
      {
        href: '/champions',
        label: 'All champions',
        icon: 'grid',
        line: (nav) =>
          nav?.tierList?.champions
            ? `${nav.tierList.champions} builds, runes and skill orders`
            : 'Builds, runes and skill orders',
        footer: true,
      },
      {
        href: '/champions?tab=matchups',
        label: 'Matchups',
        icon: 'swords',
        line: fixed('Who wins the lane, and by how much'),
        footer: true,
      },
      {
        href: '/champions?tab=items',
        label: 'Items',
        icon: 'coins',
        line: fixed('Win rate by slot for every item'),
        footer: true,
      },
      {
        href: '/champions?tab=runes',
        label: 'Runes',
        icon: 'zap',
        line: fixed('Keystones and full pages'),
        footer: true,
      },
      {
        href: '/stats?view=patch',
        label: 'Patch',
        title: (nav) => (nav?.tierList ? `Patch ${nav.tierList.patch}` : null),
        icon: 'refresh',
        // Only once there is a patch before to compare with.
        line: (nav) =>
          nav?.tierList?.previousPatch
            ? `Who climbed and who fell since ${nav.tierList.previousPatch}`
            : null,
      },
    ],
  },
  {
    key: 'pros',
    label: 'Pros',
    icon: 'users',
    here: (p) => p.startsWith('/pros') || p.startsWith('/pro/') || p.startsWith('/team/'),
    links: [
      {
        href: '/pros',
        label: 'Pro players',
        icon: 'users',
        line: (nav) =>
          nav?.pros?.counts
            ? `${n(nav.pros.counts.players)} players, ${n(nav.pros.counts.accounts)} accounts`
            : 'Players, their teams and accounts',
        footer: true,
      },
      {
        href: '/pros?view=teams',
        label: 'Teams',
        icon: 'shield',
        line: fixed('Rosters and their solo queue form'),
        footer: true,
      },
      {
        href: '/champions?tab=pros',
        label: 'Pro builds',
        icon: 'book',
        line: fixed('What pros run on each champion'),
        footer: true,
      },
      {
        href: '/pros?view=ladder',
        label: 'Ladder',
        icon: 'crown',
        line: fixed('Pros ranked by LP'),
        footer: true,
      },
    ],
  },
  {
    key: 'stats',
    label: 'Stats',
    icon: 'database',
    here: (p) => p.startsWith('/stats'),
    links: [
      {
        href: '/stats',
        label: 'Champion stats',
        icon: 'database',
        line: fixed('One table, every column, any filter'),
        footer: true,
      },
      {
        href: '/stats?view=early',
        label: 'Early game',
        icon: 'clock',
        line: fixed('Gold, CS and XP at 10 and 15 min'),
        footer: true,
      },
      {
        href: '/stats?view=length',
        label: 'Game length',
        icon: 'trend',
        line: fixed('Win rate from 15 to 40+ minutes'),
        footer: true,
      },
      {
        href: '/stats?view=firstblood',
        label: 'First blood',
        icon: 'skull',
        line: fixed('Who gets it, who gives it up'),
        footer: true,
      },
      {
        href: '/stats?view=items',
        label: 'Items',
        icon: 'coins',
        line: fixed('Buy rate and win rate by champion'),
      },
      {
        href: '/stats?view=regions',
        label: 'Regions',
        icon: 'globe',
        line: fixed('The same pick, server by server'),
      },
    ],
  },
  {
    key: 'tools',
    label: 'Tools',
    icon: 'sliders',
    here: (p) => p.startsWith('/multisearch'),
    links: [
      {
        href: '/multisearch',
        label: 'Multisearch',
        icon: 'users',
        line: fixed('Paste your lobby, read all five players'),
        footer: true,
      },
      {
        href: '/app/changelog',
        label: 'Changelog',
        icon: 'book',
        line: fixed('What changed in each version of the app'),
      },
      {
        href: '/contact',
        label: 'Contact',
        icon: 'lightbulb',
        line: fixed('Questions, bugs and ideas, on Discord'),
      },
    ],
  },
]

/** The tier list of each role, under the Champions menu. */
export const ROLE_LINKS = [
  { href: '/tier-list?role=top', label: 'Top', lane: 'TOP' },
  { href: '/tier-list?role=jungle', label: 'Jungle', lane: 'JUNGLE' },
  { href: '/tier-list?role=mid', label: 'Mid', lane: 'MID' },
  { href: '/tier-list?role=bot', label: 'Bot', lane: 'ADC' },
  { href: '/tier-list?role=support', label: 'Support', lane: 'SUPPORT' },
] as const

/** Riot's position (as the server sends it) to the shared role icons' lane and the site's words. */
export const POSITION = {
  TOP: { lane: 'TOP', label: 'Top', slug: 'top' },
  JUNGLE: { lane: 'JUNGLE', label: 'Jungle', slug: 'jungle' },
  MIDDLE: { lane: 'MID', label: 'Mid', slug: 'mid' },
  BOTTOM: { lane: 'ADC', label: 'Bot', slug: 'bot' },
  UTILITY: { lane: 'SUPPORT', label: 'Support', slug: 'support' },
} as const

export const positionOf = (p: string) => POSITION[p as keyof typeof POSITION] ?? POSITION.MIDDLE

/** A champion's page in one role. */
export const championHref = (slug: string, position: string) =>
  `/champions/${slug}?role=${positionOf(position).slug}`

export const TIER_LABELS = ['S+', 'S', 'A', 'B', 'C', 'D'] as const
