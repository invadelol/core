import { ApplicationService } from '@adonisjs/core/types'
import RiotApiService from '#services/riot_api_service'

export default class RiotApiProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(RiotApiService, () => {
      return new RiotApiService()
    })
  }
}