import type { HttpContext } from '@adonisjs/core/http'
import { desktopReleases } from '#services/desktop_release'

/** The page is useful without the version, so a slow GitHub never holds it up. */
const VERSION_WAIT_MS = 600

const DESCRIPTION =
  'Invade is a free League of Legends companion for Windows and macOS: objective timers and your pace in game, runes set in champ select, a score for every game, and automatic clips.'

export default class AppPageController {
  /** `/app`: what the desktop app does, and where to get it. */
  async show({ inertia }: HttpContext) {
    const release = await Promise.race([
      desktopReleases.latest().catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), VERSION_WAIT_MS)),
    ])
    return inertia.render('app', {
      version: release?.version ?? null,
      description: DESCRIPTION,
      social: {
        type: 'website',
        title: 'Invade for desktop · invade.lol',
        description: DESCRIPTION,
        url: 'https://invade.lol/app',
        image: 'https://invade.lol/landing/app-og.png',
        alt: 'Every game of League, timed, scored and clipped: the Invade desktop app’s Home, with rank and LP, scored games, clips and performance',
      },
    })
  }
}
