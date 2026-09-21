# Player profile and match analysis

See [design.md](design.md) for the palette, themes and primitives.

## Routes

| Route                                | Content                                                       |
| ------------------------------------ | ------------------------------------------------------------- |
| `/`                                  | Search, plus the profiles this browser has opened             |
| `/:summoner`                         | Overview: ranked, performance trends, match history, rails    |
| `/:summoner/champions`               | Champion pool, win-rate heatmap and lifetime mastery          |
| `/:summoner/live`                    | Current lineup, spells, runes, tracked champion and rank data |
| `/:summoner/friends`                 | Lane partnerships and per-teammate synergy                    |
| `/:summoner/compare?with=Name%23Tag` | Two players on one table, same filters                        |
| `/:summoner/match/:matchId`          | Scoreboard, analysis and timeline on one page                 |
| `/:summoner/lens`                    | Redirects to `/champions`                                     |
| `/:summoner/history`                 | Redirects to the Overview match feed                          |

## Overview

A flat identity block, then four stacked sections with no boxes between them:

- **Ranked**: every ranked queue with its crest, LP and record, plus the LP
  climb for whichever queue has the most snapshots. Collapses to one line when
  the player is unranked.
- **Performance**: win rate, KDA, kill participation, CS per minute and gold
  per minute over the last 30 games, each with a sparkline and an arrow against
  the 30 games before it. The win-rate trend is a rolling average, because a run
  of ones and zeroes is not a trend. The match-history filters re-cut both
  windows, so the figures always describe the games listed below them.
- **Match history**: filters and the feed.
- **Rails**: champion pool, role split, recurring duos and an activity
  calendar, each as bars rather than lists of numbers.

Kill participation, damage share and gold share were already computed by the
API and were only rendered on a page nobody opened. Damage share and gold share
now live on Compare, where a second player gives them something to mean.

## Filters

Queue segments, Riot's own role glyphs as a segmented control, and a searchable
champion combobox carrying each champion's icon and sample size. The filtered
record prints in the section rule.

## Champions

One art-only splash banner for the most-played champion, a win-rate heatmap (one tile per
champion, the rate pulled towards even by two phantom games so one win is not a
100% champion), then the sortable pool. A second tab carries lifetime mastery:
points, level and progress to the next, for every champion Riot returns.

## Friends

Lane partnerships are counted game by game from the stored positions, not by
summing a teammate's games under their most common role, and each one carries
its record and the champion pairs that recur. A teammate row expands in place
into the player's own KDA, kill share, CS, gold and vision with them against
without them, the seats the two took with a record each, and the games
themselves.

## Compare

Autocomplete on a Riot ID, then the same window and filters applied to both
players: nine headline metrics as diverging bars, the games the two actually
shared with a per-game line, the same metrics cut by role, and the champion
pools split into what both play and what only one does.

Metrics are averaged the way `/stats` averages them server side (the mean of
per-game values), so a figure here matches the same figure on the profile.

## Match feed

One frame, banded by day, rather than fifteen separate cards. A row carries the
result, queue, duration, champion, spells, runes, champion and role, the score,
KDA, kill participation, CS and CS/min, gold, vision, a damage bar, items, both
line-ups and the player's rank in that lobby, plus a link to the match page and
a copy-link action.

Expanding a row opens three views in place: the full scoreboard, the timeline,
and build and runes. Opening a player inside that scoreboard fetches the full
match, because the list payload carries only the summary columns.

## Match page

One page, no tabs: header, scoreboard, analysis, timeline, with anchors in a
sticky rule.

**Scoreboard** is a single table for both teams, banded by side with each
side's kills, gold, objectives and bans on the band. Columns: player (with
champion, level, spells, runes and role), lobby rating with a bar, KDA, kill
participation, damage with its physical/magic/true split drawn in the bar,
damage taken, CS, gold, vision and wards, items.

Selecting any row expands it in place with that player's build, spells, skill
priority and full skill order, rune pages, every combat/vision/economy figure
against the lobby best, pings, the lane matchup as diverging bars, and the
gold, CS and XP difference at 10 and 15 minutes. There is no separate player
screen to navigate to.

**Analysis** holds the team comparison as one diverging axis, a damage profile
chart pairing damage dealt with damage taken for all ten players, and a
team-versus-team curve over time for gold, experience, creep score or kills.

**Timeline** is one scrubber driving a clock, playback, a clickable gold
advantage curve, the positions of all ten players on Riot's own minimap,
every player's level, score, gold and CS at that instant, and the focused
lane's gold, experience and creep score curves plus the running gold
difference.

Every player name in the product links to that player's profile.

## Data notes

- `participants.keystone` is now selected. It was ingested from the first patch
  but never read, so every rune glyph in a match list rendered empty.
- `matches.t1_bans` / `t2_bans`, `map_id` and `platform` are now selected.
- `match_timeline.pos_x` / `pos_y` power the map.
- Overview performance uses the latest 30 filtered matches and compares them
  with the previous 30. Compare and champion aggregates use up to 100 tracked
  matches. Filters apply before the sample limit.
- The Support control maps to Riot's stored `UTILITY` role.
- Mastery uses Riot's PUUID endpoint with a one-hour cache; live state uses
  spectator v5 with a 30-second cache. Only a spectator 404 means "not in a
  game". Observer credentials are never sent to the browser.
