import type { HttpContext } from '@adonisjs/core/http'
import homeService from '#services/home_service'

export default class HomeController {
  /**
   * `/`: search, then what invade.lol holds right now. Every figure comes from storage and a
   * few minutes' cache (app/services/home_service.ts); the page never waits on Riot.
   */
  async show({ inertia }: HttpContext) {
    return inertia.render('home', await homeService.overview())
  }
}
