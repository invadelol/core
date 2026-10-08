# Desktop ↔ core: onboarding and match sync (contract v1)

The Invade desktop app (`invadelol/app`, Tauri + Rust) reads League data from the League client's
local API (LCU) on the player's computer. This contract lets it:

1. **Onboard** a player by Riot ID when the League client is closed (core resolves it with the Riot API).
2. **Upload finished games** the player took part in, with their LP change when it is known, so the
   website shows them seconds after the game without match-v5 calls.

Both sides implement exactly this document. Anything not written here is out of scope for v1.

## 0. Ground rules

- **Publishing is part of using the app.** Every finished, matchmade game the signed-in account
  played is uploaded; the app says so in Settings → invade.lol (what is sent and when) and
  there is no switch. A device is registered as soon as an account signs in or onboarding ends.
- **Only finished games the uploader played.** Never champ select, never a game in progress, never
  data the client hides (enemy names in ranked champ select). Only matchmade games
  (`gameType == "MATCHED_GAME"`) in the queues of §4.3.
- **Never invent data.** A field the client does not give is absent, not zero. The server records
  what is missing (`completeness`) and the website hides it. An LP change exists only when the
  app holds a ranked snapshot from before the game and one after it, exactly one game apart (§4.4).
- **Two identities.** The LCU identifies players by a raw PUUID (36-char UUID,
  `5c8a…-…`). The Riot API returns PUUIDs encrypted per API key (78 chars). They are never
  compared to each other. Core maps raw → API PUUIDs through Riot IDs (§3).
- **Riot policy.** Desktop data is what Riot already makes public through match-v5 for the
  player's own games. Core keeps every existing Riot API limit (`CoalescingRiotAPI`, the
  `@fightmegg` limiter); this design only removes calls.

## 1. Transport and authentication

- Base URL: `https://invade.lol` (desktop debug builds: env `INVADE_CORE_URL`, e.g. `http://localhost:3335`).
  Release builds ignore the variable.
- JSON bodies, UTF-8. Every desktop request sends `User-Agent: Invade/<version> (<os>)`.
- Authenticated routes take `Authorization: Bearer <token>` **and a signature (§1.1)**. Tokens are
  32 random bytes, base64url, prefixed `inv_dev_`. Core stores only their SHA-256, never the token.
- Errors use core's existing shape: `{ "errors": [{ "message": "...", "code": "E_..." }], "retryAfter"?: s }`
  plus a `Retry-After` header for 429/503.

| status | code | desktop reaction |
| --- | --- | --- |
| 400/422 | `E_VALIDATION_ERROR`, `E_INVALID_MATCH`, `E_INVALID_LP`, `E_RIOT_ID_MISMATCH` | permanent: drop the item, remember the code |
| 401 | `E_DEVICE_UNAUTHORIZED`, `E_BAD_SIGNATURE` | forget the token, register again (once), retry |
| 401 | `E_CLOCK_SKEW`, `E_REPLAY` | correct the clock offset from `Date` / re-sign with a fresh timestamp, retry once (§1.1) |
| 403 | `E_NOT_LINKED` | link the uploader (§2.3), retry once |
| 404 | `E_SUMMONER_NOT_FOUND` | resolve: "no such Riot ID" |
| 413 | `E_PAYLOAD_TOO_LARGE` | permanent: drop the timeline, retry once without it |
| 429 | `E_RATE_LIMITED`, `E_RIOT_RATE_LIMITED` | wait `Retry-After` (min 60 s) |
| 503 | `E_UPLOADS_PAUSED`, `E_RIOT_UNAVAILABLE` | wait `Retry-After` (min 5 min) |
| 5xx / network | — | exponential backoff (§5.3) |

