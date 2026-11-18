import type { HttpContext } from '@adonisjs/core/http'
import { desktopReleases } from '#services/desktop_release'
import { changelog } from '#services/changelog'
import { discordServer } from '#services/discord_server'
import { runsText } from '../../inertia/lib/changelog.js'
import { RENDERER } from '#services/og/version'
import { breadcrumbs } from '#services/page_meta'

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
        canonical: 'https://invade.lol/app',
        image: `https://invade.lol/og/app.jpg?v=${RENDERER}.${version ?? 'none'}`,
        imageType: 'image/jpeg',
        alt: 'The Invade desktop app’s Home in its window, with a poro leaning on it, beside the words “Invade for desktop, free on Windows and macOS”',
      },
      jsonld: [
        {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          'name': 'Invade',
          'url': 'https://invade.lol/app',
          'description': DESCRIPTION,
          'applicationCategory': 'GameApplication',
          'operatingSystem': 'Windows, macOS',
          'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'EUR' },
          'image': 'https://invade.lol/og/app.jpg',
          'publisher': { '@type': 'Organization', 'name': 'Invade', 'url': 'https://invade.lol/' },
          ...(version ? { softwareVersion: version } : {}),
          ...(notes?.day ? { dateModified: notes.day } : {}),
        },
        breadcrumbs([{ name: 'Desktop app', path: '/app' }]),
      ],
    })
  }
}
