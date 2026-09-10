# Performance

Two rounds of work are recorded here. The first reshaped what the profile page
asks for and when. The second, below it, went after what it costs to answer.

---

# Round two: transport, caching tiers and query shape

Nothing in this round changes a database schema or adds a migration. Every
change is either a rewritten query against the existing tables, or application
code. Two fixes that do want a schema change are written up at the end as
recommendations rather than applied.

## Serving the front-end

The built front-end was served by `serve-static`, which does not compress and
defaults to `Cache-Control: max-age=0`. So every cold visit downloaded the raw
bytes, and every repeat visit spent a conditional request per file to be told
nothing had changed.

`static_assets_middleware` now answers `/assets` and `/fonts` from memory. Each
file is read once, compressed once with Brotli at quality 11, and kept with a
strong `ETag`. Quality 11 is unusable per request and exactly right for bytes
that never change. Vite content-hashes everything it writes to `/assets`, so
those responses are marked `immutable` and a returning browser reuses them with
no request at all.

Whether a file may be called `immutable` is decided by the directory it is in,
not by what its name looks like. A first attempt inferred it from the filename
and matched `inter-latin-400.woff2`, which would have pinned a stable-named font
for a year with no way to replace it.

Measured on the built output, for the files a cold profile view needs:

| File                | Before  |  After |
| ------------------- | ------: | -----: |
| `app-*.js`          | 280 501 | 89 905 |
| `summoner-*.js`     |  42 614 | 12 019 |
| `app-*.css`         |  29 940 |  5 784 |
| `chart-*.js`        |  12 748 |  4 295 |
| `links-*.js`        |   7 892 |  3 525 |
| `AppHeader-*.js`    |   1 908 |    933 |
| **Total**           | **375 603** | **116 461** |

That is 69% fewer bytes on a cold load, and on a repeat view six conditional
requests become zero.

Everything generated per request — server-rendered HTML, Inertia's navigation
JSON, search results — went out uncompressed too. `compression_middleware` now
encodes those on the way out. It rewrites the buffered body rather than wrapping
the socket, so streamed responses (the image proxy, static files) are never
touched, and it skips anything that already carries a `Content-Encoding`. The
home page went from 3 784 to 1 519 bytes.

Inter is now served from our own origin, with the `@font-face` rules carried in
the stylesheet the page already fetches. Loading it from a font CDN put a DNS
lookup, a TLS handshake and a second render-blocking stylesheet in front of the
first painted character. The two weights that carry most of the page are
preloaded. Only the subsets a page actually needs are downloaded; a typical
visitor fetches 48 kB of latin and nothing else.

`text-rendering: optimizeLegibility` was removed. It forces kerning and ligature
processing on every text run, which is not free on a page this dense in names
and numbers.

## Back/forward navigation

Inertia pages were sent with `Cache-Control: no-store`. The intent was that a
synced summoner never renders from a stale copy, and `no-cache` achieves exactly
that — the browser still revalidates before reusing anything. What `no-store`
additionally did was evict the page from the back/forward cache, so every Back
press re-fetched the HTML, re-booted Vue and re-issued all six analytics
requests. Freshness never needed that, and it is now `private, no-cache`.

## Cached analytics

The response cache gained a tier in front of Redis. Cached bytes are held in the
process, so a hit is a map lookup rather than a round trip, and a profile page
makes six cached requests before it can finish painting.

Correctness comes from the generation counter Redis already used plus a
broadcast: invalidating a resource publishes its name and every process drops
its copies. Because Redis pub/sub is fire-and-forget, entries also carry a short
TTL, so a lost message costs seconds of staleness rather than the full cache
lifetime. The invalidating process drops its own copies synchronously rather
than waiting for its own broadcast to return.

Responses now carry a strong `ETag` and `no-cache`. The freshness guarantee is
unchanged — the browser still asks on every request — but an unchanged answer
comes back as a bodyless 304 instead of the whole payload. The validator is
computed once when bytes enter the cache, so answering `If-None-Match` costs
nothing per request. Brotli and identity bodies get distinct validators rather
than sharing one and relying on every cache in the path to honour `Vary`.

The id-to-name maps behind `/cdn/names` are derived from a manifest that changes
once a patch and are requested on every profile view. They are now serialised and
compressed once an hour instead of per request, and answer `If-None-Match`.

## ClickHouse

