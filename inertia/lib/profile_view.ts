import type { CustomizeData, ProfileHead, ProfileSettings, ShowcaseKey } from './invade_profile.js'
import { linkUrl } from './invade_profile.js'

/**
 * How the Invade profile page lays itself out and previews the owner's Customize choices before
 * they are saved.
 */

/**
 * The two columns of the Overview, each in the owner's order. Clips and friends need the wide
 * column, signature champions, builds and the season line sit in the narrow one; of the pinned
 * clip and the favourite four, the one the owner put first leads the wide column and the other
 * goes narrow (a big clip beside four posters, or four big posters beside a clip).
 */
export function overviewColumns(order: ShowcaseKey[]) {
  const lead = order.find((k) => k === 'pinned' || k === 'favorites')
  const wide = new Set<ShowcaseKey>(['clips', 'friends', ...(lead ? [lead] : [])])
  return {
    wide: order.filter((k) => wide.has(k)),
    narrow: order.filter((k) => !wide.has(k)),
  }
}

const art = (skin: number) => `${Math.floor(skin / 1000)}-${skin % 1000}`

/** The head as it will look with `draft` saved: backdrop, avatar, accent, frame, bio, links. */
export function previewHead(
  head: ProfileHead,
  draft: ProfileSettings,
  customize: CustomizeData
): ProfileHead {
  const owned = new Set(customize.backdrops.map((b) => b.id))
  const skin = draft.backdrop !== null && owned.has(draft.backdrop) ? draft.backdrop : null
  const backdrop = skin
    ? { url: `/cdn/splash/${art(skin)}.jpg`, skin }
    : customize.fallbackChampion
      ? { url: `/cdn/splash/${customize.fallbackChampion}.jpg`, skin: null }
      : null
  const icon = customize.iconId !== null ? `/cdn/profile-icon/${customize.iconId}.png` : null
  const avatarUrl = head.pro?.photo
    ? head.avatarUrl
    : draft.avatar !== 'icon' && skin
      ? `/cdn/tile/${art(skin)}.jpg`
      : icon
  return {
    ...head,
    bio: draft.bio.replace(/\s+/g, ' ').trim(),
    links: draft.links
      .filter((l) => l.handle.trim())
      .map((l) => ({ ...l, url: linkUrl(l.kind, l.handle.replace(/^@/, '')) })),
    accent: draft.accent,
    frame: draft.frame,
    backdrop,
    avatarUrl,
  }
}

/** An editable copy of the owner's choices, apart from the page's props. */
export const copySettings = (settings: ProfileSettings): ProfileSettings => ({
  ...settings,
  links: settings.links.map((l) => ({ ...l })),
  showcases: settings.showcases.map((s) => ({ ...s })),
  favorites: [...settings.favorites],
})

/** A clip's length: 21000 → "0:21". */
export function clipLength(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** A game clock from its start: "18:42". */
export function gameClock(startedAt: number, now: number) {
  const s = Math.max(0, Math.floor((now - startedAt) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const LANE_NAMES: Record<string, string> = {
  top: 'top',
  jungle: 'jungle',
  mid: 'mid',
  bottom: 'bottom',
  support: 'support',
}
