# Design system

## Principles

**Cards on a dark stage.** The page background sits a step below the panels,
so every block that is one object (a match, the stat board, a rail panel, a
table) is a `.card`. Cards never nest: inside one, structure comes from rules,
spacing and `bg-raised` tiles.

**Quiet interaction, loud data.** Buttons, tabs and filters are neutral: an
inverse chip (near-white on dark, ink on light) marks what is active. Colour is
spent only on what the data means, so a win, a side of the map or a great game
is the brightest thing on screen.

**Numbers carry context.** Almost every figure sits next to a bar, a sparkline
or a share, so a value can be read against the thing it should be compared to:
the lobby, the lane opponent, the player's own trend.

## Colour

| Role        | Token          | Used for                                          |
| ----------- | -------------- | ------------------------------------------------- |
| Outcome     | `win` / `loss` | Victory and defeat, win rates, deltas, row washes |
| Side        | `blue` / `red` | Blue and red side, team bars, map bases           |
| Economy     | `gold`         | Gold earned                                       |
| Distinction | `signal`       | The top score tier and the MVP tag (Riot gold)    |
| Interaction | `accent`       | Active chips, primary buttons (neutral inverse)   |

`s1`/`s2`/`s3` exist only for charts that need three distinguishable series
(the physical/magic/true damage split).

Surfaces climb as they come forward: `bg` → `panel` → `raised` → `sunken`.
Text runs `ink` → `ink-4`. The only gradients are the skeleton shimmer, the
shade over champion art and the win/loss wash on a match row.

## Themes

Dark is the home theme; light is fully supported. `:root` carries light. Dark
is declared twice on purpose:

- inside `@media (prefers-color-scheme: dark)` guarded by
  `:root:not([data-theme='light'])`, so the system preference works with no
  JavaScript;
- on `:root[data-theme='dark']`, after the media query, so an explicit choice
  always wins.

`inertia/lib/theme.ts` owns the choice, persists it as `invade-theme`, and
writes `data-theme` on the root. A synchronous script in
`resources/views/inertia_layout.edge` replays it before the stylesheet loads.
Chart.js cannot read a CSS variable, so `inertia/lib/chart.ts` resolves the
tokens and refreshes them from a `MutationObserver` on `data-theme`.

## Type

Archivo, self-hosted as one variable file per script with both the weight and
width axes. Headings and figures are the same family pulled narrow with
`font-stretch`, so the semi-condensed look costs no second download. Inter
stays behind it for Cyrillic only.

- `.display` — titles, sentence case, 82% width, 700.
- `.stat` — a figure meant to be read first, 84% width, tabular.
- `.section > h2` — small uppercase section headings.
- `.label` — the smallest uppercase caption.

Body is 13px, tables 12.5px. Every number sits in `.num`, `.stat`, a table or
an input for tabular figures.

## Score

Every scored game gets a 0–100 number (`scoreLobby` in `inertia/lib/match.ts`),
built from five categories: Fighting, Damage, Farming, Vision and Objectives.
Each stat is rated half against the lobby (a z-score over the ten players,
squashed onto 0–1) and half against the lane opponent (a share of the two
players' total). Roles weight the categories by what the role is asked to do
(a support has no farming weight, an ARAM has no vision). A win adds ten
points. Games under five minutes are remakes and are not scored.

Tiers: 85+ elite (gold), 70+ great (win), 55+ solid (blue), 40+ average
(neutral), below that rough (loss). `ScoreRing.vue` renders one as a gauge; the player
detail row shows the category breakdown with its role weights, and the profile
shows the window's average and per-category averages.

## League assets

Role glyphs are Riot's own `position-*` SVGs, inlined in `RoleIcon.vue` with
their two tones bound to `currentColor`. Champion, item, spell, rune and rank
art all comes through the existing `/cdn` mirror.

## Primitives

`inertia/css/components.css` holds only what repeats: `card`, `section`,
`display`, `stat`, `label`, `btn`, `seg`, `tabs`, `field`, `menu`, `dt`,
`meter`, `tag`, `lvl`, `skel`, `scrub`, `glyph`, `notice`, `pulse`.
Anything used once lives in the component that uses it.

## Responsiveness

The match row drops columns in a fixed order as space runs out: line-ups
(`2xl`), items (`xl`), economy (`md`), champion name (`lg`). The score keeps
its own column at every width and only loses its caption below `sm`. The
profile collapses to one column below `lg` with the match feed above the rail.
