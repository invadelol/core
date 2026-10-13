# Game art proxy (`/cdn`)

invade.lol and the desktop app draw every champion, item, rune, spell, profile
icon, rank crest and splash from this origin, never from Riot's CDNs. `/cdn` is
a caching proxy and nothing more: it names an upstream file from a kind and an
id, fetches it once per patch, keeps it, and answers from the copy.

## URLs

| Request | Serves | `Cache-Control` |
| --- | --- | --- |
| `GET /cdn/:patch/:kind/:id` | the asset as of that patch (`16.20`) | `public, max-age=31536000, immutable` |
| `GET /cdn/:kind/:id` | the asset as of the live patch | `public, max-age=86400, stale-while-revalidate=604800` |
| any of the above when every upstream source fails | a generated SVG tile with the id's initials (a mastery crest: an empty, transparent tile) | `public, max-age=60` |
| `GET /cdn/names/:kind` | id → display name (kinds with a manifest) | `public, max-age=3600` |

`:id` may end in `.png`, `.jpg`, `.svg` or `.webp` so browsers and CDNs treat
the URL as an image; the extension is ignored, the `Content-Type` is the
upstream's. The desktop app pins the patch of its bundled data, so its URLs
never change within a release and never need revalidating. The site follows
the live patch.

A pinned patch must be one of the last six on Data Dragon's version list. An
older one (an app left un-updated for months) is served the live art under the
live cache lifetime, which keeps the mirror bounded to six copies of the art.

## Kinds

