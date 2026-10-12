import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
import { defineComponent as ie, useSlots as ue, useModel as L, computed as w, shallowRef as V, watch as re, nextTick as ce, openBlock as a, createElementBlock as n, createElementVNode as r, Fragment as k, renderList as C, normalizeClass as N, createTextVNode as v, toDisplayString as i, unref as s, createCommentVNode as g, createVNode as b, withDirectives as z, vModelSelect as x, renderSlot as de, createBlock as me, mergeModels as D } from "vue";
import { useInvadeUi as ve, useFormat as pe, useNames as he } from "../context.js";
import { dayKey as fe } from "../logic/format.js";
import { QUEUE_FILTERS as F, QUEUE_SHORT as ye, positionName as A, count as ge } from "../logic/labels.js";
import T from "./Icon.vue.js";
import ke from "./MatchRow.vue.js";
/* empty css              */
import be from "./MatchRowSkeleton.vue.js";
/* empty css                      */
import Ie from "./MoreMatches.vue.js";
import we from "./RoleIcon.vue.js";
/* empty css                 */
/* empty css                       */
/* empty css                    */
const _e = {
  key: 0,
  class: "iv-pf-bar"
}, qe = { class: "iv-seg" }, Me = ["onClick"], Ce = { key: 0 }, $e = {
  key: 0,
  class: "iv-seg iv-pf-roleseg"
}, Se = ["title", "aria-label", "aria-pressed", "onClick"], Te = ["aria-label"], Le = { value: 0 }, Ne = ["value"], Ee = ["aria-label"], Ue = { value: "recent" }, Be = { value: "champion" }, Oe = {
  key: 1,
  class: "iv-pf-sum"
}, Re = { class: "iv-pf-sum-figs" }, Ve = ["title"], ze = ["title"], xe = ["title"], De = {
  key: 2,
  class: "iv-pf-feed-skel"
}, Fe = {
  key: 3,
  class: "iv-pf-state"
}, Ae = { key: 0 }, Pe = { class: "iv-error" }, Ke = {
  key: 4,
  class: "iv-pf-state"
}, Qe = { key: 0 }, We = { key: 1 }, Ge = {
  key: 5,
  class: "iv-pf-state"
}, He = { class: "iv-mr-day" }, Je = { class: "iv-mr-list" }, je = ["data-game"], dt = /* @__PURE__ */ ie({
  __name: "MatchList",
  props: /* @__PURE__ */ D({
    puuid: {},
    games: {},
    scores: {},
    lp: { default: () => /* @__PURE__ */ new Map() },
    status: {},
    error: { default: "" },
    private: { type: Boolean, default: !1 },
    more: { type: Boolean, default: !1 },
    loadMore: { type: Function, default: void 0 },
    focus: { default: null }
  }, {
    queue: { required: !0 },
    queueModifiers: {},
    champion: { required: !0 },
    championModifiers: {},
    role: { required: !0 },
    roleModifiers: {},
    order: { required: !0 },
    orderModifiers: {}
  }),
  emits: /* @__PURE__ */ D(["retry"], ["update:queue", "update:champion", "update:role", "update:order"]),
  setup(c, { emit: P }) {
    const h = c, K = P, Q = ue(), { t: o } = ve(), { dayLabel: W, kdaRatio: G, num: H, pct: J, score100: j, signedLp: X } = pe(), { champName: I } = he(), _ = L(c, "queue"), y = L(c, "champion"), f = L(c, "role"), q = L(c, "order"), Y = (t) => F.find((l) => l.id === t)?.queues, U = (t, l) => {
      const e = Y(l);
      return !e || e.includes(t.queueId);
    }, Z = w(
      () => F.map((t) => ({ id: t.id, label: ye[t.id] ?? t.label, n: h.games.filter((l) => U(l, t.id)).length })).filter(
        (t) => t.id === "all" || t.n > 0 || t.id === _.value
      )
    ), ee = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"], B = w(() => ee.filter((t) => t === f.value || h.games.some((l) => l.lane === t))), te = w(() => {
      const t = /* @__PURE__ */ new Map();
      for (const l of h.games) t.set(l.championId, (t.get(l.championId) ?? 0) + 1);
      return y.value && !t.has(y.value) && t.set(y.value, 0), [...t].sort((l, e) => I(l[0]).localeCompare(I(e[0]))).map(([l, e]) => ({ id: l, n: e }));
    }), le = w(() => _.value !== "all" || !!y.value || !!f.value);
    function E() {
      _.value = "all", y.value = 0, f.value = "";
    }
    const $ = w(() => {
      const t = h.games.filter(
        (l) => U(l, _.value) && (!y.value || l.championId === y.value) && (!f.value || l.lane === f.value)
      );
      return q.value === "champion" ? [...t].sort((l, e) => I(l.championId).localeCompare(I(e.championId)) || e.creation - l.creation) : [...t].sort((l, e) => e.creation - l.creation);
    }), p = w(() => {
      const t = $.value.filter((u) => !u.remake), l = t.filter((u) => u.win).length, e = (u) => t.reduce((S, ne) => S + u(ne), 0), d = e((u) => u.duration) / 60, m = t.map((u) => h.scores.get(u.gameId)?.score).filter((u) => u != null);
      return {
        games: t.length,
        wins: l,
        losses: t.length - l,
        kda: G(e((u) => u.kills), e((u) => u.deaths), e((u) => u.assists)),
        csMin: d ? e((u) => u.cs) / d : 0,
        score: m.length ? j(m.reduce((u, S) => u + S, 0) / m.length) : null,
        /** Oldest to newest, the latest 20. */
        form: [...$.value.slice(0, 20)].sort((u, S) => u.creation - S.creation)
      };
    }), se = w(() => {
      const t = [], l = /* @__PURE__ */ new Map();
      for (const e of $.value) {
        const d = q.value === "champion" ? String(e.championId) : fe(e.creation);
        let m = l.get(d);
        if (!m) {
          const u = q.value === "champion" ? I(e.championId) : W(e.creation);
          m = { key: d, label: u, games: [], wins: 0, losses: 0, lp: null }, l.set(d, m), t.push(m);
        }
        m.games.push(e), e.remake || (e.win ? m.wins++ : m.losses++);
      }
      for (const e of t) {
        const d = e.games.filter((m) => !m.remake && (m.queueId === 420 || m.queueId === 440));
        d.length && d.every((m) => h.lp.has(m.gameId)) && (e.lp = d.reduce((m, u) => m + h.lp.get(u.gameId), 0));
      }
      return t;
    }), M = V(null), ae = (t) => Q.detail && (M.value = M.value === t ? null : t), O = V(null);
    let R = null;
    re(
      () => [h.focus, h.games],
      async ([t]) => {
        if (!t || t === R) return;
        const l = h.games.find((e) => e.gameId === t);
        l && (R = t, $.value.includes(l) || E(), q.value = "recent", M.value = t, await ce(), O.value?.querySelector(`[data-game="${t}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" }));
      },
      { immediate: !0 }
    );
    const oe = (t) => `${I(t.championId)} · ${t.remake ? o("Remake") : t.win ? o("Win") : o("Loss")} · ${t.kills}/${t.deaths}/${t.assists}`;
    return (t, l) => (a(), n("section", {
      ref_key: "root",
      ref: O,
      class: "iv-pf-feed"
    }, [
      c.games.length ? (a(), n("div", _e, [
        r("div", qe, [
          (a(!0), n(k, null, C(Z.value, (e) => (a(), n("button", {
            key: e.id,
            type: "button",
            class: N({ on: _.value === e.id }),
            onClick: (d) => _.value = e.id
          }, [
            v(i(s(o)(e.label)), 1),
            e.id !== "all" ? (a(), n("small", Ce, i(e.n), 1)) : g("", !0)
          ], 10, Me))), 128))
        ]),
        B.value.length > 1 || f.value ? (a(), n("div", $e, [
          (a(!0), n(k, null, C(B.value, (e) => (a(), n("button", {
            key: e,
            type: "button",
            class: N({ on: f.value === e }),
            title: s(A)(e, s(o)),
            "aria-label": s(A)(e, s(o)),
            "aria-pressed": f.value === e,
            onClick: (d) => f.value = f.value === e ? "" : e
          }, [
            b(we, { lane: e }, null, 8, ["lane"])
          ], 10, Se))), 128))
        ])) : g("", !0),
        z(r("select", {
          "onUpdate:modelValue": l[0] || (l[0] = (e) => y.value = e),
          class: "iv-select iv-pf-select",
          "aria-label": s(o)("Filter games by champion")
        }, [
          r("option", Le, i(s(o)("All champions")), 1),
          (a(!0), n(k, null, C(te.value, (e) => (a(), n("option", {
            key: e.id,
            value: e.id
          }, i(s(I)(e.id)) + " (" + i(e.n) + ")", 9, Ne))), 128))
        ], 8, Te), [
          [
            x,
            y.value,
            void 0,
            { number: !0 }
          ]
        ]),
        z(r("select", {
          "onUpdate:modelValue": l[1] || (l[1] = (e) => q.value = e),
          class: "iv-select iv-pf-select iv-pf-order",
          "aria-label": s(o)("Sort games")
        }, [
          r("option", Ue, i(s(o)("By date")), 1),
          r("option", Be, i(s(o)("By champion")), 1)
        ], 8, Ee), [
          [x, q.value]
        ])
      ])) : g("", !0),
      c.status === "ready" && p.value.games ? (a(), n("div", Oe, [
        r("span", Re, [
          r("span", null, [
            r("b", null, i(s(ge)(p.value.games, "games", s(o))), 1)
          ]),
          r("span", null, [
            r("b", null, i(s(o)("{w}W {l}L", { w: p.value.wins, l: p.value.losses })), 1),
            v(" " + i(s(J)(p.value.wins / p.value.games)), 1)
          ]),
          r("span", null, [
            r("b", null, i(p.value.kda), 1),
            v(" " + i(s(o)("KDA")), 1)
          ]),
          r("span", null, [
            r("b", null, i(s(H)(p.value.csMin, 1)), 1),
            v(" " + i(s(o)("CS/min")), 1)
          ]),
          p.value.score !== null ? (a(), n("span", {
            key: 0,
            title: s(o)("Average Invade score")
          }, [
            r("b", null, i(p.value.score), 1),
            v(" " + i(s(o)("avg score")), 1)
          ], 8, Ve)) : g("", !0)
        ]),
        r("span", {
          class: "iv-form iv-pf-form",
          title: s(o)("Oldest to newest")
        }, [
          (a(!0), n(k, null, C(p.value.form, (e) => (a(), n("i", {
            key: e.gameId,
            class: N(e.remake ? "r" : e.win ? "w" : "l"),
            title: oe(e)
          }, null, 10, xe))), 128))
        ], 8, ze),
        le.value ? (a(), n("button", {
          key: 0,
          type: "button",
          class: "iv-btn ghost sm iv-pf-clear",
          onClick: E
        }, [
          b(T, {
            name: "x",
            size: 13
          }),
          v(i(s(o)("Clear filters")), 1)
        ])) : g("", !0)
      ])) : g("", !0),
      c.status === "loading" ? (a(), n("div", De, [
        l[3] || (l[3] = r("span", { class: "iv-skel iv-pf-skel-day" }, null, -1)),
        b(be, { count: 7 })
      ])) : c.status === "error" ? (a(), n("div", Fe, [
        c.private ? (a(), n("p", Ae, [
          b(T, {
            name: "eye",
            size: 15
          }),
          v(i(s(o)("This player's match history is private.")), 1)
        ])) : (a(), n(k, { key: 1 }, [
          r("p", Pe, [
            b(T, {
              name: "x",
              size: 15
            }),
            v(i(c.error || s(o)("Something went wrong")), 1)
          ]),
          r("button", {
            type: "button",
            class: "iv-btn sm",
            onClick: l[2] || (l[2] = (e) => K("retry"))
          }, [
            b(T, {
              name: "refresh",
              size: 13
            }),
            v(i(s(o)("Try again")), 1)
          ])
        ], 64))
      ])) : c.games.length ? $.value.length ? (a(!0), n(k, { key: 6 }, C(se.value, (e) => (a(), n("section", {
        key: e.key,
        class: "iv-pf-day"
      }, [
        r("h3", He, [
          v(i(e.label) + " ", 1),
          r("span", null, [
            v(i(s(o)("{w}W {l}L", { w: e.wins, l: e.losses })), 1),
            e.lp !== null ? (a(), n(k, { key: 0 }, [
              v(" · " + i(s(X)(e.lp)) + " " + i(s(o)("LP")), 1)
            ], 64)) : g("", !0)
          ])
        ]),
        r("ul", Je, [
          (a(!0), n(k, null, C(e.games, (d) => (a(), n("li", {
            key: d.gameId,
            class: N(["iv-pf-match", { open: M.value === d.gameId }]),
            "data-game": d.gameId
          }, [
            b(ke, {
              game: d,
              score: c.scores.get(d.gameId) ?? null,
              lp: c.lp.get(d.gameId) ?? null,
              open: M.value === d.gameId,
              puuid: c.puuid,
              onToggle: (m) => ae(d.gameId)
            }, null, 8, ["game", "score", "lp", "open", "puuid", "onToggle"]),
            M.value === d.gameId ? de(t.$slots, "detail", { game: d }, void 0, void 0, 0) : g("", !0)
          ], 10, je))), 128))
        ])
      ]))), 128)) : (a(), n("div", Ge, [
        r("p", null, i(s(o)("No games match these filters in the {n} loaded.", { n: c.games.length })), 1),
        r("button", {
          type: "button",
          class: "iv-btn sm",
          onClick: E
        }, i(s(o)("Clear filters")), 1)
      ])) : (a(), n("div", Ke, [
        c.private ? (a(), n("p", Qe, [
          b(T, {
            name: "eye",
            size: 15
          }),
          v(i(s(o)("This player's match history is private.")), 1)
        ])) : (a(), n("p", We, i(s(o)("No games in this history yet.")), 1))
      ])),
      c.loadMore && c.status === "ready" && c.games.length ? (a(), me(Ie, {
        key: c.puuid,
        more: c.more,
        load: c.loadMore
      }, null, 8, ["more", "load"])) : g("", !0)
    ], 512));
  }
});
export {
  dt as default
};
