# Design system

## Principles

**The page is one surface.** Structure comes from rules and spacing, not from
stacking filled rectangles. A section is a hairline with a small caps label on
it, not a card. The only box in the system is `.frame`, used where something is
genuinely one object (the match feed, a table), and it never nests.

**Tables are first-class.** A scoreboard is one table with both teams banded
inside it, not two tables side by side. Headers stick, rows expand in place.

**Numbers carry context.** Almost every figure sits next to a bar, a sparkline
or a share, so a value can be read against the thing it should be compared to:
the lobby best, the team total, the player's own trend.

## Colour

Five hues carry meaning and nothing else carries any.

| Role    | Token          | Used for                                              |
| ------- | -------------- | ----------------------------------------------------- |
| Outcome | `win` / `loss` | Victory and defeat, win rates, deltas                 |
| Side    | `blue` / `red` | Blue and red side, team bars, map bases               |
| Economy | `gold`         | Gold, and Riot's own accent on rune and mastery marks |

Interaction is **ink**: primary buttons, active segments, focus rings, the
active tab underline. There is no sixth brand colour competing with the data.
`s1`/`s2`/`s3` exist only for charts that need three distinguishable series
(the physical/magic/true damage split).

Surfaces climb as they come forward: `bg` → `panel` → `raised` → `sunken`.
Text runs `ink` → `ink-4`. Gradients support the skeleton shimmer, champion art and the blue-toned
dark background.

## Themes

`:root` carries light. Dark is declared twice on purpose:

- inside `@media (prefers-color-scheme: dark)` guarded by
  `:root:not([data-theme='light'])`, so the system preference works with no
  JavaScript;
- on `:root[data-theme='dark']`, after the media query, so an explicit choice
  always wins.

`inertia/lib/theme.ts` owns the choice, persists it as `invade-theme`, and
writes `data-theme` on the root. A synchronous script in
`resources/views/inertia_layout.edge` replays it before the stylesheet loads,
so a dark-theme visitor never sees a white flash. Chart.js cannot read a CSS
variable, so `inertia/lib/chart.ts` resolves the tokens and refreshes them from
a `MutationObserver` on `data-theme`.

## Type

Inter, self-hosted, 400/500/600 only. Body 13px, tables 12.5px, section labels
11px uppercase, the smallest text 10px and reserved for labels. Every number
sits in `.num` (or a table, or an input) for tabular figures.

## League assets

Role glyphs are Riot's own `position-*` SVGs, inlined in `RoleIcon.vue` with
their two tones bound to `currentColor`, so one icon works on a table row, a
filter segment and an active state. Champion, item, spell, rune and rank art
all comes through the existing `/cdn` mirror.

## Primitives

`inertia/css/components.css` holds only what repeats: `section`, `frame`,
`btn`, `seg`, `tabs`, `field`, `menu`, `dt`, `meter`, `skel`, `scrub`, `glyph`,
`label`. Anything used once lives in the component that uses it.

## Responsiveness

The match row drops columns in a fixed order as space runs out: line-ups
(`2xl`), items (`xl`), economy (`md`), champion name (`lg`), rank and the copy
action (`sm`). The profile collapses to one column below `lg` with the match
feed above the rail.
