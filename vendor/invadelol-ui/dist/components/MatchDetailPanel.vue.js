import { defineComponent as F, shallowRef as N, watch as B, computed as y, openBlock as a, createElementBlock as o, createElementVNode as s, createVNode as I, createTextVNode as p, toDisplayString as f, unref as r, Fragment as g, renderList as $, normalizeClass as D, createCommentVNode as w, createBlock as v } from "vue";
import { useInvadeUi as G, useFormat as L, useNames as M, gameFavorite as P } from "../context.js";
import { tk as b } from "../logic/i18n.js";
import { hasEvents as j } from "../logic/detail.js";
import S from "./Icon.vue.js";
import x from "./StarButton.vue.js";
/* empty css                */
import A from "./Scoreboard.vue.js";
import R from "./Breakdown.vue.js";
import U from "./GoldChart.vue.js";
import _ from "./Timeline.vue.js";
import q from "./BuildTab.vue.js";
const H = { class: "iv-md" }, J = {
  key: 0,
  class: "iv-md-state"
}, K = { class: "iv-error" }, O = {
  key: 1,
  class: "iv-md-loading",
  "aria-busy": "true"
}, Q = { class: "iv-md-skel-tabs" }, W = { class: "iv-md-top" }, X = { class: "iv-tabs" }, Y = ["onClick"], Z = { class: "iv-md-meta" }, ee = ["title"], te = { class: "iv-md-body" }, be = /* @__PURE__ */ F({
  __name: "MatchDetailPanel",
  props: {
    detail: {},
    puuid: {},
    error: { default: null },
    matchId: { default: null }
  },
  emits: ["retry"],
  setup(e) {
    const n = e, h = G(), { t: u } = h, { date: T } = L(), { champName: V } = M(), m = N(0);
    B(
      () => n.detail,
      (l) => m.value = Math.max(0, l?.players.findIndex((t) => t.puuid === n.puuid) ?? 0),
      { immediate: !0 }
    );
    const z = [
      { id: "scoreboard", label: b("Scoreboard"), timeline: !1 },
      { id: "breakdown", label: b("Breakdown"), timeline: !1 },
      { id: "gold", label: b("Gold"), timeline: !0 },
      { id: "timeline", label: b("Timeline"), timeline: !0 },
      { id: "build", label: b("Build"), timeline: !1 }
    ], d = N("scoreboard"), C = y(() => z.filter((l) => !l.timeline || n.detail?.timeline && (l.id !== "timeline" || j(n.detail))));
    B(C, (l) => {
      l.some((t) => t.id === d.value) || (d.value = "scoreboard");
    });
    const c = y(() => n.detail?.players.find((l) => l.puuid === n.puuid)), E = y(() => {
      const l = n.detail;
      if (!l) return "";
      const t = T(l.creation, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      return `${u("Patch {patch}", { patch: l.version.split(".").slice(0, 2).join(".") })} · ${t}${l.fromCore ? " · invade.lol" : ""}`;
    }), k = y(
      () => h.favorites && n.detail && c.value ? P(n.puuid, V(c.value.championId), { ...n.detail, ...c.value, matchId: n.matchId }) : null
    );
    return (l, t) => (a(), o("div", H, [
      e.error ? (a(), o("div", J, [
        s("p", K, [
          I(S, {
            name: "x",
            size: 15
          }),
          p(f(e.error), 1)
        ]),
        s("button", {
          type: "button",
          class: "iv-btn sm",
          onClick: t[0] || (t[0] = (i) => l.$emit("retry"))
        }, [
          I(S, {
            name: "refresh",
            size: 13
          }),
          p(f(r(u)("Try again")), 1)
        ])
      ])) : e.detail ? (a(), o(g, { key: 2 }, [
        s("div", W, [
          s("nav", X, [
            (a(!0), o(g, null, $(C.value, (i) => (a(), o("button", {
              key: i.id,
              type: "button",
              class: D({ on: d.value === i.id }),
              onClick: (ie) => d.value = i.id
            }, f(r(u)(i.label)), 11, Y))), 128))
          ]),
          s("p", Z, [
            e.detail.timeline ? w("", !0) : (a(), o("span", {
              key: 0,
              title: e.detail.fromCore ? r(u)("invade.lol has no timeline for this game: no graphs and no events.") : r(u)("The League client has no timeline for this game: no graphs and no events.")
            }, f(r(u)("No timeline")) + " · ", 9, ee)),
            p(f(E.value), 1)
          ]),
          k.value ? (a(), v(x, {
            key: 0,
            class: "iv-md-star",
            saved: r(h).favorites.has(k.value.key),
            label: `${r(u)("Game")} · ${k.value.label}`,
            onToggle: t[1] || (t[1] = (i) => r(h).favorites.toggle(k.value))
          }, null, 8, ["saved", "label"])) : w("", !0)
        ]),
        s("div", te, [
          d.value === "scoreboard" ? (a(), v(A, {
            key: 0,
            detail: e.detail,
            puuid: e.puuid
          }, null, 8, ["detail", "puuid"])) : d.value === "breakdown" ? (a(), v(R, {
            key: 1,
            detail: e.detail,
            selected: m.value,
            me: c.value,
            onSelect: t[2] || (t[2] = (i) => m.value = i)
          }, null, 8, ["detail", "selected", "me"])) : d.value === "gold" && e.detail.timeline ? (a(), v(U, {
            key: 2,
            detail: e.detail,
            timeline: e.detail.timeline,
            selected: m.value,
            me: c.value
          }, null, 8, ["detail", "timeline", "selected", "me"])) : d.value === "timeline" && e.detail.timeline ? (a(), v(_, {
            key: 3,
            detail: e.detail,
            timeline: e.detail.timeline,
            selected: m.value,
            me: c.value,
            onSelect: t[3] || (t[3] = (i) => m.value = i)
          }, null, 8, ["detail", "timeline", "selected", "me"])) : d.value === "build" ? (a(), v(q, {
            key: 4,
            detail: e.detail,
            selected: m.value,
            me: c.value,
            onSelect: t[4] || (t[4] = (i) => m.value = i)
          }, null, 8, ["detail", "selected", "me"])) : w("", !0)
        ])
      ], 64)) : (a(), o("div", O, [
        s("div", Q, [
          (a(), o(g, null, $(5, (i) => s("span", {
            key: i,
            class: "iv-skel"
          })), 64))
        ]),
        (a(), o(g, null, $(6, (i) => s("div", {
          key: i,
          class: "iv-skel iv-md-skel-row"
        })), 64))
      ]))
    ]));
  }
});
export {
  be as default
};