Core notes: every `/api/desktop/*` client error carries a `code` from this table (`E_VALIDATION_ERROR`
entries also keep VineJS's `field` and `rule`). Riot rate limiting answers 429 `E_RIOT_RATE_LIMITED`;
any other Riot failure, a rejected API key included, answers 503 `E_RIOT_UNAVAILABLE`. A 413 is
answered after reading the body (up to 16 MB), so the app receives it instead of a broken pipe.

### 1.1 Request signing and replay protection (contract v1.2)

TLS (certificate validation, no cross-host redirects) already stops anyone on the network from
reading or altering a call. Signing adds two things: the device secret never travels after
registration (a leaked log, proxy capture or HAR file is useless), and a captured request cannot
be replayed or modified.

- `POST /api/desktop/devices` answers `{ "deviceId", "token", "secret" }`. `secret` is 32 random
  bytes, hex (64 chars), shown once. Core stores it encrypted with the app key (`encryption`
  service, never in clear, never logged); the token stays SHA-256 only.
- Every authenticated request (`Authorization: Bearer <token>`) also sends:
  - `X-Invade-Timestamp`: epoch milliseconds;
  - `X-Invade-Signature`: lowercase hex HMAC-SHA256 with the secret over
    `"v1\n" + timestamp + "\n" + METHOD + "\n" + path_with_query + "\n" + hex(SHA-256(raw body bytes))`
    (empty body → SHA-256 of the empty string).
- Core rejects (401) a missing or wrong signature (`E_BAD_SIGNATURE`), a timestamp more than 5 min
  away from its clock (`E_CLOCK_SKEW`, the response's `Date` header lets the app correct its offset
  and retry once), and a signature already seen in the last 10 min (`E_REPLAY`, Redis `SET NX` with
  a 10-min TTL). Comparison is constant-time. Optional-auth routes (`/resolve`) verify the signature
  whenever a token is sent.
- Desktop reactions: `E_CLOCK_SKEW` → offset from `Date`, re-sign, retry once; `E_BAD_SIGNATURE` →
  register again (like `E_DEVICE_UNAUTHORIZED`); `E_REPLAY` → re-sign with a fresh timestamp, retry
  once. The app never logs the token, the secret or a signature.
- A device registered before signing existed has no secret: it gets 401 `E_DEVICE_UNAUTHORIZED`
  and registers again.
- The HMAC key is the secret exactly as received: its 64 hex characters as ASCII bytes (Node
  `createHmac('sha256', secret)` with the hex string), not the 32 bytes they encode.

Core notes: `path_with_query` is the request target exactly as it appears in the request line
(`/api/desktop/resolve?gameName=Louhi&tagLine=727`, encoded as sent). The body hash covers the bytes
as they arrived, hashed while the body parser reads them. Checks run in this order: token
(`E_DEVICE_UNAUTHORIZED`), secret present (`E_DEVICE_UNAUTHORIZED`), both headers present and well
formed — a timestamp of digits, a signature of exactly 64 lowercase hex characters
(`E_BAD_SIGNATURE`), clock (`E_CLOCK_SKEW`, ±5 min inclusive), signature (`E_BAD_SIGNATURE`),
replay (`E_REPLAY`). Only a valid signature enters the replay cache, under a SHA-256 of itself; if
Redis is down the request is allowed (the 5-min window still bounds a replay), as the rate
limiter does. Body-size limits (413) apply before authentication. Core's logs redact
`Authorization`, `X-Invade-Signature` and any `token`/`secret`/`signature` field.

### 1.2 What signing cannot stop, and what core does about it

Whoever controls a computer can read its device secret and craft requests: no desktop app can
prevent that. So core never takes desktop data on faith:

- everything is validated (shape, ranges, consistency) and rate limited per device and IP;
- desktop data is stored with its provenance (`source = 'desktop'`, `device_id`) and Riot's own
  data always supersedes it;
- **trust is slow to earn**: ≥ 5 uploads verified against match-v5, on ≥ 3 different days, from a
  device at least 3 days old, with no mismatch;
- **trust is checked continuously**: 1 in 10 trusted match uploads and 1 in 20 applied player
  snapshots are verified against Riot afterwards (one call, budgeted, best effort);
- **a lie costs the device everything**: one mismatch revokes it, marks all its data `conflict`,
  deletes the `riot_rank` rows it wrote (`device_id` on desktop rows) and re-reads the affected
  players from Riot when they are next viewed;
- other players' ranks from an untrusted device are only applied when a second device on another
  network confirms them (§6.4).

Core notes: days are UTC days, counted when the day of a match-v5 confirmation differs from the
previous one (`desktop_device.verified_days`); a player-snapshot audit that passes does not count
towards trust. The sample rates are constants (`MATCH_AUDIT_ONE_IN = 10`, `PLAYER_AUDIT_ONE_IN =
20`). A sampled snapshot is read back with one league-v4 call a minute after it is applied (one
retry at 4 min on a Riot 5xx; skipped while Riot rate limits) and judged only if Riot was read
within 10 min of `observedAt`. Only what no honest client could report is a mismatch: fewer wins
(or fewer known losses) than reported, or — when no game provably ended in between — another
tier or division, or LP more than 30 away. A game that ended since (more wins, more known
losses) makes the queue inconclusive, and for another player, whose losses are hidden, a drop of
up to 100 ladder points (one unseen loss, a demotion) is inconclusive too. Riot's answer is
stored like any league-v4 read. On any mismatch (match or player) the device is revoked; its
unverified games become `conflict` with their LP hidden; its player reports become `conflict`;
the `riot_rank` rows, rank confirmations and mastery snapshots it wrote are deleted; the response
caches of every player touched are dropped. Profiles then show Riot's own older rows, and the
next read past the freshness windows of §6.5 (resolve, the website's Update) asks Riot again.
Icons, levels and verified renames a device applied are not reverted.

## 2. Endpoints

All under `/api/desktop`. Rate limits are Redis fixed windows per device and per client IP;
exceeding one answers 429 with `Retry-After`.

### 2.1 `GET /api/desktop/config` (public)

```json
{ "uploads": true, "resolve": true, "maxPayloadBytes": 2000000, "minAppVersion": null }
```

Kill switches from env (`DESKTOP_UPLOADS_ENABLED`, `DESKTOP_RESOLVE_ENABLED`, default true). The
desktop reads it at most every 6 h, and before its first upload after a launch. A switched-off feature
answers 503 `E_UPLOADS_PAUSED` (resolve included) with `Retry-After: 1800`. `minAppVersion` comes
from `DESKTOP_MIN_APP_VERSION` (unset: `null`).

### 2.2 `POST /api/desktop/devices` (public, 10 / hour / IP)

Request `{ "app": "0.2.7", "os": "macos" | "windows" }` → `201 { "deviceId": "<uuid>", "token": "inv_dev_…", "secret": "<64 hex>" }`.
The token and the secret are shown once (§1.1). `DELETE /api/desktop/devices/me` (auth) revokes it → `204`.

### 2.3 `POST /api/desktop/link` (auth, 20 / hour / device)

Makes an account one of this device's uploaders.

```json
{ "gameName": "Louhi", "tagLine": "727", "platform": "EUW1", "rawPuuid": "5c8a…" | null, "source": "lcu" | "riot_id" }
```

Core resolves the Riot ID to the API PUUID (stored `riot_player` first, else account-v1 + the
existing multi-platform discovery), stores the link and, when `rawPuuid` is given, the alias
`rawPuuid → API puuid` (§3). → `200 { "puuid": "<api puuid>", "profileUrl": "https://invade.lol/Louhi-727" }`.
Unknown Riot ID: 404. `DELETE /api/desktop/link/:puuid` (auth) unlinks → `204`.
A `rawPuuid` that match-v5 already tied to another account answers 422 `E_RIOT_ID_MISMATCH`; an
unsupported platform answers 422 `E_VALIDATION_ERROR`. A later `riot_id` link keeps the raw PUUID an
earlier `lcu` link stored.

### 2.4 `GET /api/desktop/resolve?gameName=…&tagLine=…` (auth optional: 30 / hour / device, 20 / hour / IP without a token)

Onboarding without the League client. The device may not be registered yet at that point: the IP
limit applies. Uses `summonerService.resolveAndUpsert` (coalesced, cached),
ranks from `riot_rank` (league-v4 only when none is stored or the newest is older than 10 min),
mastery top 5 (champion-mastery-v4, cached 1 h), and recent games **from ClickHouse only** (no
match-v5 call during onboarding).

```json
{
  "puuid": "<api puuid>", "gameName": "Louhi", "tagLine": "727", "platform": "EUW1",
  "profileIconId": 6634, "summonerLevel": 412,
  "solo": { "tier": "EMERALD", "division": "II", "lp": 64, "wins": 61, "losses": 52 } | null,
  "flex": null,
  "mastery": [{ "championId": 45, "championLevel": 38, "championPoints": 402115, "lastPlayTime": 1791400000000 }],
  "recent": [{ "matchId": "EUW1_…", "championId": 45, "win": true, "queueId": 420, "gameStartMs": 1791400000000, "durationSec": 1810, "kills": 7, "deaths": 2, "assists": 9 }],
  "profileUrl": "https://invade.lol/Louhi-727",
  "fetchedAt": 1791450000000, "stale": false
}
```

Errors: 404 `E_SUMMONER_NOT_FOUND`, 429, 503 (`stale: true` with stored data when Riot fails but
the player is stored).

Core notes: an optional `platform` query parameter skips platform discovery. `recent` holds the
player's latest 20 stored games, newest first, and `mastery` the 5 entries with the most points.
A token that is present must be valid (401 otherwise); without one the IP limit applies. When a
rank or mastery refresh fails, the stored values are returned with `stale: true`. Since v1.1 the
10-min rule counts a desktop rank and a rank confirmation as well (§6.5), and `mastery` comes from
a desktop snapshot younger than 24 h when there is one. `solo`/`flex` also carry `source` (`riot` |
`desktop`) and `observedAt` (epoch ms), and `mastery` entries `source` and `observedAt`. **`losses`
is `null`** when the newest rank of that queue came from another player's client (§6.4), which
hides losses.

### 2.5 `POST /api/desktop/matches` (auth, 30 / hour / device, 120 / hour / IP, body ≤ 2 MB)

```jsonc
{
  "schema": 1,
  "matchId": "EUW1_7998180573",          // `${game.platformId}_${game.gameId}`
  "uploader": "5c8a…",                    // raw PUUID of the signed-in account; a participant
  "capturedAt": 1791450000000,            // epoch ms the app read the game from the client
  "app": "0.2.7",
  "game": {                               // LCU GET /lol-match-history/v1/games/{gameId}, trimmed:
    "gameId": 7998180573, "platformId": "EUW1", "gameCreation": 1791448000000, "gameDuration": 1810,
    "queueId": 420, "mapId": 11, "gameMode": "CLASSIC", "gameType": "MATCHED_GAME", "gameVersion": "16.20.721.4471",
    "participantIdentities": [
      { "participantId": 1, "player": { "puuid": "<raw>", "gameName": "Louhi", "tagLine": "727", "profileIcon": 6634 } }
    ],
    "participants": [
      { "participantId": 1, "teamId": 100, "championId": 45, "spell1Id": 4, "spell2Id": 14,
        "position": "MIDDLE",              // inferred by the app (TOP JUNGLE MIDDLE BOTTOM UTILITY), absent off Summoner's Rift
        "stats": { /* the client's stats object: numbers and booleans only, keys unchanged */ },
        "timeline": { "lane": "MIDDLE", "role": "SOLO" } }
    ],
    "teams": [
      { "teamId": 100, "win": "Win", "bans": [{ "championId": 238, "pickTurn": 1 }],
        "baronKills": 1, "dragonKills": 3, "hordeKills": 3, "riftHeraldKills": 1, "towerKills": 8, "inhibitorKills": 2,
        "firstBlood": true, "firstTower": true, "firstBaron": true, "firstDargon": false, "firstInhibitor": true }
    ]
  },
  "timeline": null | {                    // LCU GET /lol-match-history/v1/game-timelines/{gameId}, trimmed:
    "frameInterval": 60000,
    "frames": [{
      "timestamp": 60000,
      "participantFrames": { "1": { "participantId": 1, "totalGold": 500, "currentGold": 500, "xp": 280, "level": 1,
                                    "minionsKilled": 4, "jungleMinionsKilled": 0, "position": { "x": 6000, "y": 6100 } } },
      "events": [ /* types: CHAMPION_KILL ELITE_MONSTER_KILL BUILDING_KILL SKILL_LEVEL_UP ITEM_PURCHASED ITEM_SOLD
                     ITEM_UNDO ITEM_DESTROYED WARD_PLACED WARD_KILL; fields kept: type timestamp participantId killerId
                     victimId assistingParticipantIds teamId monsterType monsterSubType buildingType towerType laneType
                     itemId afterId beforeId skillSlot levelUpType wardType creatorId position */ ]
    }]
  },
  "lp": null | {
    "queue": "RANKED_SOLO_5x5" | "RANKED_FLEX_SR",
    "before": { "tier": "EMERALD", "division": "II", "lp": 45, "wins": 60, "losses": 52, "at": 1791447900000 },
    "after":  { "tier": "EMERALD", "division": "II", "lp": 64, "wins": 61, "losses": 52, "at": 1791450100000 }
  }
}
```

Response `200`:

```json
{ "matchId": "EUW1_7998180573", "status": "stored" | "duplicate" | "verified" | "deferred",
  "lp": "stored" | "rejected" | "none", "url": "https://invade.lol/Louhi-727/match/EUW1_7998180573" }
```

`deferred`: accepted but not published yet (§4.2); the desktop marks the item done, core finishes
it. Re-sending the same match from the same device is idempotent (`duplicate`, with the `lp` answer
of the first send).

Core notes: `deferred` is also the answer when Riot is rate limiting or unavailable during the
upload, not only when match-v5 has no game yet. 422 `E_INVALID_LP` is reserved for an `lp` that is
neither an object nor `null`; a malformed or implausible LP object only makes `lp: "rejected"`. An
`uploader` that is not one of the participants is a 422 `E_INVALID_MATCH` (linking would not fix it);
403 `E_NOT_LINKED` means a participant uploader that this device has no link for.

## 3. Identity mapping (core)

Table `riot_puuid_alias (raw_puuid uuid PK, puuid text, game_name, tag_line, status, observed_at)`.
For each participant of an upload, in order, without any Riot call:

1. alias by `raw_puuid` (status `verified` or `asserted`);
2. `riot_player` by `(game_name, tag_line)` (citext, the Riot ID at game time) → alias `asserted`.

Participants still unmapped are mapped by the one match-v5 call of §4.2 (match participants by
`participantId`, checked against Riot ID and champion) → alias `verified`. Core never calls
account-v1 per participant. Two different raw PUUIDs claiming one API PUUID: both aliases
`conflict`, the upload is deferred to Riot. (When one of the two claims is already `verified`, only
the other one becomes `conflict`; a `verified` alias learned from match-v5 overwrites any other.)

## 4. Validation and publication (core)

### 4.1 Structural checks (→ 422 `E_INVALID_MATCH`)

- `matchId` matches `/^[A-Z0-9]+_[0-9]+$/`, equals `${platformId}_${gameId}`, platform is a
  supported platform and the device's linked account plays there.
- `gameType == "MATCHED_GAME"`, queue in §4.3, `mapId` in {11, 12, 30}.
- `gameCreation` within the last 7 days and not in the future (5 min skew), `gameDuration` 0–7200 s,
  `capturedAt ≥ gameCreation + gameDuration·1000 − 5 min`.
- Participants: 10 on maps 11/12 (two teams of 5), 2–16 on Arena; unique `participantId`s and raw
  PUUIDs; each has an identity; champion ids known to the bundled champion list; stats numeric
  and within plausible ranges (kills, deaths, assists ≤ 100; CS ≤ 2000; gold ≤ 150000; damage ≤
  500000); team kills consistent with participant kills; exactly one winning team (maps 11/12).
- `uploader` is a participant and is linked to the device (else 403 `E_NOT_LINKED`).
- Size ≤ 2 MB.

### 4.2 Publication policy

Postgres `desktop_match_upload (match_id, device_id, uploader_puuid, payload_hash, status, received_at, …)`,
unique `(match_id, device_id)`; Postgres `match_source (match_id PK, source, verification,
completeness jsonb, first_device_id, created_at, verified_at)` is the single writer lock:
`INSERT … ON CONFLICT DO NOTHING` decides who ingests a match into ClickHouse (its tables are plain
`MergeTree`, so a second insert would duplicate rows).

- Match already in ClickHouse (from Riot or an earlier upload): no write; compare the canonical
  hash with the first upload → `corroborated` when a second device (different IP) agrees,
  `conflict` when it disagrees. → `duplicate`.
- New match, **trusted device** (≥ 5 verified uploads, no mismatch) and every participant mapped
  for free: ingest the desktop data (`source desktop`, `verification unverified`). Zero Riot calls.
  One upload in ten is still checked against match-v5 afterwards (sampling).
- Otherwise: **one** `getMatchById` call. Found → ingest the **Riot** match (complete, `verification
  verified`) with the desktop's timeline (saves the timeline call; Riot's timeline if the upload
  has none), learn every alias, compare with the upload (champions, K/D/A, result, duration) and
  count the device verified or mismatched. Not available yet (404) → `deferred`: retried by core
  2, 5 and 15 minutes later (in-process timer, best effort); after that the normal web sync picks
  the match up.
- A device with a mismatch is revoked; its unverified matches are marked `conflict` and hidden
  from LP display (they stay in ClickHouse until re-ingested from Riot).

Core notes: the web sync takes the same lock (a `riot`/`verified` row) before it ingests, so the two
writers can never both insert a game. A duplicate of a game whose stored rows came from Riot (or
were verified) is compared with those rows at no Riot cost and counts the device verified or
mismatched like the Riot path. A conflict between two devices, and the one-in-ten sample of trusted
uploads, are checked against match-v5 with the same 2/5/15-minute retries; the stored rows are then
marked `verified` or `conflict`, and each device involved is counted.

LCU → match-v5 conversion maps the LCU fields onto `MatchDTO.info` for the existing row builders
(`buildMatchRow`, `buildParticipantRows`, `buildTimelineRows`). Fields the LCU does not give
(`summonerLevel`, pings, `challenges`, objective kills per team beyond the team totals above) stay
0 in ClickHouse and are listed in `match_source.completeness` (`{ "pings": false, "summonerLevel":
false, "timeline": true, "position": "inferred" }`, plus `"statPerks": false`: the client's history
has no stat shards) so readers can hide them. Riot games store `{ …: true, "position": "riot" }`.

### 4.3 Queues

400, 420, 430, 440, 450, 480, 490, 700, 720, 900, 1020, 1700, 1710, 1900, 2300, 2400.
(Nexus Blitz, 1300, is played on map 21, which §4.1 does not accept.)

### 4.4 LP changes (→ `lp: "rejected"` with the reason logged; the match itself is still accepted)

Stored in Postgres `lp_change (match_id, puuid, queue, before…, after…, delta, source, device_id,
status, created_at)`, unique `(match_id, puuid)`, only for the uploader. Accepted when:

- queue 420 ↔ `RANKED_SOLO_5x5`, 440 ↔ `RANKED_FLEX_SR`;
- `after.wins + after.losses == before.wins + before.losses + 1`, and the result matches
  (`after.wins == before.wins + 1` for a win);
- `before.at < game end` (the app takes it when the game clock starts, after the loading screen,
  so it may trail `gameCreation` by minutes), `after.at ≥ game end`, `after.at − game end ≤ 30 min`,
  where game end is `gameCreation + gameDuration·1000`;
- `delta = ladder(after) − ladder(before)` (Iron IV 0 = 0, +100 per division, Master+ on one
  ladder from 2800), positive for a win and negative for a loss except at 0 LP / promotions, and
  `|delta| ≤ 100`; tiers and divisions valid; neither snapshot provisional.
  (Core reads the exceptions as: a loss may be `0` when `before.lp` is 0; a win may be `0` only
  when `after` is a higher division or tier. Apex divisions are ignored, `"I"` as league-v4 sends
  them. Provisional: a tier outside the ten ranked tiers, e.g. `""`/`NONE` during placements, or
  `provisional: true` if the app ever sends it.)

The `after` snapshot is also written to `riot_rank` (`source desktop`) when it is newer than the
stored one: the web shows the fresh rank without a league-v4 call.

## 5. Desktop behaviour

### 5.1 When a game ends

The poll loop already waits for the new game in the client's history. With publishing on and the
signed-in account linked: fetch the full game and timeline from the client **once** (raw JSON),
trim them to §2.5, compute the LP change from the snapshot taken when the game started and the
one taken when LP settled (up to 150 s after), and store the payload in the local queue. Nothing
is sent during a game.

### 5.2 Local queue

SQLite table `uploads (match_id PK, puuid, payload BLOB deflated, state, attempts, next_at, last_error,
created_at, sent_at)`. States: `pending`, `sent`, `dropped`. Kept 30 days after sending.

### 5.3 Sender

One task, woken by an enqueue, by app start when `pending` items exist, or by its own timer; it
never polls an empty queue and never sends while a game is running. Backoff per item:
1 min, 5 min, 15 min, 1 h, 6 h, 24 h; dropped after 8 attempts. One request at a time.
A 503 / 429 pauses the whole queue for `Retry-After`. Offline = connect errors: the queue waits for
the next game end or app start.

### 5.4 Onboarding

LCU first (`/lol-summoner/v1/current-summoner` + ranked + mastery + recent games), else
`GET /api/desktop/resolve`, else the local database. The resolved account is stored locally so
the app is personalised before the League client is ever opened.

## 6. Player snapshots (contract v1.1)

Whenever the desktop app reads a player from the League client (a profile it opens, a scouting
card, the allies of a champ select, the ten players of a game, the signed-in account), it sends
core what the client showed: identity, ranks, champion mastery. Core uses it to keep web
profiles fresh **instead of** league-v4 / champion-mastery-v4 calls. Match histories of other
players are never read for this and never sent; finished games stay on §2.5.

### 6.1 `POST /api/desktop/players` (auth; 60 requests and 1500 players / hour / device, 240 requests / hour / IP; body ≤ 256 KB)

```jsonc
{
  "schema": 1,
  "platform": "EUW1",                 // the client's platform (the players were read on it)
  "app": "0.2.7",
  "players": [                        // 1–25, unique rawPuuid
    {
      "rawPuuid": "5c8a…",            // LCU puuid (36-char UUID)
      "gameName": "Kesha", "tagLine": "EUW",
      "profileIconId": 4568, "summonerLevel": 245,
      "privacy": "PUBLIC",            // "PUBLIC" | "PRIVATE" (the client's flag)
      "self": false,                  // the account signed in to this client
      "context": "in_game",           // "self" | "profile" | "champ_select" | "in_game"
      "observedAt": 1791450000000,    // epoch ms the client answered
      "ranks": [                      // null: not read. []: read, unranked in both queues
        { "queue": "RANKED_SOLO_5x5", "tier": "EMERALD", "division": "II", "lp": 64,
          "wins": 61, "losses": null, // losses: a number only when self (the client hides others')
          "provisional": false }
      ],
      "mastery": [                    // null: not read, or a PRIVATE profile. Top 10 by points
        { "championId": 45, "championLevel": 38, "championPoints": 402115, "lastPlayTime": 1791400000000 }
      ]
    }
  ]
}
```

Apex tiers use division `"I"` (like league-v4). Response `200`:

```json
{ "results": [ { "rawPuuid": "5c8a…", "status": "applied" } ] }
```

`status` per player: `applied` (stored on the web profile), `staged` (kept until core can tell
whose it is, §6.3), `unchanged` (same as stored; only its freshness moved), `stale` (core holds
newer data), `held` (not applied: untrusted device or implausible change, §6.4), `rejected`
(with `code`, e.g. `E_INVALID_PLAYER`). A malformed body (not 1–25 players, wrong schema) is
422 `E_VALIDATION_ERROR` for the whole batch; other errors as §1.

Core notes: a `rejected` result also carries `message` (the rule broken). The batch is 422 when
`players` is missing, empty or longer than 25, `schema` is not 1, an entry is not an object with a
string `rawPuuid`, or a `rawPuuid` appears twice (case-insensitive). Requests are counted (device,
IP) before validation and players after it; a batch that would take the device past 1500 players
is refused whole (429), and refused attempts still count (fixed windows). `DESKTOP_UPLOADS_ENABLED`
also pauses this route (503 `E_UPLOADS_PAUSED`). An unsupported `platform` rejects every player
(§6.2). Results are in the order of `players`.

### 6.2 Validation (per player → `rejected`)

UUID `rawPuuid`; Riot ID 1–16 + 1–5 characters, no `#`; platform supported; `observedAt` within
the last 24 h and not more than 5 min in the future; tier ∈ IRON…CHALLENGER, division ∈ I–IV
(apex: I), LP 0–100 below Master, 0–5000 from Master; wins/losses 0–5000; `losses` non-null only
when `self`; at most 2 rank entries (solo, flex); mastery ≤ 10 entries, known champion ids,
level 0–1000, points 0–100 000 000, `lastPlayTime` not in the future; level 1–5000; icon id
0–100 000.

Core notes: Riot ID lengths are in characters (not bytes), without leading or trailing spaces.
`profileIconId`, `summonerLevel`, `privacy` and `context` may be absent or `null` (not applied);
an absent `self` is `false`; absent `ranks`/`mastery` mean not read. Tier and division are
case-insensitive; an apex division may be `"I"`, `""` or `null`. A `provisional: true` entry is
dropped (placements have no rank to apply) rather than rejecting the player. A champion listed
twice in `mastery` is rejected; a `PRIVATE` profile's mastery is discarded. "Not in the future"
allows the same 5-min skew as `observedAt`.

### 6.3 Identity and storage (core)

`player_observation (raw_puuid PK, game_name, tag_line, platform, profile_icon_id, summoner_level,
privacy, ranks jsonb, mastery jsonb, observed_at, received_at, device_id, payload_hash,
puuid NULL, applied_at NULL, status)` keeps the **latest** observation per raw PUUID (an older
one never replaces a newer one). Mapping uses §3 order: alias, then `riot_player` by Riot ID on
that platform, without any Riot call. Unmapped observations stay `staged`; whenever core learns
the API PUUID of a Riot ID (`resolveAndPersist`, `upsertFromParticipants`, a verified match
upload's aliases), it applies the staged observation of that Riot ID if it is still recent
(≤ 24 h) and records the alias as `asserted`.

Core notes: a report older than the stored one of its raw PUUID is `stale` and not stored (equal
timestamps are processed again). Mapping is `identity_service` itself, so §3's conflict rules hold
within a batch and against existing aliases: two raw PUUIDs landing on one account are both
`conflict` and the reports stay `staged`. A mapping through `riot_player` records the `asserted`
alias at once. Staged reports are looked up by Riot ID and platform after `resolveAndPersist` and
`upsertFromParticipants`, and by raw PUUID after a verified upload taught core its aliases; the
lookup runs in the background (one probe of a partial index holding only staged rows) and never
delays or fails the flow that triggered it. A staged report is applied through the same rules as
a fresh one (§6.4), and never when its device has been revoked since. `player_observation` also
keeps `self`, `context` and a keyed hash of the sender's IP (for corroboration).

### 6.4 Applying (core) — never overwrite newer or more authoritative data

- **Trust:** a trusted device (§4.2) applies anything; an untrusted device applies only its own
  linked accounts (`self`). Other players from untrusted devices are `held` until a second
  device (different IP) reports the same Riot ID with the same rank within 6 h, or the device
  becomes trusted. A rank more than 800 ladder points (§4.4 `ladder()`) away from the stored
  one within 24 h is `held`.
- **Ranks:** per queue, insert a `riot_rank` row (`source = 'desktop'`, `fetched_at = observedAt`)
  only when `observedAt` is newer than the newest row of that queue (any source) and something
  changed; `losses` is `NULL` when unknown (the column becomes nullable; readers show W/L only
  when losses are known and fall back to the newest row that has them for the win rate). Riot's
  own rows are always written when fetched, so a later Riot read supersedes desktop data.
- **Profile:** icon and level update `riot_player` when `observedAt` is newer than the last
  refresh. A different Riot ID for the same PUUID is applied only through a `verified` alias
  (a rename), with a `riot_player_history` row, as the Riot path does.
- **Mastery:** `player_mastery (puuid PK, entries jsonb, observed_at, source)`; newest wins.
- **Freshness:** `unchanged` still moves `player_observation.observed_at` and the rank's
  "confirmed at" (`riot_rank_confirmed (puuid, queue_type, confirmed_at)`), so core knows the
  stored rank is current without asking Riot.
- Writes invalidate the response cache of `summoner:<puuid>`.

Core notes:

- *Self* means the player is one of the device's links (by API PUUID, or by the raw PUUID the link
  proved); the `self` flag alone is not believed. Losses are kept only from a linked account or a
  trusted device; a corroborated report is applied with `losses` `NULL`.
- Corroboration needs the stored report of the same raw PUUID to come from another device, from
  another IP (keyed hash), within 6 h, with the same Riot ID and platform, and the same tier,
  division and LP per queue (both having read ranks). `conflict` reports never corroborate. Held
  reports are not replayed when a device becomes trusted; its next report applies.
- The 800-point rule holds trusted devices too and holds the whole report.
- Per queue: a report equal to the newest row only confirms it (`unchanged`); a different report
  older than the newest row is `stale` for that queue; a different, newer one is a new row. A
  queue absent from a read `ranks` with no stored row is confirmed unranked (a confirmation without
  a rank row); a stored queue the report lacks is left alone.
- A Riot read (`updateRanks`) writes a row when a queue changed or its newest row is not Riot's,
  and otherwise only confirms it (`riot_rank_confirmed.device_id` `NULL`), so a later Riot read
  always supersedes desktop data without duplicating history.
- `riot_rank_confirmed` and `player_mastery` also carry `device_id`, for rollback (§1.2).
  `player_mastery` also keeps Riot's top 10 after every champion-mastery-v4 read (`source riot`),
  so an older desktop snapshot never stands in for a newer Riot read.
- Icon and level are compared with `riot_player.last_refresh_at`, which desktop data never moves.
  An icon change or rename adds a `riot_player_history` row. A rename to a Riot ID another stored
  player still holds on that platform is skipped (Riot settles it).
- The player's status: `applied` when any part was written, `unchanged` when nothing was but
  freshness moved (or nothing applied), `stale` when every part was older than core's data.
- `riot_rank.losses` has been nullable since the table was created; the migration only guarantees
  it. Rolling the migration back fills `NULL` losses from the newest earlier row of that queue
  with losses, else 0.

### 6.5 Fewer Riot calls (core)

- League-v4 is skipped when the newest rank of the player (Riot or desktop, or its confirmation)
  is younger than 10 min for profile reads and `GET /api/desktop/resolve`, and younger than 3 min
  for the website's Update (`POST /api/summoners/sync`).
- Champion-mastery-v4 is skipped when a desktop mastery snapshot younger than 24 h covers what
  the request needs (the top 10).
- APIs expose provenance: rank and mastery responses carry `source` (`riot` = Riot API,
  `desktop` = reported by the Invade app) and `observedAt`; `freshness` of the summoner gains
  `lastObservedAt`.

Core notes: "the newest rank" is the latest `riot_rank.fetched_at` or
`riot_rank_confirmed.confirmed_at` of any queue. Website profile reads never called league-v4
(only Update does), so the 10-min rule applies to `/resolve`. The website's Mastery panel lists
every champion, which no snapshot covers, so it still reads champion-mastery-v4 (cached 1 h);
`GET /api/summoners/puuid/:puuid/mastery?count=N` with N ≤ 10 is served from a desktop snapshot
younger than 24 h, and the profile now asks for `?count=10`, loading the full list only on
Champions → Mastery. Shapes: rank entries (`current`, `history`) gain `source` and `observedAt`
(ISO; for a current rank the later of its row and its confirmation) and may have `losses: null`;
mastery entries gain `source` and `observedAt` (epoch ms; `null` for a Riot read cached before
v1.1); `freshness.lastObservedAt` is the newest applied or unchanged report (ISO, or `null`).

### 6.6 Desktop behaviour

- **What is observed** (LCU only; never another player's match history):
  - **profile**: every player card built from the client (`players::card`, i.e. profile pages and
    scouting), from data already fetched (no extra request);
  - **self**: the signed-in account at sign-in and at each 30-min refresh (losses included);
  - **champ select**: allies whose PUUID the client shows, once per champ select (summoner,
    ranked, mastery: 3 requests each, ~250 ms apart). Hidden players (empty PUUID: enemies in
    ranked champ select) are never looked up;
  - **in game**: the ten players of the game from the gameflow session, 45 s after the game
    starts, skipping bots, players observed in the last 6 h and cards already in the cache.
- **Privacy:** `PRIVATE` profiles send no mastery. Bots and players without a Riot ID are skipped.
- **Dedup and queue:** `player_snapshots (raw_puuid PK, payload, hash, observed_at, state,
  attempts, next_at)` coalesces per player (the newest observation replaces a pending one);
  `player_sent (raw_puuid PK, hash, sent_at)` skips a snapshot identical to the last one sent
  less than 6 h ago. The hash excludes `observedAt` and `context`.
- **Sending:** the §5.3 sender sends pending games first, then players in batches of ≤ 25, never
  during a game. Backoff per batch 1 min, 5 min, 15 min, 1 h; a snapshot is dropped after
  5 attempts or 24 h. 429 / 503 pause the whole queue.
- **Fallback:** with the client closed, a profile the app does not hold is resolved through
  `GET /api/desktop/resolve` (as onboarding does) and shown as a saved profile.
