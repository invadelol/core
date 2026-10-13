import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
import { defineComponent as F, shallowRef as B, watch as N, computed as y, openBlock as a, createElementBlock as o, createElementVNode as d, createVNode as S, createTextVNode as $, toDisplayString as f, unref as r, Fragment as g, renderList as w, normalizeClass as D, createCommentVNode as p, createBlock as v, renderSlot as G } from "vue";
import { useInvadeUi as L, useFormat as M, useNames as P, gameFavorite as j } from "../context.js";
import { tk as h } from "../logic/i18n.js";
import { hasEvents as A } from "../logic/detail.js";
import I from "./Icon.vue.js";
import R from "./StarButton.vue.js";
/* empty css                */
import U from "./Scoreboard.vue.js";
import q from "./Breakdown.vue.js";
import H from "./GoldChart.vue.js";
import J from "./Timeline.vue.js";
import K from "./BuildTab.vue.js";
/* empty css                 */
/* empty css                       */
/* empty css                   */
const O = { class: "iv-md" }, Q = {
  key: 0,
  class: "iv-md-state"
}, W = { class: "iv-error" }, X = {
  key: 1,
  class: "iv-md-loading",
  "aria-busy": "true"
}, Y = { class: "iv-md-skel-tabs" }, Z = { class: "iv-md-top" }, x = { class: "iv-tabs" }, _ = ["onClick"], ee = { class: "iv-md-meta" }, te = ["title"], ie = {
  key: 1,
  class: "iv-md-actions"
}, le = { class: "iv-md-body" }, pe = /* @__PURE__ */ F({
  __name: "MatchDetailPanel",
  props: {
    detail: {},
    puuid: {},
    error: { default: null },
    matchId: { default: null },
    loading: { type: Boolean, default: !1 }
  },
  emits: ["retry"],
  setup(e) {
    const n = e, k = L(), { t: u } = k, { date: T } = M(), { champName: V } = P(), m = B(0);
    N(
      () => n.detail,
      (t) => m.value = Math.max(0, t?.players.findIndex((i) => i.puuid === n.puuid) ?? 0),
      { immediate: !0 }
    );
    const z = [
      { id: "scoreboard", label: h("Scoreboard"), timeline: !1 },
      { id: "breakdown", label: h("Breakdown"), timeline: !1 },
      { id: "gold", label: h("Gold"), timeline: !0 },
      { id: "timeline", label: h("Timeline"), timeline: !0 },
      { id: "build", label: h("Build"), timeline: !1 }
    ], s = B("scoreboard"), C = y(() => z.filter((t) => !t.timeline || n.detail?.timeline && (t.id !== "timeline" || A(n.detail))));
    N(C, (t) => {
      t.some((i) => i.id === s.value) || (s.value = "scoreboard");
    });
    const c = y(() => n.detail?.players.find((t) => t.puuid === n.puuid)), E = y(() => {
      const t = n.detail;
      if (!t) return "";
      const i = T(t.creation, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      return `${u("Patch {patch}", { patch: t.version.split(".").slice(0, 2).join(".") })} · ${i}${t.fromCore ? " · invade.lol" : ""}`;
    }), b = y(
      () => k.favorites && n.detail && c.value ? j(n.puuid, V(c.value.championId), { ...n.detail, ...c.value, matchId: n.matchId }) : null
    );
    return (t, i) => (a(), o("div", O, [
      e.error ? (a(), o("div", Q, [
        d("p", W, [
          S(I, {
            name: "x",
            size: 15
          }),
          $(f(e.error), 1)
        ]),
        d("button", {
          type: "button",
          class: "iv-btn sm",
          onClick: i[0] || (i[0] = (l) => t.$emit("retry"))
        }, [
          S(I, {
            name: "refresh",
            size: 13
          }),
          $(f(r(u)("Try again")), 1)
        ])
      ])) : e.detail ? (a(), o(g, { key: 2 }, [
        d("div", Z, [
          d("nav", x, [
            (a(!0), o(g, null, w(C.value, (l) => (a(), o("button", {
              key: l.id,
              type: "button",
              class: D({ on: s.value === l.id }),
              onClick: (ae) => s.value = l.id
            }, f(r(u)(l.label)), 11, _))), 128))
          ]),
          d("p", ee, [
            !e.detail.timeline && !e.loading ? (a(), o("span", {
              key: 0,
              title: e.detail.fromCore ? r(u)("invade.lol has no timeline for this game: no graphs and no events.") : r(u)("The League client has no timeline for this game: no graphs and no events.")
            }, f(r(u)("No timeline")) + " · ", 9, te)) : p("", !0),
            $(f(E.value), 1)
          ]),
          b.value ? (a(), v(R, {
            key: 0,
            class: "iv-md-star",
            saved: r(k).favorites.has(b.value.key),
            label: `${r(u)("Game")} · ${b.value.label}`,
            onToggle: i[1] || (i[1] = (l) => r(k).favorites.toggle(b.value))
          }, null, 8, ["saved", "label"])) : p("", !0),
          t.$slots.actions ? (a(), o("span", ie, [
            G(t.$slots, "actions")
          ])) : p("", !0)
        ]),
        d("div", le, [
          s.value === "scoreboard" ? (a(), v(U, {
            key: 0,
            detail: e.detail,
            puuid: e.puuid
          }, null, 8, ["detail", "puuid"])) : s.value === "breakdown" ? (a(), v(q, {
            key: 1,
            detail: e.detail,
            selected: m.value,
            me: c.value,
            onSelect: i[2] || (i[2] = (l) => m.value = l)
          }, null, 8, ["detail", "selected", "me"])) : s.value === "gold" && e.detail.timeline ? (a(), v(H, {
            key: 2,
            detail: e.detail,
            timeline: e.detail.timeline,
            selected: m.value,
            me: c.value
          }, null, 8, ["detail", "timeline", "selected", "me"])) : s.value === "timeline" && e.detail.timeline ? (a(), v(J, {
            key: 3,
            detail: e.detail,
            timeline: e.detail.timeline,
            selected: m.value,
            me: c.value,
            onSelect: i[3] || (i[3] = (l) => m.value = l)
          }, null, 8, ["detail", "timeline", "selected", "me"])) : s.value === "build" ? (a(), v(K, {
            key: 4,
            detail: e.detail,
            selected: m.value,
            me: c.value,
            onSelect: i[4] || (i[4] = (l) => m.value = l)
          }, null, 8, ["detail", "selected", "me"])) : p("", !0)
        ])
      ], 64)) : (a(), o("div", X, [
        d("div", Y, [
          (a(), o(g, null, w(5, (l) => d("span", {
            key: l,
            class: "iv-skel"
          })), 64))
        ]),
        (a(), o(g, null, w(6, (l) => d("div", {
          key: l,
          class: "iv-skel iv-md-skel-row"
        })), 64))
      ]))
    ]));
  }
});
export {
  pe as default
};
