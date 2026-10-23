# ClickHouse 0011: after deploying this branch

Production already has the target `participants` (runes, shards, skill order, `participant_id`,
sorted by player with a `match_id` projection), `matches` sorted by `match_id`, `skill_points` on
`match_timeline`, `participant_items` without `puuid` and the `match_events` codecs. What is left
needs this branch live first, because the code on `main` still reads the players' columns from
`match_timeline`.

Run in this order, as the database user, outside 08:00–14:00 UTC.

## 1. Fill the participant rows stored by the old code

Rows the site wrote with the code before this branch carry `participant_id = 0`. Fill them from
their timeline (rows of games without a timeline stay empty, as the readers expect):

```sql
CREATE TABLE default.tmp_players ENGINE = Join(ANY, LEFT, match_id, puuid) AS
SELECT match_id, any(puuid) AS puuid, participant_id,
       any(rune1) AS rune1, any(rune2) AS rune2, any(rune3) AS rune3, any(rune4) AS rune4,
       any(rune5) AS rune5, any(rune6) AS rune6, any(stat_offense) AS stat_offense,
       any(stat_flex) AS stat_flex, any(stat_defense) AS stat_defense,
       argMax(skill_order, frame_ms) AS skill_order
FROM default.match_timeline
WHERE match_id IN (SELECT match_id FROM default.participants WHERE participant_id = 0)
GROUP BY platform, match_id, participant_id;

ALTER TABLE default.participants UPDATE
  participant_id = joinGet('default.tmp_players', 'participant_id', match_id, puuid),
  rune1 = joinGet('default.tmp_players', 'rune1', match_id, puuid),
  rune2 = joinGet('default.tmp_players', 'rune2', match_id, puuid),
  rune3 = joinGet('default.tmp_players', 'rune3', match_id, puuid),
  rune4 = joinGet('default.tmp_players', 'rune4', match_id, puuid),
  rune5 = joinGet('default.tmp_players', 'rune5', match_id, puuid),
  rune6 = joinGet('default.tmp_players', 'rune6', match_id, puuid),
  stat_offense = joinGet('default.tmp_players', 'stat_offense', match_id, puuid),
  stat_flex = joinGet('default.tmp_players', 'stat_flex', match_id, puuid),
  stat_defense = joinGet('default.tmp_players', 'stat_defense', match_id, puuid),
  skill_order = joinGet('default.tmp_players', 'skill_order', match_id, puuid)
WHERE participant_id = 0 SETTINGS mutations_sync = 2;

DROP TABLE default.tmp_players;
-- check: rows left with participant_id = 0 should be games without a timeline only
SELECT count() FROM default.participants
WHERE participant_id = 0 AND match_id IN (SELECT match_id FROM default.match_timeline);
```

## 2. Stop the crawler's compatibility columns

The crawler (server only) still writes the players' columns on every frame
(`withPlayerColumns` in `src/parse.ts`) so `main` keeps working. Remove that function and its call,
then `sudo ./deploy.sh`.

## 3. Drop the players' columns from the timeline (about −1 GiB)

```sql
ALTER TABLE default.match_timeline FREEZE WITH NAME 'pre_timeline_drop';
ALTER TABLE default.match_timeline MODIFY COLUMN skill_points REMOVE DEFAULT;
ALTER TABLE default.match_timeline
  DROP COLUMN puuid, DROP COLUMN spell1, DROP COLUMN spell2, DROP COLUMN primary_style,
  DROP COLUMN secondary_style, DROP COLUMN keystone, DROP COLUMN rune1, DROP COLUMN rune2,
  DROP COLUMN rune3, DROP COLUMN rune4, DROP COLUMN rune5, DROP COLUMN rune6,
  DROP COLUMN stat_offense, DROP COLUMN stat_flex, DROP COLUMN stat_defense, DROP COLUMN skill_order;
```

Keep the snapshot a week (it holds the dropped columns, ~1 GiB), then
`ALTER TABLE default.match_timeline UNFREEZE WITH NAME 'pre_timeline_drop'`.

## 4. Record the migration

`node ace clickhouse:migration:run` in the site container. On a production database in this shape
0011 changes nothing and only records itself.

## 5. Clean up after a week

```sql
DROP TABLE default.participants_old_20261023;   -- 1.8 GiB, the pre-rebuild table
DROP TABLE default.matches_old_20261023;
ALTER TABLE default.league_entries UNFREEZE WITH NAME 'pre_league_merge_20261023';
ALTER TABLE default.participant_items UNFREEZE WITH NAME 'pre_items_puuid_20261023';
```

## 6. Before deploying `stats-perf`: the stats read paths (0012)

The champion pages of `stats-perf` read `match_lineups` (lane opponents and teammates), so its
tables must exist before that code is live. After step 4, as the database user (every statement
can run again: the table and view use `IF NOT EXISTS`, and a game inserted twice into
`match_lineups` changes nothing):

```sql
ALTER TABLE default.participants ADD PROJECTION IF NOT EXISTS by_champion (
  SELECT queue_id, champion_id, team_position, game_start_ms, match_id, participant_id, win,
         spell1, spell2, kills, deaths, assists, total_cs, gold_earned, dmg_to_champ, vision_score,
         primary_style, rune1, rune2, rune3, rune4, secondary_style, rune5, rune6,
         stat_offense, stat_flex, stat_defense, skill_order
  ORDER BY (queue_id, champion_id, team_position, game_start_ms)
);
ALTER TABLE default.participants MATERIALIZE PROJECTION by_champion;  -- background, a few minutes

CREATE TABLE IF NOT EXISTS default.match_lineups (
  patch    LowCardinality(String),
  match_id String,
  players  SimpleAggregateFunction(groupUniqArrayArray,
             Array(Tuple(UInt8, UInt16, String, UInt16))) CODEC(ZSTD(3))
) ENGINE = AggregatingMergeTree PARTITION BY patch ORDER BY (patch, match_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS default.match_lineups_mv TO default.match_lineups AS
SELECT patch, match_id,
  groupUniqArray(tuple(participant_id, team_id, toString(team_position), champion_id)) AS players
FROM default.participant_items WHERE queue_id = 420 GROUP BY patch, match_id;

INSERT INTO default.match_lineups
SELECT patch, match_id,
  groupUniqArray(tuple(participant_id, team_id, toString(team_position), champion_id)) AS players
FROM default.participant_items WHERE queue_id = 420 GROUP BY patch, match_id;
```

Check the projection is built (`SELECT count() FROM system.mutations WHERE table = 'participants'
AND NOT is_done` gives 0), then deploy, then run `node ace clickhouse:migration:run` once more: it
records 0012 (repeating its statements changes nothing).
