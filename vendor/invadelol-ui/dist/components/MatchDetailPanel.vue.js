import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
import { defineComponent as P, shallowRef as w, watch as C, computed as p, openBlock as a, createElementBlock as o, createElementVNode as s, createVNode as I, createTextVNode as B, toDisplayString as b, unref as m, Fragment as g, renderList as N, normalizeClass as D, createCommentVNode as $, createBlock as f, renderSlot as G } from "vue";
import { useInvadeUi as L, useFormat as M, useNames as j, gameFavorite as A } from "../context.js";
import { tk as h } from "../logic/i18n.js";
import { hasEvents as R } from "../logic/detail.js";
import { afterPaint as U } from "../dom.js";
import T from "./Icon.vue.js";
import q from "./StarButton.vue.js";
/* empty css                */
import H from "./Scoreboard.vue.js";
import J from "./Breakdown.vue.js";
import K from "./GoldChart.vue.js";
import O from "./Timeline.vue.js";
import Q from "./BuildTab.vue.js";
/* empty css                 */
/* empty css                       */
/* empty css                   */
const W = { class: "iv-md" }, X = {
  key: 0,
  class: "iv-md-state"
}, Y = { class: "iv-error" }, Z = {
  key: 1,
  class: "iv-md-loading",
  "aria-busy": "true"
}, x = { class: "iv-md-skel-tabs" }, _ = { class: "iv-md-top" }, ee = { class: "iv-tabs" }, te = ["onClick"], ie = { class: "iv-md-meta" }, le = ["title"], ae = {
  key: 1,
  class: "iv-md-actions"
}, ne = { class: "iv-md-body" }, Ce = /* @__PURE__ */ P({
  __name: "MatchDetailPanel",
  props: {
    detail: {},
    puuid: {},
    error: { default: null },
    matchId: { default: null },
    loading: { type: Boolean, default: !1 }
  },
  emits: ["retry"],
  setup(t) {
    const n = t, k = L(), { t: r } = k, { date: V } = M(), { champName: z } = j(), d = w(0);
    C(
      () => n.detail,
      (e) => d.value = Math.max(0, e?.players.findIndex((i) => i.puuid === n.puuid) ?? 0),
      { immediate: !0 }
    );
    const E = [
      { id: "scoreboard", label: h("Scoreboard"), timeline: !1 },
      { id: "breakdown", label: h("Breakdown"), timeline: !1 },
      { id: "gold", label: h("Gold"), timeline: !0 },
      { id: "timeline", label: h("Timeline"), timeline: !0 },
      { id: "build", label: h("Build"), timeline: !1 }
    ], c = w("scoreboard"), v = w("scoreboard");
    C(c, (e) => U(() => c.value === e && (v.value = e)));
    const S = p(() => E.filter((e) => !e.timeline || n.detail?.timeline && (e.id !== "timeline" || R(n.detail))));
    C(S, (e) => {
      e.some((i) => i.id === c.value) || (c.value = "scoreboard");
    });
    const u = p(() => n.detail?.players.find((e) => e.puuid === n.puuid)), F = p(() => {
      const e = n.detail;
      if (!e) return "";
      const i = V(e.creation, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      return `${r("Patch {patch}", { patch: e.version.split(".").slice(0, 2).join(".") })} · ${i}${e.fromCore ? " · invade.lol" : ""}`;
    }), y = p(
      () => k.favorites && n.detail && u.value ? A(n.puuid, z(u.value.championId), { ...n.detail, ...u.value, matchId: n.matchId }) : null
    );
    return (e, i) => (a(), o("div", W, [
      t.error ? (a(), o("div", X, [
        s("p", Y, [
          I(T, {
            name: "x",
            size: 15
          }),
          B(b(t.error), 1)
        ]),
        s("button", {
          type: "button",
          class: "iv-btn sm",
          onClick: i[0] || (i[0] = (l) => e.$emit("retry"))
        }, [
          I(T, {
            name: "refresh",
            size: 13
          }),
          B(b(m(r)("Try again")), 1)
        ])
      ])) : t.detail ? (a(), o(g, { key: 2 }, [
        s("div", _, [
          s("nav", ee, [
            (a(!0), o(g, null, N(S.value, (l) => (a(), o("button", {
              key: l.id,
              type: "button",
              class: D({ on: c.value === l.id }),
              onClick: (oe) => c.value = l.id
            }, b(m(r)(l.label)), 11, te))), 128))
          ]),
          s("p", ie, [
            !t.detail.timeline && !t.loading ? (a(), o("span", {
              key: 0,
              title: t.detail.fromCore ? m(r)("invade.lol has no timeline for this game: no graphs and no events.") : m(r)("The League client has no timeline for this game: no graphs and no events.")
            }, b(m(r)("No timeline")) + " · ", 9, le)) : $("", !0),
            B(b(F.value), 1)
          ]),
          y.value ? (a(), f(q, {
            key: 0,
            class: "iv-md-star",
            saved: m(k).favorites.has(y.value.key),
            label: `${m(r)("Game")} · ${y.value.label}`,
            onToggle: i[1] || (i[1] = (l) => m(k).favorites.toggle(y.value))
          }, null, 8, ["saved", "label"])) : $("", !0),
          e.$slots.actions ? (a(), o("span", ae, [
            G(e.$slots, "actions")
          ])) : $("", !0)
        ]),
        s("div", ne, [
          v.value === "scoreboard" ? (a(), f(H, {
            key: 0,
            detail: t.detail,
            puuid: t.puuid
          }, null, 8, ["detail", "puuid"])) : v.value === "breakdown" ? (a(), f(J, {
            key: 1,
            detail: t.detail,
            selected: d.value,
            me: u.value,
            onSelect: i[2] || (i[2] = (l) => d.value = l)
          }, null, 8, ["detail", "selected", "me"])) : v.value === "gold" && t.detail.timeline ? (a(), f(K, {
            key: 2,
            detail: t.detail,
            timeline: t.detail.timeline,
            selected: d.value,
            me: u.value
          }, null, 8, ["detail", "timeline", "selected", "me"])) : v.value === "timeline" && t.detail.timeline ? (a(), f(O, {
            key: 3,
            detail: t.detail,
            timeline: t.detail.timeline,
            selected: d.value,
            me: u.value,
            onSelect: i[3] || (i[3] = (l) => d.value = l)
          }, null, 8, ["detail", "timeline", "selected", "me"])) : v.value === "build" ? (a(), f(Q, {
            key: 4,
            detail: t.detail,
            selected: d.value,
            me: u.value,
            onSelect: i[4] || (i[4] = (l) => d.value = l)
          }, null, 8, ["detail", "selected", "me"])) : $("", !0)
        ])
      ], 64)) : (a(), o("div", Z, [
        s("div", x, [
          (a(), o(g, null, N(5, (l) => s("span", {
            key: l,
            class: "iv-skel"
          })), 64))
        ]),
        (a(), o(g, null, N(6, (l) => s("div", {
          key: l,
          class: "iv-skel iv-md-skel-row"
        })), 64))
      ]))
    ]));
  }
});
export {
  Ce as default
};