Rows now arrive as `JSONCompactEachRow` — an array of values per row instead of
an object repeating every key. On a match list of 150 rows across ~45 columns the
key names are several times larger than the data. The `SELECT` clause and the
positional reader are generated from one column list, so the two cannot drift.

A match list used to resolve its match ids in one round trip and then fetch
metadata and participants in a second. The window of ids is now inlined into
both reads, so they start together; the id scan is a cheap ordered read over one
player's slice of the primary index, and running it twice concurrently costs far
less than a serial network round trip.

Two queries expressed "only these matches" as a JOIN. ClickHouse builds the hash
table from the right-hand side and streams the left one, so `participants` was
read in full. They now use an `IN` set, which lets the primary key and the
`match_id` bloom filter prune first.

Measured against the old queries on 400 000 participant rows (40 000 matches),
with results asserted identical:

| Query                 | Rows read           | Median time      |
| --------------------- | ------------------- | ---------------- |
| Recent participants   | 403 860 → 43 960    | 21.4ms → 13.3ms  |
| Teammates             | 403 860 → 356 120   | 16.0ms → 15.9ms  |

The teammates result is honest and worth reading carefully: the rewrite barely
helps there. `participants` is ordered by `(platform, puuid, …)`, so a player's
*teammates'* rows are scattered across the whole table by their own puuid, and
no `match_id` predicate can prune them. The query is inherently a wide read
given that sort order. The rewrite is kept because it is equivalent, clearer and
prunes when the matches are localised, but it is not a speed-up. See the
recommendation below for the change that would actually fix it.

Across the whole comparison suite — 19 cases covering every filter, view and
empty state — ClickHouse round trips fell from 40 to 35 and bytes read from
637 188 to 211 593, a 67% reduction.

## Postgres

`view_count` was incremented by reading the row, adding one in JavaScript and
writing it back. That is two round trips and a lost-update race. It is now a
single `UPDATE … RETURNING`. Measured with 50 concurrent requests against one
row:

```
read-then-write (before)   50 concurrent views recorded as 1
single statement (after)   50 concurrent views recorded as 50
```

`updateRanks` ran a query per queue to find the previous rank and an insert per
change. It now reads the newest row per queue with one `DISTINCT ON`, which
matches `riot_rank_latest_idx` exactly, and inserts the changes together.

Profile and search reads name their columns instead of `select *`. `riot_player`
carries a `search_vector` tsvector that Lucid discards on the way out but that
Postgres was still sending for every row.

Search results are cached for 60 seconds. Typeahead sends a request per pause in
typing and popular prefixes repeat across visitors. The stored-profile lookup
that runs in front of every server-rendered profile is cached the same way; it
returns values that change only when a player renames.

## The profile page

For a profile we already hold, the six analytics URLs are known server-side
before the browser has seen the bundle. They are now emitted as preload hints in
the document head, so the browser opens connections and starts fetching during
HTML parse rather than after the JavaScript has downloaded, parsed and hydrated.

The URLs are defined once, in `app/constants/analytics.ts`, and handed to the
page as a prop. The page issues exactly what was preloaded. Defining them on both
sides would mean a silent typo turns every hint into a wasted download.

`MatchList` derives each row's values once, in a computed, instead of calling
helpers from the template. The summary row alone referenced `me(match)` — a
linear search through ten participants — fifteen times per row, on every render.
It also now reads only from the list payload: every scoreboard field is present
there, so opening one match and loading its timeline no longer invalidates the
derived data for the other fourteen rows. Off-screen images are lazy.

The search box remembers the answers it has already received, so backspacing
through a query is instant, and a failed request leaves the previous list on
screen rather than clearing it — an empty list reads as "no such player", which
is not what a failed request means. Highlighting a result prefetches its page.

## Bugs found on the way

- `if (globalRows[0].total === 0)` compared `"0" === 0`, because ClickHouse
  serialises `UInt64` as a quoted string. The branch was dead, so a player with
  no games received `null` for every statistic. Counts are now numbers, which
  also fixes the same comparison in `PerformanceBand`.
- Concurrent profile views were being lost, as measured above.
- `killParticipation` was called with a non-null assertion on a participant that
  can legitimately be missing if ingestion was partial, and would have thrown.
- The health check test requested `/health`; the route is `/api/health`.

## Verification

- 35 unit tests and 11 functional tests pass (`node ace test`).
- Backend `tsc --noEmit` is clean. `vue-tsc` reports one pre-existing error in
  `MatchScoreboard.vue`, untouched here.
