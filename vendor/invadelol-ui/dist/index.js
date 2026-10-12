import { english as u, fill as i, tk as n } from "./logic/i18n.js";
import { ago as c, compact as S, dayKey as h, dayLabel as I, kdaRatio as P, mmss as k, num as R, ordinal as g, pct as y, score100 as E, signedGold as L, signedLp as T } from "./logic/format.js";
import { BADGES as C, POSITIONS as O, QUEUE_FILTERS as b, QUEUE_SHORT as F, TIERS as U, count as B, kda as G, positionName as w, queueName as A, queueShort as M, rankLabel as N, rankShort as H, rankValue as _, tierColor as D, tierRgb as q, topBadges as Q, winRate as W } from "./logic/labels.js";
import { RUNE_SLOTS as K, hasEvents as V, lineColor as z, relation as J, riotId as X, side as Y, teamsOf as Z } from "./logic/detail.js";
import { FIGHT_GAP as ee, PHASES as oe, involves as re, isEpic as ae, leadFor as te, scoreAt as fe, storyOf as me, valueAt as le } from "./logic/story.js";
import { lpByGame as se } from "./logic/lp.js";
import { fromCoreMatch as ue, gameIdOf as ie, playedWithFromCore as ne, positionOf as xe, profileFromCore as ce, rankFromCore as Se, summaryOf as he } from "./logic/core.js";
import { createInvadeUi as Pe, gameFavorite as ke, provideInvadeUi as Re, useFormat as ge, useInvadeUi as ye, useNames as Ee } from "./context.js";
import { default as Te } from "./components/Button.vue.js";
import { default as Ce } from "./components/Icon.vue.js";
import { default as be } from "./components/Link.vue.js";
import { default as Ue } from "./components/Logo.vue.js";
/* empty css                     */
import { default as Ge } from "./components/Panel.vue.js";
import { default as Ae } from "./components/Segmented.vue.js";
import { default as Ne } from "./components/Skeleton.vue.js";
import { default as _e } from "./components/StarButton.vue.js";
/* empty css                           */
import { default as qe } from "./components/Switch.vue.js";
import { default as We } from "./components/Tabs.vue.js";
import { default as Ke } from "./components/TrendLine.vue.js";
/* empty css                          */
import { default as ze } from "./components/ChampIcon.vue.js";
/* empty css                          */
import { default as Xe } from "./components/ItemIcons.vue.js";
import { default as Ze } from "./components/ObjectiveIcon.vue.js";
import { default as eo } from "./components/PerfDial.vue.js";
/* empty css                         */
import { default as ro } from "./components/RankCrest.vue.js";
/* empty css                          */
import { default as to } from "./components/RoleIcon.vue.js";
import { default as mo } from "./components/RunePage.vue.js";
/* empty css                         */
import { default as po } from "./components/MatchRow.vue.js";
/* empty css                         */
import { default as uo } from "./components/MatchRowSkeleton.vue.js";
/* empty css                                 */
import { default as no } from "./components/MatchList.vue.js";
import { default as co } from "./components/MatchDetailPanel.vue.js";
import { default as ho } from "./components/Scoreboard.vue.js";
import { default as Po } from "./components/Breakdown.vue.js";
import { default as Ro } from "./components/GoldChart.vue.js";
import { default as yo } from "./components/Timeline.vue.js";
import { default as Lo } from "./components/BuildTab.vue.js";
import { default as vo } from "./components/PlayerPicker.vue.js";
import { default as Oo } from "./components/ProfileLayout.vue.js";
import { default as Fo } from "./components/PlayerHeader.vue.js";
import { default as Bo } from "./components/ChampionTable.vue.js";
import { default as wo } from "./components/RolesPanel.vue.js";
import { default as Mo } from "./components/LpGraph.vue.js";
import { default as Ho } from "./components/PlayedWithPanel.vue.js";
export {
  C as BADGES,
  Po as Breakdown,
  Lo as BuildTab,
  Te as Button,
  ze as ChampIcon,
  Bo as ChampionTable,
  ee as FIGHT_GAP,
  Ro as GoldChart,
  Ce as Icon,
  Xe as ItemIcons,
  be as Link,
  Ue as Logo,
  Mo as LpGraph,
  co as MatchDetailPanel,
  no as MatchList,
  po as MatchRow,
  uo as MatchRowSkeleton,
  Ze as ObjectiveIcon,
  oe as PHASES,
  O as POSITIONS,
  Ge as Panel,
  eo as PerfDial,
  Ho as PlayedWithPanel,
  Fo as PlayerHeader,
  vo as PlayerPicker,
  Oo as ProfileLayout,
  b as QUEUE_FILTERS,
  F as QUEUE_SHORT,
  K as RUNE_SLOTS,
  ro as RankCrest,
  to as RoleIcon,
  wo as RolesPanel,
  mo as RunePage,
  ho as Scoreboard,
  Ae as Segmented,
  Ne as Skeleton,
  _e as StarButton,
  qe as Switch,
  U as TIERS,
  We as Tabs,
  yo as Timeline,
  Ke as TrendLine,
  c as ago,
  S as compact,
  B as count,
  Pe as createInvadeUi,
  h as dayKey,
  I as dayLabel,
  u as english,
  i as fill,
  ue as fromCoreMatch,
  ke as gameFavorite,
  ie as gameIdOf,
  V as hasEvents,
  re as involves,
  ae as isEpic,
  G as kda,
  P as kdaRatio,
  te as leadFor,
  z as lineColor,
  se as lpByGame,
  k as mmss,
  R as num,
  g as ordinal,
  y as pct,
  ne as playedWithFromCore,
  w as positionName,
  xe as positionOf,
  ce as profileFromCore,
  Re as provideInvadeUi,
  A as queueName,
  M as queueShort,
  Se as rankFromCore,
  N as rankLabel,
  H as rankShort,
  _ as rankValue,
  J as relation,
  X as riotId,
  E as score100,
  fe as scoreAt,
  Y as side,
  L as signedGold,
  T as signedLp,
  me as storyOf,
  he as summaryOf,
  Z as teamsOf,
  D as tierColor,
  q as tierRgb,
  n as tk,
  Q as topBadges,
  ge as useFormat,
  ye as useInvadeUi,
  Ee as useNames,
  le as valueAt,
  W as winRate
};
