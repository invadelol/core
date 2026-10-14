import type { HttpContext } from '@adonisjs/core/http'

const DESCRIPTION =
  'Look up any League of Legends player: rank, match history and a score for every game. Get Invade, the free desktop app for Windows and macOS.'

export default class HomeController {
  /**
   * `/`: the search, the profiles this browser opened (kept on the device, so not sent from
   * here) and the desktop app. Nothing to read: the page never waits on storage or Riot.
   */
  async show({ inertia }: HttpContext) {
    return inertia.render('home', {
      description: DESCRIPTION,
      social: {
        type: 'website',
        title: 'invade.lol · League of Legends profiles and the Invade desktop app',
        description: DESCRIPTION,
        url: 'https://invade.lol/',
        image: 'https://invade.lol/landing/app-og-v2.png',
        alt: 'The Invade desktop app’s Home, with rank and LP, scored games, clips and performance, under the lines “A native app for League of Legends. Free for everyone.”',
      },
    })
  }
}
