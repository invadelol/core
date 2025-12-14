export type ClickhouseMatchRow = {
  match_id: string
  platform: string
  queue_id: number
  patch: string
  game_start_ms: number
  duration_sec: number
  map_id: number

  t1_win: number
  t2_win: number

  t1_towers: number
  t2_towers: number
  t1_inhibs: number
  t2_inhibs: number
  t1_dragons: number
  t2_dragons: number
  t1_barons: number
  t2_barons: number
  t1_heralds: number
  t2_heralds: number

  t1_bans: number[]
  t2_bans: number[]
}

export type ClickhouseParticipantRow = {
  match_id: string
  platform: string
  game_start_ms: number

  puuid: string
  team_id: number
  win: number

  champion_id: number
  team_position: string
  lane: string

  kills: number
  deaths: number
  assists: number
  champ_level: number

  total_cs: number
  gold_earned: number
  dmg_to_champ: number
  dmg_taken: number
  vision_score: number
  wards_placed: number
  wards_killed: number

  item0: number
  item1: number
  item2: number
  item3: number
  item4: number
  item5: number
  item6: number

  spell1: number
  spell2: number

  primary_style: number
  keystone: number
  secondary_style: number
}

