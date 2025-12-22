import emitter from '@adonisjs/core/services/emitter'
import SummonerUpdated from '#events/summoner_updated'
import InvalidateSummonerCache from '#listeners/invalidate_summoner_cache'
import UpdateSummonerRank from '#listeners/update_summoner_rank'

emitter.on(SummonerUpdated, [InvalidateSummonerCache])
emitter.on(SummonerUpdated, [UpdateSummonerRank])
