import emitter from '@adonisjs/core/services/emitter'
import SummonerUpdated from '#events/summoner_updated'
import InvalidateSummonerCache from '#listeners/invalidate_summoner_cache'

emitter.on(SummonerUpdated, [InvalidateSummonerCache])
