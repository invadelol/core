import type { HttpContext } from '@adonisjs/core/http'
import { legalPublisher } from '#controllers/legal_controller'
import { discordServer, type DiscordServer } from '#services/discord_server'

const DESCRIPTION =
  'How to reach the Invade team: the Discord for help, feedback and bug reports, X for news.'

/** How long the page waits for Discord's counts on a cold cache before it renders without them. */
const COUNTS_WAIT_MS = 800

export default class ContactController {
  /**
   * `/contact`: the ways to reach the team. The email is the publisher's, as /legal shows it; the
   * Discord counts are left out when Discord is slow or unreachable.
   */
  async show({ inertia }: HttpContext) {
    const discord = await Promise.race<DiscordServer | null>([
      discordServer.counts(),
      new Promise((resolve) => setTimeout(() => resolve(null), COUNTS_WAIT_MS)),
    ])

    return inertia.render('contact', {
      email: legalPublisher().email,
      discord,
      description: DESCRIPTION,
      social: {
        type: 'website',
        title: 'Contact · invade.lol',
        description: DESCRIPTION,
        url: 'https://invade.lol/contact',
        image: 'https://invade.lol/landing/app-og-v2.png',
        alt: 'The Invade desktop app’s Home, with rank and LP, scored games, clips and performance, under the lines “A native app for League of Legends. Free for everyone.”',
      },
    })
  }
}
