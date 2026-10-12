/**
 * `@invadelol/ui`: the views shared by the desktop app and invade.lol. Each component imports its
 * own styles; the tokens ship apart (`@invadelol/ui/tokens.css`, `tokens-light.css`), with
 * `@invadelol/ui/style.css` as every style in one file. The model and pure logic are also
 * available without Vue from `@invadelol/ui/logic`. Components are named after what they show;
 * where that is a model type's name (`MatchDetail`, `PlayedWith`), the view is a `…Panel`.
 */
export * from './logic';
export { createInvadeUi, gameFavorite, provideInvadeUi, useFormat, useInvadeUi, useNames } from './context';
export type { AssetKind, GameFavorite, InvadeUi, InvadeUiOptions, LinkTarget, NameKind } from './context';
export { default as Button } from './components/Button.vue';
export { default as Icon, type IconName } from './components/Icon.vue';
export { default as Link } from './components/Link.vue';
export { default as Logo } from './components/Logo.vue';
export { default as Panel } from './components/Panel.vue';
export { default as Segmented } from './components/Segmented.vue';
export { default as Skeleton } from './components/Skeleton.vue';
export { default as StarButton } from './components/StarButton.vue';
export { default as Switch } from './components/Switch.vue';
export { default as Tabs } from './components/Tabs.vue';
export { default as TrendLine } from './components/TrendLine.vue';
export { default as ChampIcon } from './components/ChampIcon.vue';
export { default as ItemIcons } from './components/ItemIcons.vue';
export { default as ObjectiveIcon, type ObjectiveIconName } from './components/ObjectiveIcon.vue';
export { default as PerfDial } from './components/PerfDial.vue';
export { default as RankCrest } from './components/RankCrest.vue';
export { default as RoleIcon } from './components/RoleIcon.vue';
export { default as RunePage } from './components/RunePage.vue';
export { default as MatchRow } from './components/MatchRow.vue';
export { default as MatchRowSkeleton } from './components/MatchRowSkeleton.vue';
export { default as MatchList } from './components/MatchList.vue';
export { default as MatchDetailPanel } from './components/MatchDetailPanel.vue';
export { default as Scoreboard } from './components/Scoreboard.vue';
export { default as PlayerDetail } from './components/PlayerDetail.vue';
export { default as Breakdown } from './components/Breakdown.vue';
export { default as GoldChart } from './components/GoldChart.vue';
export { default as Timeline } from './components/Timeline.vue';
export { default as BuildTab } from './components/BuildTab.vue';
export { default as PlayerPicker } from './components/PlayerPicker.vue';
export { default as ProfileLayout } from './components/ProfileLayout.vue';
export { default as PlayerHeader } from './components/PlayerHeader.vue';
export { default as ChampionTable } from './components/ChampionTable.vue';
export { default as RolesPanel } from './components/RolesPanel.vue';
export { default as LpGraph } from './components/LpGraph.vue';
export { default as PlayedWithPanel } from './components/PlayedWithPanel.vue';
