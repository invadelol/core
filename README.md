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
