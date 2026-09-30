import type { HttpContext } from '@adonisjs/core/http'
import { desktopReleases } from '#services/desktop_release'

/** The page is useful without the version, so a slow GitHub never holds it up. */
const VERSION_WAIT_MS = 600

export default class AppPageController {
  /** `/app`: what the desktop app does, and where to get it. */
  async show({ inertia }: HttpContext) {
    const release = await Promise.race([
      desktopReleases.latest().catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), VERSION_WAIT_MS)),
    ])
    return inertia.render('app', {
      version: release?.version ?? null,
      social: {
        type: 'website',
        title: 'Invade for desktop · invade.lol',
        description:
          'A free League of Legends companion for Windows and macOS: in-game overlay, champ select scouting, match analysis, builds and recording.',
        url: 'https://invade.lol/app',
        image: 'https://invade.lol/landing/og.png',
        alt: 'The Invade desktop app showing a dashboard with win rate, form and recent games',
      },
    })
  }
}
