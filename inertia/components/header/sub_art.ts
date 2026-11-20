/**
 * The small League picture beside each link of a section's sub-row (`SubArt.vue`): grey at rest,
 * in colour on hover and on the current page. Keyed by the links' keys in lib/site_nav.ts; a link
 * without one shows its words alone.
 */
export type SubPicture =
  /** A square picture, cropped to fill (a champion, an item, an augment). */
  | { kind: 'square'; src: string }
  /** A picture drawn whole on no tile (a rune, a league or team logo). */
  | { kind: 'logo'; src: string }
  /** A team's logo, once the menus' data names the team's id (`siteNav.art.teams`). */
  | { kind: 'team'; slug: string }
  /** A pro's photo in a round violet well. */
  | { kind: 'pro'; slug: string }
  /** A rank's crest, cropped to its square. */
  | { kind: 'emblem'; tier: string }
  /** Two champions overlapping (a bot lane pair). */
  | { kind: 'duo'; ids: [number, number] }
  /** A picture in a round violet well, drawn a little larger (New Dawn's Blitzcrank). */
  | { kind: 'round'; src: string }

export const SUB_ART: Record<string, SubPicture> = {
  // Tier list: Gwen, Rabadon's Deathcap, Electrocute, Kai'Sa and Nautilus, a Mayhem augment.
  'champions': { kind: 'square', src: '/cdn/champion/887.png' },
  'items': { kind: 'square', src: '/cdn/item/3089.png' },
  'runes': { kind: 'logo', src: '/cdn/perk/8112.png' },
  'duos': { kind: 'duo', ids: [145, 111] },
  'aram': { kind: 'square', src: '/menu-art/poroking.webp' },
  // Esports: the Worlds and LEC logos, a pro, Fnatic.
  'overview': { kind: 'logo', src: '/cdn/league/worlds?s=40' },
  'pros': { kind: 'pro', slug: 'vladi' },
  'leagues': { kind: 'logo', src: '/cdn/league/lec?s=40' },
  'teams': { kind: 'team', slug: 'fnatic' },
  // Leaderboards: the apex crests, Yasuo, the same pro.
  'solo': { kind: 'emblem', tier: 'challenger' },
  'flex': { kind: 'emblem', tier: 'grandmaster' },
  'one-tricks': { kind: 'square', src: '/cdn/champion/157.png' },
  'pro-ladder': { kind: 'pro', slug: 'vladi' },
  // Patch notes: New Dawn's Blitzcrank, cropped on his two eyes (they are what reads at 22 px).
  'new-dawn': { kind: 'round', src: '/menu-art/new-dawn-eyes.webp' },
}

/** A link of the row under the header: its words, its picture or the live patch's dot. */
export interface SubLink {
  label: string
  href: string
  on?: boolean
  art?: SubPicture
  dot?: boolean
}

/**
 * The patch notes' row (and New Dawn's): New Dawn first, then the patches with notes, newest first,
 * the newest with the live patch's dot.
 */
export function patchSubRow(patches: string[], path: string): SubLink[] {
  return [
    {
      label: 'New Dawn',
      href: '/new-dawn',
      on: path === '/new-dawn' || path.startsWith('/new-dawn/'),
      art: SUB_ART['new-dawn'],
    },
    ...patches.slice(0, 6).map((p, i) => ({
      label: p,
      href: `/patch/${p}`,
      on: path === `/patch/${p}`,
      dot: i === 0,
    })),
  ]
}
