import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { discordServer, type DiscordServer } from '#services/discord_server'
import { RENDERER } from '#services/og/version'
import { today } from '#services/page_meta'

const DESCRIPTION =
  'How to reach the Invade team: the Discord for help, feedback and bug reports, X for news.'

/** How long the page waits for Discord's counts on a cold cache before it renders without them. */
const COUNTS_WAIT_MS = 800

export default class ContactController {
  /**
   * `/contact`: the ways to reach the team. The email is a contact address the environment sets
   * (LEGAL_CONTACT_EMAIL), never the publisher's personal default: without one, the page has no
   * email. The Discord counts are left out when Discord is slow or unreachable.
   */
  async show({ inertia }: HttpContext) {
    const discord = await Promise.race<DiscordServer | null>([
      discordServer.counts(),
      new Promise((resolve) => setTimeout(() => resolve(null), COUNTS_WAIT_MS)),
    ])

    return inertia.render('contact', {
      email: String(env.get('LEGAL_CONTACT_EMAIL') ?? '').trim() || null,
      discord,
      description: DESCRIPTION,
      social: {
        type: 'website',
        title: 'Contact | invade.lol',
        description: DESCRIPTION,
        url: 'https://invade.lol/contact',
        canonical: 'https://invade.lol/contact',
        image: `https://invade.lol/og/home.jpg?v=${RENDERER}.${today()}`,
        imageType: 'image/jpeg',
        alt: 'The words “Look up any League player” over a champion’s splash art, the best pick of each role and a poro on the patch’s game count',
      },
    })
  }
}