- ESLint is clean on every changed file; one pre-existing error remains in
  `config/swagger.ts`.
- Every rewritten ClickHouse query was run against a seeded database alongside
  the version it replaces, and the results asserted identical field by field.
  The harness is in `tmp/perf/`.
- The built server was run end to end and checked for asset headers and
  encoding, 304 revalidation on both assets and analytics, compressed HTML, the
  three cache tiers, preload hints, and the atomic view counter.
- The health check reports 503 on this machine because its disk-space check is
  over threshold. Database and Redis report healthy.

Production latency was not measured; there is no production-shaped dataset here.
The ClickHouse numbers come from a synthetic 400 000-row table.

## Recommended, not applied

Both of these need a schema change, so they are written up rather than made.

**The `search_vector` trigger fires on every write, including view counts.**
`update_riot_player_search_vector` recomputes the tsvector and rewrites the GIN
index entry on every `UPDATE riot_player`, so recording a profile view — which
touches nothing the index covers — churns the search index. That slows search
down over time through index bloat. Guarding it costs one condition:

```sql
CREATE OR REPLACE FUNCTION update_riot_player_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.game_name IS DISTINCT FROM OLD.game_name
     OR NEW.tag_line  IS DISTINCT FROM OLD.tag_line
  THEN
    NEW.search_vector := to_tsvector('simple',
      coalesce(NEW.game_name, '') || ' ' || coalesce(NEW.tag_line, ''));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Teammates needs a ClickHouse projection.** As measured above, that query reads
most of `participants` because the table is sorted by puuid and it needs to find
rows by `match_id`. A projection ordered by `match_id` would give it a sorted
path to the rows it wants:

```sql
ALTER TABLE participants ADD PROJECTION by_match
  (SELECT * ORDER BY match_id);
ALTER TABLE participants MATERIALIZE PROJECTION by_match;
```

Materialising rewrites existing parts, so it wants a quiet window and disk
headroom. Check the plan with `EXPLAIN indexes = 1` on real data first.

---

# Round one: what the profile page asks for

The profile now renders a stored player's identity in the initial HTML and starts
analytics without a separate browser profile lookup. Each panel displays as its
request completes, with its own loading placeholder. Navigation cancels pending
requests and timers; overlapping analytics refreshes cannot overwrite newer data.

Match scoreboards use the list data immediately. Graphs and runes request the
full match only when selected, and share the result for the lifetime of the list.
Chart.js loads when a chart renders. Large API payloads use shallow Vue refs,
timeline indexing is computed once for the expanded match, and collapsed rows
allow the browser to skip offscreen layout and painting.

The website requests `matches?count=15&view=summary`. This omits analysis-only
participant fields from the ClickHouse projection and JSON payload. Existing API
clients retain the complete list response by default (`view=full` is also
supported). Full match details remain available at `/api/matches/:id`.

HTTP caching stores Brotli-compressed JSON bytes directly in Redis. Compatible
clients receive these bytes without decompression, JSON parsing, or serialization
on cache hits. Other clients receive decoded JSON. Compression uses quality 4;
Riot match archive compression uses the same setting.

Concurrent cold requests to the same endpoint share one computation per server
process. Cache publication and key tracking are atomic, and generation checks
prevent pre-update queries from repopulating invalidated entries. Completed
ingestion invalidates the match and every participant's analytics before
returning; rank updates invalidate again after ranks are stored. Redis failures
fall back to the controller response.

Hot game images use an LRU bounded to 512 entries and 32 MiB per server process.
Real assets expire after one hour; placeholders after 30 seconds. Mirror reads
use two concurrent requests instead of three sequential requests.

### Local measurements

Measured September 10, 2026, with Node 26.7.0. The payload fixture contains 15
synthetic matches and 10 participants per match.

| Measurement                                               |        Before |                   After |
| --------------------------------------------------------- | ------------: | ----------------------: |
| Chart/helper dependency loaded with profile               |     183.92 kB |                10.80 kB |
| Match-list JSON fixture                                   | 155,352 bytes |            87,402 bytes |
| Cache-miss compression of those payloads                  |     59.775 ms |                0.164 ms |
| Cache-hit decode/parse/serialize work                     |      0.576 ms | None for Brotli clients |
| Controller computations for 12 simultaneous cold requests |      Up to 12 |                       1 |
| Match-detail requests on scoreboard expansion             |             1 |                       0 |
