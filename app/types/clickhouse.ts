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
  queue_id: number

  puuid: string
  riot_id_game_name: string
  riot_id_tag_line: string
  profile_icon_id: number
  summoner_level: number

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

  dmg_to_turrets: number
  dmg_to_objectives: number
  physical_dmg_dealt: number
  magic_dmg_dealt: number
  true_dmg_dealt: number
  physical_dmg_to_champ: number
  magic_dmg_to_champ: number
  true_dmg_to_champ: number
  neutral_minions_killed: number
  vision_wards_bought: number

  all_in_pings: number
  assist_pings: number
  command_pings: number
  danger_pings: number
  enemy_missing_pings: number
  enemy_vision_pings: number
  get_back_pings: number
  need_vision_pings: number
  on_my_way_pings: number
  push_pings: number
  vision_cleared_pings: number
  bait_pings: number
  hold_pings: number
}

export type ClickhouseTimelineRow = {
  match_id: string
  platform: string
  game_start_ms: number
  frame_ms: number

  participant_id: number
  puuid: string
  team_id: number

  spell1: number
  spell2: number

  primary_style: number
  secondary_style: number
  keystone: number
  rune1: number
  rune2: number
  rune3: number
  rune4: number
  rune5: number
  rune6: number

  stat_offense: number
  stat_flex: number
  stat_defense: number

  skill_order: number[]

  level: number
  xp: number
  gold_current: number
  gold_total: number
  gold_per_sec: number

  cs: number
  jungle_cs: number

  kills: number
  deaths: number
  assists: number

  pos_x: number
  pos_y: number

  time_cc: number
}
