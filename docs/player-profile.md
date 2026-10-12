# Player profile and match analysis

See [design.md](design.md) for the palette, themes and primitives.

## Routes

| Route                                | Content                                                       |
| ------------------------------------ | ------------------------------------------------------------- |
| `/`                                  | Search, plus the profiles this browser has opened             |
| `/:summoner`                         | Overview: ranks, LP, champions, roles, teammates, games       |
| `/:summoner/champions`               | Champion pool, win-rate heatmap and lifetime mastery          |
| `/:summoner/live`                    | Current lineup, spells, runes, tracked champion and rank data |
| `/:summoner/friends`                 | Lane partnerships and per-teammate synergy                    |
| `/:summoner/compare?with=Name%23Tag` | Two players on one table, same filters                        |
| `/:summoner/match/:matchId`          | The game's header and its full detail                         |
| `/:summoner/lens`                    | Redirects to `/champions`                                     |
| `/:summoner/history`                 | Redirects to the Overview match feed                          |

## Overview

The desktop app's profile, drawn by the same components (`@invadelol/ui`, see
[design.md](design.md)). The header band holds the icon, Riot ID, level, last
game and both ranks with Riot's crest, over the main champion's artwork; the
sections and the page's actions (Update, Share) sit under it. Then the player's
tendencies beside their games:

- **LP history**: the stored rank readings of a queue as one line, when there
  are at least two.
- **Champions**: the loaded games per champion (record, KDA, CS/min, average
  score), and lifetime mastery as a second view of the same panel.
- **Roles** and **Played with** (teammates seen in at least two of the latest
  40 full games), both read from the loaded games, and the **Activity**
  calendar.
- **Match history**: queue, role, champion and order filters over the loaded
  games, the record and form they describe, and the feed grouped by day. A row
  opens the game in place (Scoreboard, Breakdown, Gold, Timeline, Build) with a
  link to its own page; older games load on demand.

A champion or role on the left filters the feed. On a phone the games come
first and the tendencies follow them.

## Champions

A win-rate heatmap (one tile per
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

## Match page

The match header (queue, date, each team's result and kills, the clock and the
gold race) over the same detail a profile row opens, every tab of it.
**Scoreboard** bands both teams with their objectives and bans; **Breakdown**
reads a player against the lobby and their lane opponent; **Gold** and
**Timeline** need the stored timeline (and its events), so older games show
the scoreboard, breakdown and build only.

Every player name in the product links to that player's profile.

## Data notes

- `participants.keystone` is now selected. It was ingested from the first patch
  but never read, so every rune glyph in a match list rendered empty.
- `matches.t1_bans` / `t2_bans`, `map_id` and `platform` are now selected.
- The match list also selects each player's `profile_icon_id`, for Played with.
- Compare and champion aggregates use up to 100 tracked matches. Filters apply
  before the sample limit.
- The Support control maps to Riot's stored `UTILITY` role.
- Mastery uses Riot's PUUID endpoint with a one-hour cache; live state uses
  spectator v5 with a 30-second cache. Only a spectator 404 means "not in a
  game". Observer credentials are never sent to the browser.

## Link previews

Stored profiles include Open Graph and Twitter large-image metadata in the
initial HTML. `/og/:summoner` renders a public 1200×630 PNG with the main
champion's artwork and the latest 30-game win rate, KDA and CS/min. Rendering
uses Sharp on the server; crawlers do not need JavaScript or authentication.
Images are cached for five minutes with a bounded memory cache and concurrent
request coalescing. Missing analytics or artwork produces an uncached fallback
so an upstream outage does not persist in the application cache. Unknown
profiles return 404 from the image endpoint until the profile has been tracked.
Social platforms may retain their own cached previews longer.

## Sitemap

`/sitemap.xml` lists the homepage and every distinct named player stored in
`riot_player`, using canonical `https://invade.lol/GameName-TagLine` URLs.
Names are URL-encoded and XML-escaped. The list is read from the database,
with a five-minute HTTP cache, so newly stored players appear automatically.
Above 10,000 players it becomes an index of paginated sitemaps, keeping each
response bounded. `/robots.txt` advertises the sitemap to crawlers.
