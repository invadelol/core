ok donc premièrement, on va faire l'endpoints le plus crucial, c'est celui qui suit :

- /summoner/:summoner/refresh (les matches);

donc cet endpoint doit suivre les principes suivants :

- premièrement ça doit faire un vrai travail pour le summoner
  - donc utiliser le validator,
  - ensuite normaliser avec SummonerService.normalize
  - ensuite Checks database first. If not found, fetches from Riot API,
  * gets the puuid and summoner data, then upserts the player.
  * @param summoner - Summoner name in format "GameName-TagLine"
  * @returns Player entity with puuid, summonerId, profileIconId, summonerLevel, platform
  * @throws NotFoundException if summoner not found in Riot API
  - quand on a récupéré un summoner dont on est sur qu'il existe
  - on va récupérer 15 matchesId
  * 2.  Fetches match IDs from Riot API (default 20)
  * 3.  Filters out matches that already exist in database
        Tout ça dans un matchservice;

  Pour l'instant fais ça et on continuera plus tard, je veux que tu t'arrêtes et j'ai 20 matches ids prêt à fetch.

finalement j'ai surement pas vraiment besoin de postgres, je peux tout stocker dans le match dto même si c'est peut être pas le plus intéressant, mais genre dans le participant

pour l'instant il ressemble à ça
match_id String,
platform LowCardinality(String),

          game_start_ms   UInt64,

          puuid           String,
          team_id         UInt16,
          win             UInt8,

          champion_id     UInt16,
          team_position   LowCardinality(String),
          lane            LowCardinality(String),

          kills           UInt8,
          deaths          UInt8,
          assists         UInt8,
          champ_level     UInt8,

          total_cs        UInt16,
          gold_earned     UInt32,
          dmg_to_champ    UInt32,
          dmg_taken       UInt32,
          vision_score    UInt16,
          wards_placed    UInt16,
          wards_killed    UInt16,

          item0           UInt16,
          item1           UInt16,
          item2           UInt16,
          item3           UInt16,
          item4           UInt16,
          item5           UInt16,
          item6           UInt16,

          spell1          UInt16,
          spell2          UInt16,

          primary_style   UInt16,
          keystone        UInt16,
          secondary_style UInt16,

          ingested_at     DateTime DEFAULT now()

il faudrait rajouter des données comme le level, le gameName
gameTag, rank si disponible etc.. profile icon.

╰─────────────────────────────────────────────────╯
[17:47:41.993] INFO (15798): started HTTP server on 0.0.0.0:3333
[17:47:43.089] ERROR (15798): Resolve identifier 'participants.match_id' from parent scope only supported for constants and CTE. Actual default.participants.match_id node type COLUMN. In scope (SELECT team_id FROM my_matches WHERE match_id = participants.match_id).
request_id: "m6032n7ubh9nlpyqthdrw2bk"
x-request-id: "m6032n7ubh9nlpyqthdrw2bk"
err: {
"type": "ClickHouseError",
"message": "Resolve identifier 'participants.match_id' from parent scope only supported for constants and CTE. Actual default.participants.match_id node type COLUMN. In scope (SELECT team_id FROM my_matches WHERE match_id = participants.match_id). ",
"stack":
Error: Resolve identifier 'participants.match_id' from parent scope only supported for constants and CTE. Actual default.participants.match_id node type COLUMN. In scope (SELECT team_id FROM my_matches WHERE match_id = participants.match_id).
at parseError (/home/lschvn/Work/invade/api/node_modules/packages/client-common/src/error/error.ts:31:12)
at ClientRequest.onResponse (/home/lschvn/Work/invade/api/node_modules/packages/client-node/src/connection/node_base_connection.ts:567:25)
at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
"code": "1",
"status": 500
}
[17:48:07.166] ERROR (15798): Aggregate function avg(kills) AS kills is found inside another aggregate function in query.
request_id: "nr0yi0rcnizbtxbdl3l8d551"
x-request-id: "nr0yi0rcnizbtxbdl3l8d551"
err: {
"type": "ClickHouseError",
"message": "Aggregate function avg(kills) AS kills is found inside another aggregate function in query. ",
"stack":
Error: Aggregate function avg(kills) AS kills is found inside another aggregate function in query.
at parseError (/home/lschvn/Work/invade/api/node_modules/packages/client-common/src/error/error.ts:31:12)
at ClientRequest.onResponse (/home/lschvn/Work/invade/api/node_modules/packages/client-node/src/connection/node_base_connection.ts:567:25)
at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
"code": "184",
"status": 500
}

    [lschvn@louis-arch api]$ curl http://localhost:3333/summoners/g9MMDoUbjLTYuR5xzXqBG9EycNe4S09Csomx9e_6FfFuVfUBjzEJTfIez5vD0UKEOPcPFsfrXWcg7g/friends

