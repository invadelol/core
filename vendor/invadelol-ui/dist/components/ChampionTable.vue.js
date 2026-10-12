import { defineComponent as B, useModel as D, shallowRef as $, computed as y, openBlock as l, createElementBlock as i, normalizeClass as r, createElementVNode as s, toDisplayString as o, unref as t, createCommentVNode as b, Fragment as I, renderList as x, withKeys as K, withModifiers as L, createTextVNode as E, mergeModels as F } from "vue";
import { useInvadeUi as W, useFormat as q, useNames as z } from "../context.js";
const G = { class: "iv-panel-head" }, U = {
  key: 0,
  class: "iv-seg sm"
}, j = {
  key: 1,
  class: "meta"
}, H = {
  key: 0,
  class: "iv-table iv-pf-table"
}, J = { class: "num" }, O = { class: "num" }, Q = { class: "num iv-pf-col-opt" }, X = { class: "num iv-pf-col-cs" }, Y = ["title"], Z = ["title", "onClick", "onKeydown"], ee = { class: "iv-pf-champ" }, se = { class: "iv-pf-portrait" }, te = ["src"], ne = { class: "num" }, oe = ["title"], ae = ["title"], le = { class: "num iv-pf-col-cs" }, ie = { class: "num" }, ce = {
  key: 1,
  class: "iv-pf-dim"
}, de = {
  key: 1,
  class: "iv-table iv-pf-table"
}, me = { class: "num iv-pf-col-opt" }, he = { class: "num" }, ue = { class: "num" }, pe = ["onClick", "onKeydown"], re = { class: "iv-pf-champ" }, ve = { class: "iv-pf-portrait" }, _e = ["src"], fe = { class: "num iv-pf-col-opt" }, ye = { class: "num" }, ge = { class: "num iv-pf-dim2" }, C = 6, be = /* @__PURE__ */ B({
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
  setup(u) {
    const d = u, v = D(u, "champion"), { t: a } = W(), { ago: S, compact: N, kdaRatio: T, num: _, pct: P, score100: R } = q(), { champIcon: M, champName: g } = z(), m = $(d.profile.champions.length || !d.profile.card.mastery.length ? "recent" : "mastery"), p = $(!1), w = y(() => {
      const h = /* @__PURE__ */ new Map();
      for (const n of d.games) {
        const e = d.scores.get(n.gameId);
        if (!e) continue;
        const c = h.get(n.championId) ?? [0, 0];
        h.set(n.championId, [c[0] + e.score, c[1] + 1]);
      }
      return d.profile.champions.map((n) => {
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
    }), V = y(() => p.value ? w.value : w.value.slice(0, C)), A = y(() => d.profile.card.mastery.slice(0, p.value ? 20 : C)), k = y(() => m.value === "recent" ? w.value.length : Math.min(20, d.profile.card.mastery.length)), f = (h) => v.value = v.value === h ? 0 : h;
    return (h, n) => u.profile.champions.length || u.profile.card.mastery.length ? (l(), i("section", {
      key: 0,
      class: r(["iv-panel iv-pf-panel iv-pf-champs", { all: p.value }])
    }, [
      s("header", G, [
        s("h3", null, o(t(a)("Champions")), 1),
        u.profile.card.mastery.length && u.profile.champions.length ? (l(), i("div", U, [
          s("button", {
            type: "button",
            class: r({ on: m.value === "recent" }),
            onClick: n[0] || (n[0] = (e) => m.value = "recent")
          }, o(t(a)("Recent")), 3),
          s("button", {
            type: "button",
            class: r({ on: m.value === "mastery" }),
            onClick: n[1] || (n[1] = (e) => m.value = "mastery")
          }, o(t(a)("Mastery")), 3)
        ])) : m.value === "mastery" ? (l(), i("span", j, o(t(a)("Mastery")), 1)) : b("", !0)
      ]),
      m.value === "recent" ? (l(), i("table", H, [
        s("thead", null, [
          s("tr", null, [
            s("th", null, o(t(a)("Champion")), 1),
            s("th", J, o(t(a)("Games")), 1),
            s("th", O, o(t(a)("Win")), 1),
            s("th", Q, o(t(a)("KDA")), 1),
            s("th", X, o(t(a)("CS/min")), 1),
            s("th", {
              class: "num",
              title: t(a)("Average Invade score")
            }, o(t(a)("Score")), 9, Y)
          ])
        ]),
        s("tbody", null, [
          (l(!0), i(I, null, x(V.value, (e) => (l(), i("tr", {
            key: e.id,
            class: r({ self: v.value === e.id }),
            title: t(a)("Show only {champion} games", { champion: t(g)(e.id) }),
            tabindex: "0",
            onClick: (c) => f(e.id),
            onKeydown: K(L((c) => f(e.id), ["prevent"]), ["enter"])
          }, [
            s("td", null, [
              s("span", ee, [
                s("span", se, [
                  s("img", {
                    src: t(M)(e.id),
                    alt: ""
                  }, null, 8, te)
                ]),
                s("b", null, o(t(g)(e.id)), 1)
              ])
            ]),
            s("td", ne, o(e.games), 1),
            s("td", {
              class: "num",
              title: t(a)("{w}W {l}L", { w: e.wins, l: e.games - e.wins })
            }, o(t(P)(e.wr)), 9, oe),
            s("td", {
              class: "num iv-pf-col-opt",
              title: e.avg
            }, o(e.kda), 9, ae),
            s("td", le, o(t(_)(e.csMin, 1)), 1),
            s("td", ie, [
              e.score !== null ? (l(), i(I, { key: 0 }, [
                E(o(e.score), 1)
              ], 64)) : (l(), i("span", ce, "–"))
            ])
          ], 42, Z))), 128))
        ])
      ])) : (l(), i("table", de, [
        s("thead", null, [
          s("tr", null, [
            s("th", null, o(t(a)("Champion")), 1),
            s("th", me, o(t(a)("Level")), 1),
            s("th", he, o(t(a)("Points")), 1),
            s("th", ue, o(t(a)("Last played")), 1)
          ])
        ]),
        s("tbody", null, [
          (l(!0), i(I, null, x(A.value, (e) => (l(), i("tr", {
            key: e.championId,
            class: r({ self: v.value === e.championId }),
            tabindex: "0",
            onClick: (c) => f(e.championId),
            onKeydown: K(L((c) => f(e.championId), ["prevent"]), ["enter"])
          }, [
            s("td", null, [
              s("span", re, [
                s("span", ve, [
                  s("img", {
                    src: t(M)(e.championId),
                    alt: ""
                  }, null, 8, _e)
                ]),
                s("b", null, o(t(g)(e.championId)), 1)
              ])
            ]),
            s("td", fe, o(e.championLevel), 1),
            s("td", ye, o(t(N)(e.championPoints)), 1),
            s("td", ge, o(e.lastPlayTime ? t(S)(e.lastPlayTime) : "–"), 1)
          ], 42, pe))), 128))
        ])
      ])),
      k.value > 3 ? (l(), i("button", {
        key: 2,
        type: "button",
        class: r(["iv-btn ghost sm iv-pf-more-rows", { few: k.value <= C }]),
        onClick: n[2] || (n[2] = (e) => p.value = !p.value)
      }, o(p.value ? t(a)("Show less") : t(a)("Show all {n}", { n: k.value })), 3)) : b("", !0)
    ], 2)) : b("", !0);
  }
});
export {
  be as default
};