| Kind | `:id` | Community Dragon (`raw.communitydragon.org/<patch>/…/rcp-be-lol-game-data/global/default`) | Then |
| --- | --- | --- | --- |
| `champion` | champion id (`266`) | `v1/champion-summary.json` → `squarePortraitPath` | Data Dragon `cdn/<version>/img/champion/<Alias>.png`, `v1/champion-icons/<id>.png` |
| `splash` | champion id | `v1/champions/<id>.json`, base skin `uncenteredSplashPath` (the classic full splash) | Data Dragon `cdn/img/champion/splash/<Alias>_0.jpg`, CDragon CDN `champion/<id>/splash-art` |
| `centered` | champion id | base skin `splashPath` (the centred 1280×720 crop) | Data Dragon `…/centered/<Alias>_0.jpg`, CDragon CDN `…/splash-art/centered` |
| `loading` | champion id | base skin `loadScreenPath` | Data Dragon `…/loading/<Alias>_0.jpg`, CDragon CDN `…/portrait` |
| `ability` | `<champion id>-<p\|q\|w\|e\|r>` (`266-q`, `p` = passive) | `v1/champions/<id>.json`, `passive` / `spells[spellKey]` `abilityIconPath` | CDragon CDN `champion/<id>/ability-icon/<key>` |
| `item` | item id | `v1/items.json` → `iconPath` | `assets/items/icons2d/<id>.png`, Data Dragon `cdn/<version>/img/item/<id>.png` |
| `spell` | summoner spell id (`4`) | `v1/summoner-spells.json` → `iconPath` | `v1/summoner-spell-icons/<id>.png` |
| `perk` | rune id, stat shards included (`8005`, `5008`) | `v1/perks.json` → `iconPath` | Data Dragon `cdn/img/perk-images/…` |
| `perkstyle` | rune tree id (`8000`) | `v1/perkstyles.json` → `iconPath` | Data Dragon `cdn/img/perk-images/…` |
| `profile-icon` | icon id | `v1/profile-icons.json` → `iconPath` | `v1/profile-icons/<id>.jpg`, Data Dragon `cdn/<version>/img/profileicon/<id>.png`, then icon 29 (Riot's default) |
| `augment` | Arena augment id | `v1/cherry-augments.json` → `augmentSmallIconPath` | — |
| `rank` | tier (`gold`, `unranked`) | `rcp-fe-lol-static-assets/…/images/ranked-mini-crests/<tier>.svg` | `…/ranked-emblem/emblem-<tier>.png` |
| `emblem` | tier | `rcp-fe-lol-static-assets/…/images/ranked-emblem/emblem-<tier>.png` (1280×720, crest in the middle) | — |
| `map` | map id (`11`) | Data Dragon `cdn/<version>/img/map/map<id>.png` first | `v1/map-assets/map<id>/2dlevelminimap.png` |
| `mastery` | champion mastery level, `0` to `10` (levels past ten wear the tenth crest) | `game/assets/ux/mastery/legendarychampionmastery/masterycrest_level<n>.png` (256×256; 0 and 4 to 10 only) | `rcp-fe-lol-shared-components/global/default/mastery-<n>.png` (800×900, crest in the middle; 1 to 10) |

Ids resolve through Community Dragon's manifests rather than hand-built paths,
because the shape of the asset paths changes between patches while the
manifests do not. A pinned patch reads that patch's directory; if none of its
sources answer (an id newer than the patch), the live ones are tried before
the placeholder. The code is `app/services/riot/asset_paths.ts` (the table
above, pure and unit tested) and `app/services/riot/assets.ts` (fetching and
caching).

## Caching

From closest to furthest:

1. **The client.** Pinned URLs are `immutable`: a browser or WebView never asks
   again. Every real response carries an `ETag` (SHA-1 of the bytes) and
   `Last-Modified`, so a live URL past its day revalidates to a bodyless 304.
2. **This process.** An LRU of 64 MiB / 2048 entries, one hour per asset,
   30 seconds per placeholder.
3. **The mirror.** The bucket (`DRIVE_DISK`: R2 in production, MinIO locally)
   holds every asset ever fetched under `riot-assets/<patch>/<kind>/<id>`, with
   its content type. Once there, upstream is never asked again for that patch.
4. **Upstream.** Manifests and champion files are parsed once and kept in the
   cache store (Redis) for 12 hours per patch; Data Dragon's version list is
   read once an hour per process (a minute after a failure).

Concurrent misses share one fetch: a burst of requests for the same asset, the
same manifest or the version list goes upstream once per process. A
placeholder is never mirrored and never gets a validator, so the real asset
replaces it within a minute of upstream answering. While Data Dragon's version
list is unreachable, assets come from Community Dragon's `latest`, are served
under the live cache lifetime and are not mirrored (no patch can be put on
them).

`node ace assets:warm [--kinds=champion,item]` pulls every id of the live patch
through the proxy, so the first visitor after a patch is already served from
the mirror. Worth running once per patch.

## Limits

- Only the kinds above, and only ids of their exact shape (digits, a tier
  name, `<id>-<key>`, a mastery level up to 10); a patch must be `major.minor`. Anything else is a 404
  without any upstream request. Upstream URLs are built from these parts only,
  so the proxy cannot be pointed anywhere else.
- Upstream files over 8 MiB are refused; upstream gets 6 seconds per source.
- The `Content-Type` is always an image type, whatever upstream says, with
  `X-Content-Type-Options: nosniff` and a `sandbox` CSP, so an SVG opened
  directly cannot run anything on invade.lol.
- `Access-Control-Allow-Origin: *` and `Cross-Origin-Resource-Policy:
cross-origin`: the bytes are public, and the desktop app's WebView
  (`tauri://localhost`, `http://tauri.localhost`) is another origin.

## In front of it

There is no CDN in front of invade.lol today (Coolify's proxy serves the app
directly). Everything above works without one. A CDN such as Cloudflare would
cache `/cdn/*` as is: the URLs carry an image extension, pinned responses are
`immutable` for a year, placeholders say one minute, and nothing varies on
cookies or `Origin`. If one is added, cache `/cdn/:patch/*` with "respect
origin headers" and leave the rest of the site uncached.

The mirror grows by one copy of whatever was requested per patch (at most a
few hundred MB with every splash warmed). Old `riot-assets/<patch>/` prefixes
are never read once the patch leaves the six-patch window and can be expired
by a bucket lifecycle rule; the pre-0.2.9 unversioned `riot-assets/<kind>/`
keys can be deleted.