curl: (7) Failed to connect to localhost port 3333 after 0 ms: Could not connect to server
[lschvn@louis-arch api]$ curl http://localhost:3333/summoners/g9MMDoUbjLTYuR5xzXqBG9EycNe4S09Csomx9e_6FfFuVfUBjzEJTfIez5vD0UKEOPcPFsfrXWcg7g/friends
curl: (7) Failed to connect to localhost port 3333 after 0 ms: Could not connect to server
[lschvn@louis-arch api]$ curl http://localhost:3333/summoners/g9MMDoUbjLTYuR5xzXqBG9EycNe4S09Csomx9e_6FfFuVfUBjzEJTfIez5vD0UKEOPcPFsfrXWcg7g/friends
{"message":"Resolve identifier 'participants.match_id' from parent scope only supported for constants and CTE. Actual default.participants.match_id node type COLUMN. In scope (SELECT team_id FROM my_matches WHERE match_id = participants.match_id). ","name":"Error","status":500,"frames":[{"file":"node_modules/packages/client-common/src/error/error.ts","filePath":"/home/lschvn/Work/invade/api/node_modules/packages/client-common/src/error/error.ts","line":31,"callee":"parseError","calleeShort":"parseError","column":12,"context":{},"isModule":true,"isNative":false,"isApp":false},{"file":"node_modules/packages/client-node/src/connection/node_base_connection.ts","filePath":"/home/lschvn/Work/invade/api/node_modules/packages/client-node/src/connection/node_base_connection.ts","line":567,"callee":"ClientRequest.onResponse","calleeShort":"onResponse","column":25,"context":{},"isModule":true,"isNative":false,"isApp":false},{"file":"node:internal/process/task_queues","filePath":"node:internal/process/task_queues","line":103,"callee":"process.processTicksAndRejections","calleeShort":"processTicksAndRejections","column":5,"context":{},"isModule":false,"isNative":false,"isApp":false}]}[lschvn@louis-arch api]$ curl httpcurl http://localhost:3333/summoners/g9MMDoUbjLTYuR5xzXqBG9EycNe4S09Csomx9e_6FfFuVfUBjzEJTfIez5vD0UKEOPcPFsfrXWcg7g/ranks
{"current":[],"history":[]}[lschvn@louis-arch api]$ curl http://localhost:3333/summoners/g9MMDoUbjLTYuR5xzXqBG9EycNe4S09Csomx9e_6FfFuVfUBjzEJTfIez5vD0UKEOPcPFsfrXWcg7g/stats
{"global":{"csMin":4.281248841191704,"visionMin":0.46709864816411345,"goldPerMinute":316.23076727092166,"damagePerMinute":531.7634617090015,"kda":1.2445951107715814,"killParticipation":0.38777525900446336,"damageShare":0.20134125911612366,"goldShare":0.18669672290125688,"winrate":0.29411764705882354,"total":"17"},"champions":[{"championId":45,"games":"8","winrate":0.375,"kda":1.0453598484848485},{"championId":99,"games":"3","winrate":0.3333333333333333,"kda":2.1666666666666665},{"championId":86,"games":"2","winrate":0.5,"kda":1.8333333333333333}]}[lschvn@louis-arch api]$ curl http://localhost:3333/summoners/g9MMDoUbjLTYuR5xzXqBG9EycNe4S09Csomx9e_6FfFuVfUBjzEJTfIez5vD0UKEOPcPFsfrXWcg7g/champions
{"message":"Aggregate function avg(kills) AS kills is found inside another aggregate function in query. ","name":"Error","status":500,"frames":[{"file":"node_modules/packages/client-common/src/error/error.ts","filePath":"/home/lschvn/Work/invade/api/node_modules/packages/client-common/src/error/error.ts","line":31,"callee":"parseError","calleeShort":"parseError","column":12,"context":{},"isModule":true,"isNative":false,"isApp":false},{"file":"node_modules/packages/client-node/src/connection/node_base_connection.ts","filePath":"/home/lschvn/Work/invade/api/node_modules/packages/client-node/src/connection/node_base_connection.ts","line":567,"callee":"ClientRequest.onResponse","calleeShort":"onResponse","column":25,"context":{},"isModule":true,"isNative":false,"isApp":false},{"file":"node:internal/process/task_queues","filePath":"node:internal/process/task_queues","line":103,"callee":"process.processTicksAndRejections","calleeShort":"processTicksAndRejections","column":5,"context":{},"isModule":false,"isNative":false,"isApp":false}]}[lschvn@louis-arch api]$

