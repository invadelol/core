import emitter from '@adonisjs/core/services/emitter'
import SummonerUpdated from '#events/summoner_updated'
const InvalidateSummonerCache = () => import('#listeners/invalidate_summoner_cache')
const UpsertMatchParticipants = () => import('#listeners/upsert_match_participants')

emitter.on(SummonerUpdated, [InvalidateSummonerCache])
emitter.on(SummonerUpdated, [UpsertMatchParticipants])
// The sync controller awaits rank refresh and reports partial failure to callers.
// Running it again as a background listener duplicates Riot requests.
