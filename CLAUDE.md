# Agent notes

- **Design:** read the Invade design system before you change or add any page or component: [DESIGN.md](https://github.com/invadelol/ui/blob/main/DESIGN.md) in `@invadelol/ui` (locally `../ui/DESIGN.md`). One art direction for the app, this site and its landing pages. Use its tokens, layers, radii, type scale and recipes; run its checklist before you ship.
- **Site materials:** the page-level ones live here: `inertia/css/app.css` (ground, grain, `--edge`, `--sheet-light`, `--window-depth`, landing easings) and `inertia/css/components.css` (`.lit-sheet`, `.app-window`).
- **Keep each page's layout.** Only the look and shared components come from the app.
- **Public repo:** never commit real Riot IDs or puuids, `.env` or the Riot key. Images only through `/cdn/<patch>/…`. The home page and other public pages never call Riot.
