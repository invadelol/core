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
   * 2. Fetches match IDs from Riot API (default 20)
   * 3. Filters out matches that already exist in database
    Tout ça dans un matchservice;

    Pour l'instant fais ça et on continuera plus tard, je veux que tu t'arrêtes et j'ai 20 matches ids prêt à fetch. 