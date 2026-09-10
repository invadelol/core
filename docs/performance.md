# Performance changes

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
Independent ClickHouse response streams are consumed concurrently. Statistics
joins explicitly restrict match metadata to the requested match window.

HTTP caching stores Brotli-compressed JSON bytes directly in Redis. Compatible
clients receive these bytes without decompression, JSON parsing, or serialization
on cache hits. Other clients receive decoded JSON. Compression uses quality 4;
Riot match archive compression uses the same setting and remains readable by the
existing decompressor. This trades some compressed size for substantially less
compression work.

Concurrent cold requests to the same endpoint share one computation per server
process. Cache publication and key tracking are atomic, and generation checks
prevent pre-update queries from repopulating invalidated entries. Tracking sets
expire. Completed ingestion invalidates the match and every participant's
analytics before returning; rank updates invalidate again after ranks are stored.
Redis failures fall back to the controller response. Browser analytics caching
remains disabled, so persistent freshness still comes from Redis invalidation.

Hot game images use an LRU bounded to 512 entries and 32 MiB per server process.
Real assets expire after one hour; placeholders after 30 seconds. Mirror reads
use two concurrent requests instead of three sequential requests, preserving
stored image content types. Existing browser cache headers are unchanged.

## Local measurements

Measured September 10, 2026, with Node 26.7.0. The payload fixture contains 15
synthetic matches and 10 participants per match. Compression numbers are the
median of 20 iterations and exclude Redis, database, and network time.

| Measurement                                               |        Before |                   After |
| --------------------------------------------------------- | ------------: | ----------------------: |
| Chart/helper dependency loaded with profile               |     183.92 kB |                10.80 kB |
| Match-list JSON fixture                                   | 155,352 bytes |            87,402 bytes |
| Cache-miss compression of those payloads                  |     59.775 ms |                0.164 ms |
| Compression of the same original payload                  |     59.647 ms |                0.206 ms |
| Compressed fixture size                                   |   1,981 bytes |             2,465 bytes |
| Cache-hit decode/parse/serialize work                     |      0.576 ms | None for Brotli clients |
| Controller computations for 12 simultaneous cold requests |      Up to 12 |                       1 |
| Match-detail requests on scoreboard expansion             |             1 |                       0 |

The larger compressed fixture at quality 4 is intentional. This synthetic
fixture is unusually repetitive; production compression ratios will differ.
The chart runtime is deferred, not removed: it still downloads when a rank or
match chart is displayed. Main app and profile chunks gained a small amount of
coordination code.

## Verification and deployment

- Production client, SSR, and server build: `npm run build`.
- Backend type check: `npm run typecheck`.
- Vue type check: `vue-tsc --noEmit -p inertia/tsconfig.json` with TypeScript 5.8.3.
- 23 unit tests passed, including bounded asset caching and summary/scoreboard
  compatibility: `node ace test unit`.
- Eight Redis-backed cache tests passed against an isolated Redis 7 instance:
  `node ace test functional --files=tests/functional/http_cache.spec.ts`.
- Browser checks with mocked, delayed API responses covered SSR identity,
  independent panels, no redundant profile lookup, lazy charts, immediate
  scoreboards, timeline request reuse, superseded searches, navigation
  cancellation, and mobile overflow. No browser runtime errors were observed.
- Changed TypeScript files pass ESLint. Repository-wide lint has pre-existing
  failures in unrelated files. The existing health test requests `/health`,
  whereas the health API route is `/api/health`; it was not included in the
  focused functional run.

No database migration or new production dependency is required. Cache payloads
use a new `http_cache:v2:` namespace, so old entries expire naturally. Expect a
cold cache immediately after deployment. Memory limits apply per server process;
concurrent-request coalescing also applies per process, while invalidation is
shared through Redis.

Production end-to-end latency and ClickHouse query plans were not measured.
An isolated ClickHouse image pull did not complete, so SQL changes were reviewed
and the summary projection was fixture-tested, without a live database run.
Validate query plans and p50/p95 latency against representative production data
before assigning an overall speedup percentage.

References: [Vue performance guidance](https://vuejs.org/guide/best-practices/performance)
and [Node Brotli options](https://nodejs.org/api/zlib.html#brotli-options).
