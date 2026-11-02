import type { HttpContext } from '@adonisjs/core/http'
import { legalPublisher } from '#controllers/legal_controller'

const DESCRIPTION =
  'How to reach the Invade team: the Discord for help, feedback and bug reports, X for news.'

export default class ContactController {
  /** `/contact`: the ways to reach the team. The email is the publisher's, as /legal shows it. */
  async show({ inertia }: HttpContext) {
    return inertia.render('contact', {
      email: legalPublisher().email,
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
