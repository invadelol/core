import type { HttpContext } from '@adonisjs/core/http'

export default class HomeController {
  /**
   * `/`: the search, the profiles this browser opened (kept on the device, so not sent from
   * here) and the desktop app. Nothing to read: the page never waits on storage or Riot.
   */
  async show({ inertia }: HttpContext) {
    return inertia.render('home', {})
  }
}
