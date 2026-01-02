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
- make the docs work

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