TODO list :

- ajoute ça pour comprendre ce qui prend du temps dans les requêtse merci : https://adonisjs.com/blog/introduction-adonisjs-opentelemetry

- surtout faire en sorte que les ranks ça fonctionne
- aussi ajouter un search pour les players, en ajoutant un ts vector.
- add a statistics global endpoint
- faire en sorte d'ajouter tout les summoners récupéré avec les matches. c'est plus pratique pour la recherche après.
- add leaderboard

  55 curl http://localhost:3333/swagger
  57 curl -I http://localhost:3333/swagger && curl -I http://localhost:3333/docs
  196 curl -I http://localhost:3000
  318 curl -X POST "http://localhost:3333/summoners/sync" -H "Content-Type: application/json" -d '{"summoner":"Louhi-727","platform":"EUW1"}'
  324 curl -X POST "http://localhost:3333/summoners/sync" -H "Content-Type: application/json" -d '{"summoner":"Louhi-727","platform":"EUW1"}'
  326 curl -X POST "http://localhost:3333/summoners/sync" -H "Content-Type: application/json" -d '{"summoner":"Louhi-727","platform":"EUW1"}'
  332 curl -X POST "http://localhost:3333/summoners/sync" -H "Content-Type: application/json" -d '{"summoner":"Louhi-727","platform":"EUW1"}'
  333 curl "http://localhost:3333/summoners/Louhi-727/matches?platform=EUW1"
  418 curl -X POST http://localhost:3333/summoners/sync -H "Content-Type: application/json" -d '{"summoner": "Louhi-727", "platform": "EUW1"}'
  419 curl http://localhost:3333/summoners/g9MMDoUbjLTYuR5xzXqBG9EycNe4S09Csomx9e_6FfFuVfUBjzEJTfIez5vD0UKEOPcPFsfrXWcg7g/activity
  420 curl http://localhost:3333/summoners/g9MMDoUbjLTYuR5xzXqBG9EycNe4S09Csomx9e_6FfFuVfUBjzEJTfIez5vD0UKEOPcPFsfrXWcg7g/friends
  422 curl http://localhost:3333/summoners/g9MMDoUbjLTYuR5xzXqBG9EycNe4S09Csomx9e_6FfFuVfUBjzEJTfIez5vD0UKEOPcPFsfrXWcg7g/friends
  423 curl http://localhost:3333/summoners/g9MMDoUbjLTYuR5xzXqBG9EycNe4S09Csomx9e_6FfFuVfUBjzEJTfIez5vD0UKEOPcPFsfrXWcg7g/friends
  424 curl http://localhost:3333/summoners/g9MMDoUbjLTYuR5xzXqBG9EycNe4S09Csomx9e_6FfFuVfUBjzEJTfIez5vD0UKEOPcPFsfrXWcg7g/friends
  425 curl http://localhost:3333/summoners/g9MMDoUbjLTYuR5xzXqBG9EycNe4S09Csomx9e_6FfFuVfUBjzEJTfIez5vD0UKEOPcPFsfrXWcg7g/ranks
  426 curl http://localhost:3333/summoners/g9MMDoUbjLTYuR5xzXqBG9EycNe4S09Csomx9e_6FfFuVfUBjzEJTfIez5vD0UKEOPcPFsfrXWcg7g/stats
  427 curl http://localhost:3333/summoners/g9MMDoUbjLTYuR5xzXqBG9EycNe4S09Csomx9e_6FfFuVfUBjzEJTfIez5vD0UKEOPcPFsfrXWcg7g/champions
  492 curl -X POST http://localhost:3333/summoners/sync -H "Content-Type: application/json" -d '{"summoner": "Louhi-727", "platform": "EUW1"}'
  493 curl -X POST http://localhost:3333/summoners/sync -H "Content-Type: application/json" -d '{"summoner": "Louhi-727", "platform": "EUW1"}'
  494 curl -X POST http://localhost:3333/summoners/sync -H "Content-Type: application/json" -d '{"summoner": "Louhi-727", "platform": "EUW1"}'
  495 curl http://localhost:3333/summoners/g9MMDoUbjLTYuR5xzXqBG9EycNe4S09Csomx9e_6FfFuVfUBjzEJTfIez5vD0UKEOPcPFsfrXWcg7g/activity
  496 curl http://localhost:3333/summoners/g9MMDoUbjLTYuR5xzXqBG9EycNe4S09Csomx9e_6FfFuVfUBjzEJTfIez5vD0UKEOPcPFsfrXWcg7g/friends
  497 curl http://localhost:3333/summoners/g9MMDoUbjLTYuR5xzXqBG9EycNe4S09Csomx9e_6FfFuVfUBjzEJTfIez5vD0UKEOPcPFsfrXWcg7g/ranks
  498 curl http://localhost:3333/summoners/g9MMDoUbjLTYuR5xzXqBG9EycNe4S09Csomx9e_6FfFuVfUBjzEJTfIez5vD0UKEOPcPFsfrXWcg7g/stats
  512 history | grep curl
  513 curl -X POST http://localhost:3333/summoners/sync -H "Content-Type: application/json" -d '{"summoner": "Beng-2121", "platform": "EUW1"}'
  514 curl -X POST https://invade.lschvn.foo/summoners/sync -H "Content-Type: application/json" -d '{"summoner": "Beng-2121", "platform": "EUW1"}'
  515 curl -X POST https://invade.lschvn.foo/summoners/sync -H "Content-Type: application/json" -d '{"summoner": "Beng-2121", "platform": "EUW1"}'
  517 curl -X POST https://invade.lschvn.foo/summoner/sync -H "Content-Type: application/json" -d '{"summoner": "Beng-2121", "platform": "EUW1"}'
  518 curl -X POST https://invade.lschvn.foo/summoner/sync -H "Content-Type: application/json" -d '{"summoner": "Beng-2121", "platform": "EUW1"}'
  522 curl -X POST https://invade.lschvn.foo/summoner/sync -H "Content-Type: application/json" -d '{"summoner": "Beng-2121", "platform": "EUW1"}'
  523 curl -X POST https://invade.lschvn.foo/summoner/sync -H "Content-Type: application/json" -d '{"summoner": "Beng-2121", "platform": "EUW1"}'
  524 curl -X POST https://invade.lschvn.foo/summoner/sync -H "Content-Type: application/json" -d '{"summoner": "CrauZmoZ-EUW", "platform": "EUW1"}'
  527 curl -X POST https://invade.lschvn.foo/summoner/sync -H "Content-Type: application/json" -d '{"summoner": "CrauZmoZ-EUW", "platform": "EUW1"}'
  529 curl -X POST https://invade.lschvn.foo/summoner/sync -H "Content-Type: application/json" -d '{"summoner": "CrauZmoZ-EUW", "platform": "EUW1"}'
  530 curl -X POST https://invade.lschvn.foo/summoner/sync -H "Content-Type: application/json" -d '{"summoner": "Beng-2121", "platform": "EUW1"}'
  532 curl -X POST https://invade.lschvn.foo/summoner/sync -H "Content-Type: application/json" -d '{"summoner": "MRS Paulux-KCWIN", "platform": "EUW1"}'
  I've now reviewed your codebase thoroughly. Here's my comprehensive analysis of your architecture, conventions, and areas for improvement:

