import type { HttpContext } from '@adonisjs/core/http'
import homeService from '#services/home_service'

export default class HomeController {
  /**
   * `/`: search, then what invade.lol holds right now. Every figure comes from storage and a
   * few minutes' cache (app/services/home_service.ts); the page never waits on Riot.
   * `?v=2` lays the same sections out as a two-column dashboard.
   */
  async show({ inertia, request }: HttpContext) {
    const data = await homeService.overview()
    return inertia.render('home', { ...data, layout: request.input('v') === '2' ? 2 : 1 })
  }
}
