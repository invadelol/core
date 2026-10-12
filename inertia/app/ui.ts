/**
 * invade.lol as host of `@invadelol/ui`, the views it shares with the desktop app. The site is
 * written in English, which is what the package speaks by default, so it brings no strings of its
 * own. Images come from the /cdn proxy, names from its name maps, and a link is a real URL
 * (crawlable, opens in a new tab) whose plain click is an Inertia visit.
 */
import { router } from '@inertiajs/vue3'
import { createInvadeUi, type LinkTarget } from '@invadelol/ui'
import { assetUrl, nameOf } from '../lib/assets.js'
import { profilePath } from '../lib/format.js'

/** Only players have a page of their own on the site. */
const linkTo = (to: LinkTarget) =>
  to.kind === 'player' && to.gameName && to.tagLine
    ? profilePath(to.gameName, to.tagLine)
    : undefined

export const invadeUi = () =>
  createInvadeUi({
    locale: 'en-US',
    assetUrl,
    name: nameOf,
    linkTo,
    onOpen: (to) => {
      const href = linkTo(to)
      if (href) router.visit(href)
    },
  })