Architecture & Structure Overview
Your project is a League of Legends statistics API built with AdonisJS v6, using:

PostgreSQL (via Lucid ORM) for player data
ClickHouse for match/participant analytics
Redis for caching
R2/S3 for raw match data storage
Overall, the architecture is solid for a personal project, but there are several areas worth improving.

🟢 What's Good
Clear separation of concerns: Controllers → Services → Data layer
Event-driven architecture with
SummonerUpdated
for cache invalidation and participant upserts
Good use of TypeScript types for ClickHouse rows and response types
Efficient caching middleware with stale-while-revalidate pattern
Clean utility functions in #utils/clickhouse for data transformation
Well-structured validators using VineJS
🔴 Areas for Improvement

1. README.md is a mess
   Your README is being used as a scratchpad with error logs, TODO lists, and curl commands. This should be:

A proper project description
Setup instructions
API documentation or link to Swagger
Move your TODOs to a separate TODO.md or use GitHub Issues 2. SQL Injection Vulnerability
In
clickhouse_service.ts
, you're using string interpolation for SQL queries:

typescript
query: `SELECT ... PREWHERE puuid = '${escapedPuuid}'`
While you have
escapeClickhouseString()
, this is fragile. Consider:

Using parameterized queries if the ClickHouse client supports them
At minimum, create a query builder abstraction to centralize escaping 3. Singleton Services Pattern
typescript
export default new SummonerService()
Every service exports a singleton instance. This makes:

