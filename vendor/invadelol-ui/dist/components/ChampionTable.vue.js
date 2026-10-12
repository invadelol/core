import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
import { defineComponent as B, useModel as D, shallowRef as $, computed as y, openBlock as l, createElementBlock as i, normalizeClass as r, createElementVNode as t, toDisplayString as o, unref as s, createCommentVNode as b, Fragment as I, renderList as x, withKeys as K, withModifiers as L, createTextVNode as E, mergeModels as F } from "vue";
import { useInvadeUi as W, useFormat as q, useNames as z } from "../context.js";
/* empty css                 */
/* empty css                       */
/* empty css                    */
const G = { class: "iv-panel-head" }, U = {
  key: 0,
  class: "iv-seg sm"
}, j = {
  key: 1,
  class: "meta"
}, H = {
  key: 0,
  class: "iv-table iv-pf-table"
}, J = { class: "num" }, O = { class: "num" }, Q = { class: "num iv-pf-col-opt" }, X = { class: "num iv-pf-col-cs" }, Y = ["title"], Z = ["title", "onClick", "onKeydown"], ee = { class: "iv-pf-champ" }, te = { class: "iv-pf-portrait" }, se = ["src"], ne = { class: "num" }, oe = ["title"], ae = ["title"], le = { class: "num iv-pf-col-cs" }, ie = { class: "num" }, ce = {
  key: 1,
  class: "iv-pf-dim"
}, me = {
  key: 1,
  class: "iv-table iv-pf-table"
}, de = { class: "num iv-pf-col-opt" }, he = { class: "num" }, pe = { class: "num" }, ue = ["onClick", "onKeydown"], re = { class: "iv-pf-champ" }, ve = { class: "iv-pf-portrait" }, _e = ["src"], fe = { class: "num iv-pf-col-opt" }, ye = { class: "num" }, ge = { class: "num iv-pf-dim2" }, C = 6, Me = /* @__PURE__ */ B({
  __name: "ChampionTable",
  props: /* @__PURE__ */ F({
    profile: {},
    games: {},
    scores: {}
  }, {
    champion: { required: !0 },
    championModifiers: {}
  }),
  emits: ["update:champion"],
  setup(p) {
    const m = p, v = D(p, "champion"), { t: a } = W(), { ago: S, compact: N, kdaRatio: T, num: _, pct: P, score100: R } = q(), { champIcon: M, champName: g } = z(), d = $(m.profile.champions.length || !m.profile.card.mastery.length ? "recent" : "mastery"), u = $(!1), w = y(() => {
      const h = /* @__PURE__ */ new Map();
      for (const n of m.games) {
        const e = m.scores.get(n.gameId);
        if (!e) continue;
        const c = h.get(n.championId) ?? [0, 0];
        h.set(n.championId, [c[0] + e.score, c[1] + 1]);
      }
      return m.profile.champions.map((n) => {
        const e = h.get(n.championId), c = Math.max(1, n.games);
        return {
          id: n.championId,
          games: n.games,
          wins: n.wins,
          wr: n.games ? n.wins / n.games : 0,
          kda: T(n.kills, n.deaths, n.assists),
          avg: `${_(n.kills / c, 1)} / ${_(n.deaths / c, 1)} / ${_(n.assists / c, 1)}`,
          csMin: n.cs / Math.max(1, n.seconds / 60),
          score: e ? R(e[0] / e[1]) : null
        };
      });
    }), V = y(() => u.value ? w.value : w.value.slice(0, C)), A = y(() => m.profile.card.mastery.slice(0, u.value ? 20 : C)), k = y(() => d.value === "recent" ? w.value.length : Math.min(20, m.profile.card.mastery.length)), f = (h) => v.value = v.value === h ? 0 : h;
    return (h, n) => p.profile.champions.length || p.profile.card.mastery.length ? (l(), i("section", {
      key: 0,
      class: r(["iv-panel iv-pf-panel iv-pf-champs", { all: u.value }])
    }, [
      t("header", G, [
        t("h3", null, o(s(a)("Champions")), 1),
        p.profile.card.mastery.length && p.profile.champions.length ? (l(), i("div", U, [
          t("button", {
            type: "button",
            class: r({ on: d.value === "recent" }),
            onClick: n[0] || (n[0] = (e) => d.value = "recent")
          }, o(s(a)("Recent")), 3),
          t("button", {
            type: "button",
            class: r({ on: d.value === "mastery" }),
            onClick: n[1] || (n[1] = (e) => d.value = "mastery")
          }, o(s(a)("Mastery")), 3)
        ])) : d.value === "mastery" ? (l(), i("span", j, o(s(a)("Mastery")), 1)) : b("", !0)
      ]),
      d.value === "recent" ? (l(), i("table", H, [
        t("thead", null, [
          t("tr", null, [
            t("th", null, o(s(a)("Champion")), 1),
            t("th", J, o(s(a)("Games")), 1),
            t("th", O, o(s(a)("Win")), 1),
            t("th", Q, o(s(a)("KDA")), 1),
            t("th", X, o(s(a)("CS/min")), 1),
            t("th", {
              class: "num",
              title: s(a)("Average Invade score")
            }, o(s(a)("Score")), 9, Y)
          ])
        ]),
        t("tbody", null, [
          (l(!0), i(I, null, x(V.value, (e) => (l(), i("tr", {
            key: e.id,
            class: r({ self: v.value === e.id }),
            title: s(a)("Show only {champion} games", { champion: s(g)(e.id) }),
            tabindex: "0",
            onClick: (c) => f(e.id),
            onKeydown: K(L((c) => f(e.id), ["prevent"]), ["enter"])
          }, [
            t("td", null, [
              t("span", ee, [
                t("span", te, [
                  t("img", {
                    src: s(M)(e.id),
                    alt: ""
                  }, null, 8, se)
                ]),
                t("b", null, o(s(g)(e.id)), 1)
              ])
            ]),
            t("td", ne, o(e.games), 1),
            t("td", {
              class: "num",
              title: s(a)("{w}W {l}L", { w: e.wins, l: e.games - e.wins })
            }, o(s(P)(e.wr)), 9, oe),
            t("td", {
              class: "num iv-pf-col-opt",
              title: e.avg
            }, o(e.kda), 9, ae),
            t("td", le, o(s(_)(e.csMin, 1)), 1),
            t("td", ie, [
              e.score !== null ? (l(), i(I, { key: 0 }, [
                E(o(e.score), 1)
              ], 64)) : (l(), i("span", ce, "–"))
            ])
          ], 42, Z))), 128))
        ])
      ])) : (l(), i("table", me, [
        t("thead", null, [
          t("tr", null, [
            t("th", null, o(s(a)("Champion")), 1),
            t("th", de, o(s(a)("Level")), 1),
            t("th", he, o(s(a)("Points")), 1),
            t("th", pe, o(s(a)("Last played")), 1)
          ])
        ]),
        t("tbody", null, [
          (l(!0), i(I, null, x(A.value, (e) => (l(), i("tr", {
            key: e.championId,
            class: r({ self: v.value === e.championId }),
            tabindex: "0",
            onClick: (c) => f(e.championId),
            onKeydown: K(L((c) => f(e.championId), ["prevent"]), ["enter"])
          }, [
            t("td", null, [
              t("span", re, [
                t("span", ve, [
                  t("img", {
                    src: s(M)(e.championId),
                    alt: ""
                  }, null, 8, _e)
                ]),
                t("b", null, o(s(g)(e.championId)), 1)
              ])
            ]),
            t("td", fe, o(e.championLevel), 1),
            t("td", ye, o(s(N)(e.championPoints)), 1),
            t("td", ge, o(e.lastPlayTime ? s(S)(e.lastPlayTime) : "–"), 1)
          ], 42, ue))), 128))
        ])
      ])),
      k.value > 3 ? (l(), i("button", {
        key: 2,
        type: "button",
        class: r(["iv-btn ghost sm iv-pf-more-rows", { few: k.value <= C }]),
        onClick: n[2] || (n[2] = (e) => u.value = !u.value)
      }, o(u.value ? s(a)("Show less") : s(a)("Show all {n}", { n: k.value })), 3)) : b("", !0)
    ], 2)) : b("", !0);
  }
});
export {
  Me as default
};
