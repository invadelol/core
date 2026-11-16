import type { HttpContext } from '@adonisjs/core/http'
import { desktopReleases } from '#services/desktop_release'
import { changelog } from '#services/changelog'
import { discordServer } from '#services/discord_server'
import { runsText } from '../../inertia/lib/changelog.js'

/** The page is useful without the version, so a slow GitHub never holds it up. */
const VERSION_WAIT_MS = 600

const DESCRIPTION =
  'Invade is a free League of Legends companion for Windows and macOS: objective timers and your pace in game, runes set in champ select, a score for every game, and automatic clips.'

export default class AppPageController {
  /** `/app`: what the desktop app does, and where to get it. */
  async show({ inertia }: HttpContext) {
    const wait = <T>(load: Promise<T>) =>
      Promise.race([
        load.catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), VERSION_WAIT_MS)),
      ])
    const [release, log, discord] = await Promise.all([
      wait(desktopReleases.latest()),
      changelog().catch(() => null),
      wait(discordServer.counts()),
    ])
    const version = release?.version ?? null
    // The newest release the changelog dates: what "What is new" lists and when it shipped.
    const notes =
      log?.releases.find((r) => r.version === version && r.date) ??
      log?.releases.find((r) => r.date) ??
      null
    const latest = notes && {
      version: notes.version,
      day: notes.day,
      lines: [notes.hero, ...notes.features]
        .filter((f): f is NonNullable<typeof f> => Boolean(f))
        .map((f) => f.title ?? runsText(f.runs))
        .filter(Boolean)
        .slice(0, 4),
    }
    return inertia.render('app', {
      version,
      latest,
      discord,
      description: DESCRIPTION,
      social: {
        type: 'website',
        title: 'Invade for desktop | invade.lol',
        description: DESCRIPTION,
        url: 'https://invade.lol/app',
        image: 'https://invade.lol/landing/app-og-v2.png',
        alt: 'The Invade desktop app’s Home, with rank and LP, scored games, clips and performance, under the lines “A native app for League of Legends. Free for everyone.”',
      },
    })
  }
}