Testing difficult (can't easily mock)
No dependency injection
Recommendation: Use AdonisJS's container bindings or return the class instead:

typescript
// Better for DI/testing
export default class SummonerService { ... }
// Then inject or use app.container 4. Route Organization
Your
routes.ts
has inconsistent patterns:

typescript
router.get('/summoners/search', ...) // uses query params
router.get('/summoners/:platform/:summoner', ...) // uses path params
router.get('/summoners/puuid/:puuid/activity', ...) // uses /puuid/ prefix
Consider:

Using route groups for better organization
Consistent URL structure (e.g., all puuid routes should be grouped)
Resource-based routing where applicable 5. Validator in Controller (Duplicated)
In
summoners_controller.ts
:

typescript
async champions({ request, params, response }: HttpContext) {
const { getChampionStatsValidator } = await import('#validators/summoner')
// ...
}
You're dynamically importing validators. Import them all at the top like syncSummonerValidator.

6. Error Handling
   Your services throw generic Exception:

typescript
throw new Exception('Invalid summoner format', { status: 422 })
Consider:

Creating custom exception classes (e.g., SummonerNotFoundException, InvalidFormatException)
Centralized error handling in
app/exceptions/handler.ts 7. ClickhouseService is Too Large
At 441 lines,
clickhouse_service.ts
does too much:

Getting existing match IDs
Ingesting matches
6+ different query methods
Recommendation: Split into:

ClickhouseMatchRepository (queries related to matches)
ClickhouseSummonerStatsRepository (stats queries)
ClickhouseIngestionService (write operations) 8. Magic Numbers
Throughout the code:

typescript
count: filters.count ?? 30 // Why 30?
count: 15 // Why 15?
LIMIT 20 // Why 20?
Create a constants file with named values:

typescript
// config/constants.ts
export const DEFAULT_MATCH_COUNT = 15
export const DEFAULT_FRIENDS_LIMIT = 20 9. Missing Input Validation in Routes
Some routes don't validate params:

typescript
async activity({ params, response }: HttpContext) {
const { puuid } = params // No validation!
// ...
}
PUUIDs have a specific format. Add validators for these routes too.

10. No Tests
    Your tests/ directory appears mostly empty. For an analytics API, you should have:

Unit tests for utility functions
Integration tests for ClickHouse queries
Controller tests for API endpoints 11. matches_controller.ts is Empty
You have an empty file
app/controllers/matches_controller.ts
. Either implement it or remove it.

12. Hardcoded Queue IDs
    In
    riot_constants.ts
    :

typescript
export const QUEUE_IDS = {
ranked: [420],
flex: [440],
...
}
This is fine, but document what these IDs represent (maybe link to Riot's docs in a comment).

13. Caching Strategy Improvements
    Your
    http_cache_middleware.ts
    has a potential issue:

typescript
private async refreshInBackground(
// ...
next: () => Promise<void>, // This calls the handler again
The next() function is designed to be called once. Calling it in the background while already having returned a response could cause issues.

14. Environment Files
    You have multiple env files that shouldn't be committed:

.env
.env.dev
.env.development
Only
.env.example
should be in git. Check your
.gitignore
.

15. Missing Error Logging
    In your middleware and listeners:

typescript
} catch {
return null // Silent failure
}
And:

typescript
.catch(() => {}) // Swallowed errors
Consider logging these errors for debugging.

File Structure Recommendations
app/
├── controllers/
├── models/
├── services/
│ ├── riot/ # Group Riot-related services
│ │ ├── api.ts
│ │ └── constants.ts
│ ├── analytics/ # ClickHouse-related
│ │ ├── queries.ts
│ │ └── ingestion.ts
│ └── caching/
├── exceptions/ # Custom exception classes
├── repositories/ # Data access layer (optional)
└── validators/
Quick Wins
Clean up
README.md
Add PUUID validation to all routes
Move dynamic imports to file top
Add logging to catch blocks
Delete empty
matches_controller.ts
Add comments to
riot_constants.ts
explaining queue IDs
Would you like me to help implement any of these improvements?
