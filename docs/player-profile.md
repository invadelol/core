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
| `/:summoner/match/:matchId`          | The game's header, scoreboard, analysis, timeline and build   |
| `/:summoner/lens`                    | Redirects to `/champions`                                     |
| `/:summoner/history`                 | Redirects to the Overview match feed                          |

## Overview

The site's own layout, drawn with the package's components and materials (see
[design.md](design.md)). A rail on the left: the identity panel (icon, Riot ID,
region, level, last game and views over the main champion's artwork, with
Update, Share and Compare) and the sections as a vertical list. Beside it:

- **Performance**: win rate and the form squares, the average score (the dial)
  with its best and its trend, the five sub-scores, then KDA, kill
  participation, CS and gold per minute over the last 30 games, each as a line
  against the 30 games before it (dashed) with the change. The match-history
  filters re-cut both windows, so the figures describe the games listed below.
- **Match history**: the filtered record in the section rule, queue segments,
  Riot's role glyphs and a searchable champion combobox, then the shared match
  rows grouped by day. A row opens the game in place (Scoreboard, Breakdown,
  Gold, Timeline, Build) with a link to its own page; older games load as you
  scroll. Stored games load as fast as the list scrolls. Past them the API asks
  Riot for a few pages per player and address, then slowly; once that budget is
  spent the list simply ends, with no countdown, and a later scroll to the end
  tries again once the API's `Retry-After` has passed.

Under the sections, the rail carries **Ranked** (each queue's crest, LP and
record, and the LP climb of the queue with the most snapshots), **Champions**
(the top five, each filtering the feed), **Roles**, **Played with** and the
**Activity** calendar. On narrow screens the sections become tabs and the rail
follows the games.

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

One page, no tabs: the header (queue, date, each team's result, kills and
objectives, the clock and the gold race), then the package's views stacked
under anchors in a sticky bar. **Scoreboard** bands both teams with their
objectives and bans; **Analysis** is the Breakdown (a player against the lobby
and their lane opponent) and, with a stored timeline, the gold, XP and CS race;
**Timeline** needs the timeline's events; **Build** is the picked player's
items, runes and spells. Picking a player in one section follows through the
others; it starts on the player whose profile led here.

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
