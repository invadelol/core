# Shared pieces (Facet)

The site's look is the design canvas's stylesheet, ported as it is: `inertia/css/facet.css`
(every class of the boards), `tokens.css` (colours, Sofia Sans), `chrome.css` (header, menus,
footer, frame) and `ui.css` (what the boards did not draw: tables, select list, empty and loading).
Everything is scoped under `.vb`: wrap a rebuilt page in `SiteLayout` and a board's markup ports
class for class. Use the components below instead of re-writing their markup.

## Frame of a page

| Component | Props | Use |
| --- | --- | --- |
| `SiteLayout.vue` (in `components/`) | `search?`, `sub?` (a sub-row of the page's own: `{ label, href, on? }[]`), `section?` (light a header section when the address does not say), `patchOn?` | Every rebuilt page: header, `<main id="main">`, footer, all under `.vb`. Lay the page out in `<div class="wrap">` (1280 px, 32/24/16 px gutters). |
| `Masthead.vue` | `title`, `crumbs?` (`{ label, href? }[]`), `meta?`; slots `end` (controls at the right), `meta`, default (under the title: tabs, a filter bar) | The top of a page (`.mast`): breadcrumb, h1 (32 px), grey line. |

The header reads the section and its sub-row from the address (`lib/site_nav.ts`): add a page's
address there (`here`) if it should light up a section.

## Heads and links

| Component | Props | Use |
| --- | --- | --- |
| `SectionHead.vue` | `title`, `icon?` (an icon name), `meta?`, `more?` (`{ label, href }`), `id?`, `as?`; default slot for controls | A section's head outside cards (`.sec-h`, h2 20 px). Put it in `<section class="sec">` (56 px above). |
| `CardHead.vue` | `title`, `icon?`, `meta?`, `more?`, `id?`, `as?`; default slot replaces the "more" link | A card's head (`.card-h`, 16 px) inside `<div class="card">`. |
| `MoreLink.vue` | `href`, `label`, `external?` | The quiet "All 98 ›" link. |
| `Icon.vue` | `name` (see `lib/icons.ts`), `size?` (16), `strokeWidth?` | The canvas's line icons (20 px grid, mitred). Not lucide. |
| `Glyph.vue` | `h?` (24) | Invade's mark. |

## Navigation and filters

| Component | Props | Use |
| --- | --- | --- |
| `Tabs.vue` | `items` (`{ key, label, href, count? }[]`), `active`, `label` (aria), `preserveScroll?` | A page's tabs (`.tabs`): real addresses, violet bar under the current one. |
| `Segmented.vue` | `options` (`{ value, label, icon?, note?, href? }[]`), `label`, `v-model` | A segmented filter (`.seg`): roles, queues. Buttons with `v-model`, links when each option has an `href` (a filter that is an address). `icon` is a small picture (a role glyph), `note` a grey figure ("22%"). |
| `Select.vue` | `options` (`{ value, label, icon?, meta? }[]`), `v-model`, `label?` (grey key before the value: "Rank"), `placeholder?`, `searchable?`, `width?` (list width), `align?` | A select (`.sel` trigger, a panel list). Works on old pages too. |
| `header/ThemeChoice.vue` | none | Dark, Light, Auto. |

## Data marks

| Component | Props | Use |
| --- | --- | --- |
| `TierChip.vue` | `tier` (index 0 = S+ … 5 = D, or the letter), `large?` | The flat tier chip (`.tier`). The violet ramp carries the rank. |
| `ScoreDial.vue` | `value` (0–100, null for none), `size?` (`sm` 36, `md` 44, `lg` 96, `xl` 128), `place?` (the small word under it: "MVP", "2nd") | The Invade score: 260° arc, pink → grey → blue, gold from 80. |
| `RankEmblem.vue` | `tier` (any case), `size?` (24), `title?` | Riot's crest art (`/cdn/emblem`), cropped to a square. Unranked shows the small crest. |
| `FormStrip.vue` | `results` (booleans, oldest first), `tall?`, `small?` | Last games as straight bars (`.form`): blue win, pink loss. |
| `Chip.vue` | `variant?` (`tag` grey fact, `stat` a figure on dark violet, `violet` a leading figure), `icon?`, `href?`; slot | Small labels. |
| `WinRate.vue` | `wins?` with `games?` or `losses?` (a record), or `rate?` (0–1, no record); `width?` (the track, px or CSS, fills its cell by default), `record?` (the "83W 76L" beside the rate, on), `digits?` (0), `small?`, `end?` (right-aligned), `bare?` (the line alone, for a rate written elsewhere) | Every win rate of the site: the rate, the record, and one violet line on a grey track with a tick at 50% (above or below even at a glance). One colour: never a blue and pink split bar. |
| `VioletLine.vue`, `Sparkline.vue` | (unchanged) | The one violet chart line, sparklines. Charts: one violet line, a soft fade, no red/green decoration. |

## Pictures

| Component | Props | Use |
| --- | --- | --- |
| `Frame.vue` | `src`, `alt?`, `width?`, `height?` (px or CSS), `size?` (`l`, `m`, `s`, `xs`), `position?` (object-position), `stage?` (violet ground for pro cutouts), `visor?` (face band), `eager?` | A framed picture (`.fr`). The cut corner is for large pictures only: under 96 px wide it is a plain rounded square (`.fr.s`/`.fr.xs` never cut). When porting a board's `<span class="fr">` on a small tile, add `s` or `xs`. |

Images only through `/cdn/<kind>/<id>` (`lib/assets.ts`): champion, splash/centered/loading,
item, perk, spell, profile-icon, emblem, rank, mastery, augment (Arena), and `/cdn/pro/<slug>`,
`/cdn/team/<id>`, `/cdn/league/<slug>`. Write `:src` (a binding), never a static `src="/cdn/…"`:
the Vue compiler turns a static absolute URL into an import and the page fails to build.

## States and tables

| Component / class | Props | Use |
| --- | --- | --- |
| `EmptyState.vue` | `title`, `line?`, `icon?`, `compact?`; slot for an action | A block with nothing to show: one plain sentence on what is missing and why. No apology, no filler. |
| `Skeleton.vue` | `rows?` (list lines), `pic?` (a square per line), `height?` (one block) | While a block loads. Flat, breathes slowly. |
| `.tbl` / `.tbl-h` / `.tbl-r` (CSS) | `--cols` on `.tbl` (a grid-template-columns), `--row-h` | Tables inside a `.card`: head row of 12 px grey labels, 52 px rows on hairlines, `.n` right-aligned figures, `.hm` hidden on a phone, `.me` your row, `.sorted` the sorted head (use `SortHead.vue`, below), `.who` a picture + name cell. A row that is a link is an `<a class="tbl-r">`. The boards' own grids (`.sbr`, `.lt3`, `.std`) are in facet.css too. |

## Sortable tables

Every data table sorts by its figures: click a head (win rate, pick rate, games, LP…) for most
first, again for least first, a third time for the table's own order. The arrow shows the
direction, the head cell carries `aria-sort`, the head is a button (or a link), so the keyboard
reaches it.

| Piece | API | Use |
| --- | --- | --- |
| `SortHead.vue` | `sorter`, `col` (the column's key), `label?` (or the default slot), `title?` | Replaces a plain head cell, one element for one: classes on it (`n`, `r`, `hm`) land on the cell, so a table's `:nth-child` rules and phone columns still count it. A right-aligned head (`.n`, `.r`) puts its arrow first. |
| `useSort(rows, columns, options?)` (`sort.ts`) | `rows`: a ref, getter or array; `columns`: `{ key: (row) => number \| string \| null }` (a getter when they change); `options`: `key` (the table's own order, null by default), `dir`, `first` (`{ name: 'asc' }` for A to Z first) | Sorts the rows the page holds, in the browser. Returns a reactive sorter: `rows` in order, `key`, `dir`, `active`, `toggle(col)`, `reset()`. Rows without a value stay last either way. |
| `linkSort(state, to, options?)` (`sort.ts`) | `state`: `{ key, dir }` from the page's props; `to(key, dir)`: the address of a state (null `key` drops `sort` and `dir`) | A table the server pages (the ladders): each head is an address with `?sort=&dir=`, and the controller sorts the whole list before it cuts the page (`sortParam`, `sortRows` in `app/services/ladder.ts`). |

A tier list keeps its tier groups until a head sorts it; sorted, it runs as one list with each
row's tier chip before its picture (`.tl-tc`, `.tx-tc`).

```vue
<script setup lang="ts">
const sort = useSort(shown, { win: (r) => r.win, games: (r) => r.games }, { key: 'win' })
</script>
<div class="tbl-h">
  <span>Champion</span>
  <SortHead :sorter="sort" col="win" label="Win rate" class="n" />
  <SortHead :sorter="sort" col="games" label="Games" class="n hm" />
</div>
<a v-for="r in sort.rows" class="tbl-r">…</a>
```

Other classes straight from the canvas (facet.css): `.card`, `.well`, `.btn` (`.pri`, `.sm`,
`.lg`, `.ghost`, `.ico`), `.kbd`, `.field`, `.switch`/`.chk`, `.lrow` (list row), `.pic`
(`.sm`, `.xs`, `.md`), `.bar` (a share, one violet; win rates are `WinRate.vue`), `.live`, `.chart`, type steps (`.d1`, `.h1`–`.h5`, `.meta`,
`.lab`, `.fg-xl`…`.fg-xs`), colours (`.t1`–`.t3`, `.vi`, `.wn`, `.ls`, `.gd`), layout (`.wrap`,
`.row`, `.col`, `.grid2`, `.grid3`, `.side2`, `.stk`, `.sec`).
