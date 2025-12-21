import SummonerUpdated from '#events/summoner_updated'
import redis from '@adonisjs/redis/services/main'

export default class InvalidateSummonerCache {
  async handle(event: SummonerUpdated) {
    const { puuid } = event
    const set = `summoner:${puuid}:cache_keys`

    const keys = await redis.smembers(set)

    if (keys.length > 0) {
      await redis.del(...keys)
      await redis.del(set)
    }
  }
}
