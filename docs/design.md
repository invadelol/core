# Design system

invade.lol and the desktop app share one frontend, [`@invadelol/ui`](https://github.com/invadelol/ui):
the design tokens (dark and light), the primitives and every view that shows a match or a
profile. A change to how a game or a player is drawn is made there once and shows in both
products. This repo holds only what the site alone has: search, the header and footer, the
Champions, Friends, Compare and Live sections, sharing, the activity calendar and the `/app`
page.

## Using the package

The package is on npm, but the site installs a built copy from `vendor/invadelol-ui`
(`"@invadelol/ui": "file:vendor/invadelol-ui"`), so a package change can ship here before it is
released. To pick up a change made in the package:

```bash
node scripts/sync_ui.mjs ../ui     # builds it into vendor/, reinstalls, clears Vite's cache
```

then commit `vendor/`. The Dockerfile copies `vendor/` before `bun install`.

`inertia/app/ui.ts` is the site as the package's host: images from the `/cdn` mirror (full rank
emblems from `/cdn/emblem`, the small crests are bundled), names from `/cdn/names`, a player
link is a real URL whose plain click is an Inertia visit. The site is English, the package's own
language, so it passes no strings; `@invadelol/ui/keys.json` lists them for a translated host.

Stored matches go through the package's adapters: `detailOf` (`inertia/lib/match.ts`) runs
`fromCoreMatch` with the site's score and badges, `summaryOf` makes a feed row of it,
`profileFromCore` builds the profile from the summoner, ranks, mastery and loaded games, and
`playedWithFromCore` the teammates.

## Tokens and themes

Everything reads the package's tokens (`--surface-1`, `--text-2`, `--win`, `--loss`,
`--brand`…). The Tailwind names the templates use (`bg-panel`, `text-ink-3`, `border-line`…)
are aliases of them, declared in `inertia/css/app.css`, so a theme is defined once.

Colour only where it means something: blue (`win`) is good for you, red (`loss`) bad for you,
violet (`brand`) is Invade itself (the active place, focus, the primary action, the viewed
player), gold is gold and MVP, tier colours name ranks. Figures stay white.

Dark is the default. `data-theme` on `<html>` is `system` (follows the operating system),
`light` or `dark`. `inertia/lib/theme.ts` owns the choice and persists it as `invade-theme`; a
synchronous script in `resources/views/inertia_layout.edge` replays it before the stylesheet
loads. Pages are set on `iv-root` (the package's type and colour).

## Type

Archivo, one variable file per script with the weight and width axes, bundled by the package
with the tokens; Geist covers Cyrillic. Large figures (20px and up) tighten slightly; nothing is
condensed.

## Score

Every scored game gets a 0–100 number (`scoreLobby` in `inertia/lib/match.ts`), built from five
categories: Fighting, Damage, Farming, Vision and Objectives. Each stat is rated half against
the lobby (a z-score over the ten players, squashed onto 0–1) and half against the lane opponent
(a share of the two players' total). Roles weight the categories by what the role is asked to do
(a support has no farming weight, an ARAM has no vision). A win adds ten points. Games under
five minutes are remakes and are not scored. The package draws it as a dial, with MVP and ACE
for the best of each team.

## Primitives

The package's: `iv-btn`, `iv-seg`, `iv-tabs`, `iv-panel`, `iv-skel`, `iv-badge`, `iv-table`,
`iv-select`, `iv-form` and the components. `inertia/css/components.css` adds only the site's
own repeating shapes: the page width (`page`), `section` headings, `fig`/`stat`/`label`,
`field`, `menu`, `thumb`/`portrait`, the dense `dt` tables, `meter`, `scroll-x`, `notice` and
the live `pulse`. Anything used once lives in the component that uses it.

## Responsiveness

The match row is its own size container and drops the matchup, then farm, then items as it
narrows. The profile puts its side panels above the feed below 1100px of width, and after it on
a phone. Every page works at 390px with a 16px gutter and no sideways scroll; wide tables scroll
inside their panel.
