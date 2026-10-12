import { inject as c, isRef as l, shallowRef as s } from "vue";
import { english as u } from "./logic/i18n.js";
import { signedLp as d, score100 as v, mmss as p, dayLabel as I, ago as f, kdaRatio as h, ordinal as k, signedGold as y, compact as U, pct as w, num as N } from "./logic/format.js";
const o = /* @__PURE__ */ Symbol("invade-ui");
function i(e) {
  return {
    t: e.t ?? u,
    locale: l(e.locale) ? e.locale : s(e.locale ?? "en"),
    assetUrl: e.assetUrl ?? (() => {
    }),
    name: (n, a) => e.name?.(n, a) || (n === "champion" ? `#${a}` : String(a)),
    linkTo: e.linkTo ?? (() => {
    }),
    onOpen: e.onOpen,
    viewer: l(e.viewer) ? e.viewer : s(e.viewer ?? null),
    favorites: e.favorites
  };
}
const b = i({});
function L(e, n) {
  e.provide(o, i(n));
}
const g = (e) => ({ install: (n) => L(n, e) }), r = () => c(o, b);
function F() {
  const { locale: e, t: n } = r();
  return {
    num: (a, t = 0) => N(a, t, e.value),
    pct: (a) => w(a, e.value),
    compact: (a) => U(a, e.value),
    signedGold: (a) => y(a, e.value),
    ordinal: (a) => k(a, e.value),
    kdaRatio: (a, t, m) => h(a, t, m, e.value),
    ago: (a) => f(a, e.value),
    dayLabel: (a) => I(a, n("Today"), n("Yesterday"), e.value),
    date: (a, t) => new Intl.DateTimeFormat(e.value, t).format(a),
    mmss: p,
    score100: v,
    signedLp: d
  };
}
function $(e, n, a) {
  return {
    key: `game:${e}:${a.gameId}`,
    kind: "game",
    label: n,
    puuid: e,
    gameId: a.gameId,
    matchId: a.matchId,
    queueId: a.queueId,
    championId: a.championId,
    win: a.win,
    remake: a.remake,
    kills: a.kills,
    deaths: a.deaths,
    assists: a.assists,
    creation: a.creation,
    duration: a.duration
  };
}
const q = () => {
  const e = r();
  return {
    champName: (n) => e.name("champion", n),
    champIcon: (n) => e.assetUrl("champion", n),
    runeName: (n) => e.name("rune", n),
    styleName: (n) => e.name("runeStyle", n),
    spellName: (n) => e.name("spell", n),
    runeIcon: (n) => e.assetUrl("rune", n),
    styleIcon: (n) => e.assetUrl("runeStyle", n),
    spellIcon: (n) => e.assetUrl("spell", n),
    itemIcon: (n) => e.assetUrl("item", n)
  };
};
export {
  g as createInvadeUi,
  $ as gameFavorite,
  L as provideInvadeUi,
  F as useFormat,
  r as useInvadeUi,
  q as useNames
};
