# Player profile experience

Player profiles retain the application's light surfaces, Inter typography, and semantic win/loss colours. The hero uses the player's most-played champion, falling back to mastery when recent matches are unavailable.

## Routes

| Route | Content |
| --- | --- |
| `/:summoner` | Overview: rank, performance, comfort picks, teammates, activity, and full match history |
| `/:summoner/lens` | Lifetime champion mastery and detailed recent performance |
| `/:summoner/champions` | Champion highlights, queue/role filters, searchable and sortable statistics |
| `/:summoner/live` | Current lineup, spells, runes, and available tracked champion/rank information |
| `/:summoner/compare?with=Name%23Tag` | Comparison with another player on the same platform |
| `/:summoner/history` | Compatibility redirect to Overview's match feed; no separate History page |

Overview loads 15 matches at a time as the end of the feed approaches the viewport. Queue, champion, and role changes restart pagination. Appending preserves open match details and deduplicates match IDs. Failed requests require an explicit retry; reaching the end stops further requests.

Match cards use a neutral continuous border, white surfaces, and small outcome badges. Their expanded Overview, Details, Timeline, and Runes remain inside the same card. Timeline and rune selections load on demand, with a player selector and timeline scrubber.

Share opens a keyboard-accessible native dialog with a selectable profile link, clipboard action, optional statistics, and PNG download. No external sharing service is required.

## Data

- Performance and champion aggregates use up to 100 tracked matches. Champion filters apply before the sample limit; best kills and duration are computed from the filtered sample.
- The Support control maps to Riot's stored `UTILITY` role.
- Mastery uses Riot's PUUID endpoint and a one-hour cache. Live state uses spectator v5 and a 30-second cache. Only spectator 404 means the player is not in a game; upstream errors remain distinct.
- Live champion win rates and ranks are labelled as tracked data. Missing history and hidden player identities are not fabricated. Observer credentials are excluded.
- Champion splash art uses the existing same-origin asset mirror and fallback system.
- Update refreshes identity and rank even when there are no newly discovered matches. Rank refresh failures are reported separately.
- No new database migration is required. The local Compose PostgreSQL 18 volume mount was corrected to `/var/lib/postgresql`.

Riot endpoints: [official API reference](https://developer.riotgames.com/apis/).

## Verification

- Production build and server/client TypeScript checks.
- 41 passing unit tests, including champion query boundaries, role normalization, PUUID mastery, live 404/error distinction, and removal of observer credentials.
- Real Riot data: `Louhi#727`; comparison with `MRS PauluX#KCWIN`.
- Browser checks: filters and sorting, champion-to-overview navigation, timeline scrubber, rune selections, share copy/download/Escape, and responsive layouts.
- Deterministic browser checks: 45-match infinite feed, pagination failure/retry, offset reset, no duplicate requests, populated ten-player live lobby, and upstream error recovery.
- Local captures and browser verification scripts are in `tmp/redesign/` (ignored working artifacts).

Repository-wide lint has existing unrelated failures. The existing health test fails because the host disk is 98% full; database and Redis health checks pass. Neither check was disabled or weakened.
