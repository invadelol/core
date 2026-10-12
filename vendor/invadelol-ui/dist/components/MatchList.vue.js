import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
import { defineComponent as ie, useSlots as ue, useModel as T, computed as w, shallowRef as V, watch as re, nextTick as ce, openBlock as o, createElementBlock as n, createElementVNode as r, Fragment as k, renderList as q, normalizeClass as N, createTextVNode as v, toDisplayString as i, unref as l, createCommentVNode as h, createVNode as b, withDirectives as x, vModelSelect as D, renderSlot as de, createBlock as me, mergeModels as A } from "vue";
import { useInvadeUi as ve, useFormat as pe, useNames as he } from "../context.js";
import { dayKey as fe } from "../logic/format.js";
import { QUEUE_FILTERS as F, QUEUE_SHORT as ge, positionName as P, count as ye } from "../logic/labels.js";
import $ from "./Icon.vue.js";
import ke from "./MatchRow.vue.js";
/* empty css              */
import be from "./MatchRowSkeleton.vue.js";
/* empty css                      */
import Ie from "./RoleIcon.vue.js";
/* empty css                 */
/* empty css                       */
/* empty css                    */
const we = {
  key: 0,
  class: "iv-pf-bar"
}, Me = { class: "iv-seg" }, _e = ["onClick"], Ce = { key: 0 }, qe = {
  key: 0,
  class: "iv-seg iv-pf-roleseg"
}, $e = ["title", "aria-label", "aria-pressed", "onClick"], Le = ["aria-label"], Se = { value: 0 }, Te = ["value"], Ne = ["aria-label"], Ee = { value: "recent" }, Ue = { value: "champion" }, Be = {
  key: 1,
  class: "iv-pf-sum"
}, ze = { class: "iv-pf-sum-figs" }, Oe = ["title"], Re = ["title"], Ve = ["title"], xe = {
  key: 2,
  class: "iv-pf-feed-skel"
}, De = {
  key: 3,
  class: "iv-pf-state"
}, Ae = { key: 0 }, Fe = { class: "iv-error" }, Pe = {
  key: 4,
  class: "iv-pf-state"
}, Ke = { key: 0 }, Qe = { key: 1 }, We = {
  key: 5,
  class: "iv-pf-state"
}, Ge = { class: "iv-pf-state-actions" }, He = ["disabled"], Je = { class: "iv-mr-day" }, je = { class: "iv-mr-list" }, Xe = ["data-game"], Ye = ["disabled"], mt = /* @__PURE__ */ ie({
  __name: "MatchList",
  props: /* @__PURE__ */ A({
    puuid: {},
    games: {},
    scores: {},
    lp: { default: () => /* @__PURE__ */ new Map() },
    status: {},
    error: { default: "" },
    private: { type: Boolean, default: !1 },
    more: { type: Boolean, default: !1 },
    loadingMore: { type: Boolean, default: !1 },
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
  emits: /* @__PURE__ */ A(["more", "retry"], ["update:queue", "update:champion", "update:role", "update:order"]),
  setup(c, { emit: K }) {
    const f = c, E = K, Q = ue(), { t: a } = ve(), { dayLabel: W, kdaRatio: G, num: H, pct: J, score100: j, signedLp: X } = pe(), { champName: I } = he(), M = T(c, "queue"), y = T(c, "champion"), g = T(c, "role"), _ = T(c, "order"), Y = (t) => F.find((s) => s.id === t)?.queues, B = (t, s) => {
      const e = Y(s);
      return !e || e.includes(t.queueId);
    }, Z = w(
      () => F.map((t) => ({ id: t.id, label: ge[t.id] ?? t.label, n: f.games.filter((s) => B(s, t.id)).length })).filter(
        (t) => t.id === "all" || t.n > 0 || t.id === M.value
      )
    ), ee = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"], z = w(() => ee.filter((t) => t === g.value || f.games.some((s) => s.lane === t))), te = w(() => {
      const t = /* @__PURE__ */ new Map();
      for (const s of f.games) t.set(s.championId, (t.get(s.championId) ?? 0) + 1);
      return y.value && !t.has(y.value) && t.set(y.value, 0), [...t].sort((s, e) => I(s[0]).localeCompare(I(e[0]))).map(([s, e]) => ({ id: s, n: e }));
    }), se = w(() => M.value !== "all" || !!y.value || !!g.value);
    function U() {
      M.value = "all", y.value = 0, g.value = "";
    }
    const L = w(() => {
      const t = f.games.filter(
        (s) => B(s, M.value) && (!y.value || s.championId === y.value) && (!g.value || s.lane === g.value)
      );
      return _.value === "champion" ? [...t].sort((s, e) => I(s.championId).localeCompare(I(e.championId)) || e.creation - s.creation) : [...t].sort((s, e) => e.creation - s.creation);
    }), p = w(() => {
      const t = L.value.filter((u) => !u.remake), s = t.filter((u) => u.win).length, e = (u) => t.reduce((S, ne) => S + u(ne), 0), d = e((u) => u.duration) / 60, m = t.map((u) => f.scores.get(u.gameId)?.score).filter((u) => u != null);
      return {
        games: t.length,
        wins: s,
        losses: t.length - s,
        kda: G(e((u) => u.kills), e((u) => u.deaths), e((u) => u.assists)),
        csMin: d ? e((u) => u.cs) / d : 0,
        score: m.length ? j(m.reduce((u, S) => u + S, 0) / m.length) : null,
        /** Oldest to newest, the latest 20. */
        form: [...L.value.slice(0, 20)].sort((u, S) => u.creation - S.creation)
      };
    }), le = w(() => {
      const t = [], s = /* @__PURE__ */ new Map();
      for (const e of L.value) {
        const d = _.value === "champion" ? String(e.championId) : fe(e.creation);
        let m = s.get(d);
        if (!m) {
          const u = _.value === "champion" ? I(e.championId) : W(e.creation);
          m = { key: d, label: u, games: [], wins: 0, losses: 0, lp: null }, s.set(d, m), t.push(m);
        }
        m.games.push(e), e.remake || (e.win ? m.wins++ : m.losses++);
      }
      for (const e of t) {
        const d = e.games.filter((m) => !m.remake && (m.queueId === 420 || m.queueId === 440));
        d.length && d.every((m) => f.lp.has(m.gameId)) && (e.lp = d.reduce((m, u) => m + f.lp.get(u.gameId), 0));
      }
      return t;
    }), C = V(null), ae = (t) => Q.detail && (C.value = C.value === t ? null : t), O = V(null);
    let R = null;
    re(
      () => [f.focus, f.games],
      async ([t]) => {
        if (!t || t === R) return;
        const s = f.games.find((e) => e.gameId === t);
        s && (R = t, L.value.includes(s) || U(), _.value = "recent", C.value = t, await ce(), O.value?.querySelector(`[data-game="${t}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" }));
      },
      { immediate: !0 }
    );
    const oe = (t) => `${I(t.championId)} · ${t.remake ? a("Remake") : t.win ? a("Win") : a("Loss")} · ${t.kills}/${t.deaths}/${t.assists}`;
    return (t, s) => (o(), n("section", {
      ref_key: "root",
      ref: O,
      class: "iv-pf-feed"
    }, [
      c.games.length ? (o(), n("div", we, [
        r("div", Me, [
          (o(!0), n(k, null, q(Z.value, (e) => (o(), n("button", {
            key: e.id,
            type: "button",
            class: N({ on: M.value === e.id }),
            onClick: (d) => M.value = e.id
          }, [
            v(i(l(a)(e.label)), 1),
            e.id !== "all" ? (o(), n("small", Ce, i(e.n), 1)) : h("", !0)
          ], 10, _e))), 128))
        ]),
        z.value.length > 1 || g.value ? (o(), n("div", qe, [
          (o(!0), n(k, null, q(z.value, (e) => (o(), n("button", {
            key: e,
            type: "button",
            class: N({ on: g.value === e }),
            title: l(P)(e, l(a)),
            "aria-label": l(P)(e, l(a)),
            "aria-pressed": g.value === e,
            onClick: (d) => g.value = g.value === e ? "" : e
          }, [
            b(Ie, { lane: e }, null, 8, ["lane"])
          ], 10, $e))), 128))
        ])) : h("", !0),
        x(r("select", {
          "onUpdate:modelValue": s[0] || (s[0] = (e) => y.value = e),
          class: "iv-select iv-pf-select",
          "aria-label": l(a)("Filter games by champion")
        }, [
          r("option", Se, i(l(a)("All champions")), 1),
          (o(!0), n(k, null, q(te.value, (e) => (o(), n("option", {
            key: e.id,
            value: e.id
          }, i(l(I)(e.id)) + " (" + i(e.n) + ")", 9, Te))), 128))
        ], 8, Le), [
          [
            D,
            y.value,
            void 0,
            { number: !0 }
          ]
        ]),
        x(r("select", {
          "onUpdate:modelValue": s[1] || (s[1] = (e) => _.value = e),
          class: "iv-select iv-pf-select iv-pf-order",
          "aria-label": l(a)("Sort games")
        }, [
          r("option", Ee, i(l(a)("By date")), 1),
          r("option", Ue, i(l(a)("By champion")), 1)
        ], 8, Ne), [
          [D, _.value]
        ])
      ])) : h("", !0),
      c.status === "ready" && p.value.games ? (o(), n("div", Be, [
        r("span", ze, [
          r("span", null, [
            r("b", null, i(l(ye)(p.value.games, "games", l(a))), 1)
          ]),
          r("span", null, [
            r("b", null, i(l(a)("{w}W {l}L", { w: p.value.wins, l: p.value.losses })), 1),
            v(" " + i(l(J)(p.value.wins / p.value.games)), 1)
          ]),
          r("span", null, [
            r("b", null, i(p.value.kda), 1),
            v(" " + i(l(a)("KDA")), 1)
          ]),
          r("span", null, [
            r("b", null, i(l(H)(p.value.csMin, 1)), 1),
            v(" " + i(l(a)("CS/min")), 1)
          ]),
          p.value.score !== null ? (o(), n("span", {
            key: 0,
            title: l(a)("Average Invade score")
          }, [
            r("b", null, i(p.value.score), 1),
            v(" " + i(l(a)("avg score")), 1)
          ], 8, Oe)) : h("", !0)
        ]),
        r("span", {
          class: "iv-form iv-pf-form",
          title: l(a)("Oldest to newest")
        }, [
          (o(!0), n(k, null, q(p.value.form, (e) => (o(), n("i", {
            key: e.gameId,
            class: N(e.remake ? "r" : e.win ? "w" : "l"),
            title: oe(e)
          }, null, 10, Ve))), 128))
        ], 8, Re),
        se.value ? (o(), n("button", {
          key: 0,
          type: "button",
          class: "iv-btn ghost sm iv-pf-clear",
          onClick: U
        }, [
          b($, {
            name: "x",
            size: 13
          }),
          v(i(l(a)("Clear filters")), 1)
        ])) : h("", !0)
      ])) : h("", !0),
      c.status === "loading" ? (o(), n("div", xe, [
        s[5] || (s[5] = r("span", { class: "iv-skel iv-pf-skel-day" }, null, -1)),
        b(be, { count: 7 })
      ])) : c.status === "error" ? (o(), n("div", De, [
        c.private ? (o(), n("p", Ae, [
          b($, {
            name: "eye",
            size: 15
          }),
          v(i(l(a)("This player's match history is private.")), 1)
        ])) : (o(), n(k, { key: 1 }, [
          r("p", Fe, [
            b($, {
              name: "x",
              size: 15
            }),
            v(i(c.error || l(a)("Something went wrong")), 1)
          ]),
          r("button", {
            type: "button",
            class: "iv-btn sm",
            onClick: s[2] || (s[2] = (e) => E("retry"))
          }, [
            b($, {
              name: "refresh",
              size: 13
            }),
            v(i(l(a)("Try again")), 1)
          ])
        ], 64))
      ])) : c.games.length ? L.value.length ? (o(), n(k, { key: 6 }, [
        (o(!0), n(k, null, q(le.value, (e) => (o(), n("section", {
          key: e.key,
          class: "iv-pf-day"
        }, [
          r("h3", Je, [
            v(i(e.label) + " ", 1),
            r("span", null, [
              v(i(l(a)("{w}W {l}L", { w: e.wins, l: e.losses })), 1),
              e.lp !== null ? (o(), n(k, { key: 0 }, [
                v(" · " + i(l(X)(e.lp)) + " " + i(l(a)("LP")), 1)
              ], 64)) : h("", !0)
            ])
          ]),
          r("ul", je, [
            (o(!0), n(k, null, q(e.games, (d) => (o(), n("li", {
              key: d.gameId,
              class: N(["iv-pf-match", { open: C.value === d.gameId }]),
              "data-game": d.gameId
            }, [
              b(ke, {
                game: d,
                score: c.scores.get(d.gameId) ?? null,
                lp: c.lp.get(d.gameId) ?? null,
                open: C.value === d.gameId,
                puuid: c.puuid,
                onToggle: (m) => ae(d.gameId)
              }, null, 8, ["game", "score", "lp", "open", "puuid", "onToggle"]),
              C.value === d.gameId ? de(t.$slots, "detail", { game: d }, void 0, void 0, 0) : h("", !0)
            ], 10, Xe))), 128))
          ])
        ]))), 128)),
        c.more ? (o(), n("button", {
          key: 0,
          type: "button",
          class: "iv-btn ghost iv-pf-loadmore",
          disabled: c.loadingMore,
          onClick: s[4] || (s[4] = (e) => E("more"))
        }, [
          c.loadingMore ? h("", !0) : (o(), me($, {
            key: 0,
            name: "down",
            size: 14
          })),
          v(i(c.loadingMore ? l(a)("Loading…") : l(a)("Load older games")), 1)
        ], 8, Ye)) : h("", !0)
      ], 64)) : (o(), n("div", We, [
        r("p", null, i(l(a)("No games match these filters in the {n} loaded.", { n: c.games.length })), 1),
        r("div", Ge, [
          r("button", {
            type: "button",
            class: "iv-btn sm",
            onClick: U
          }, i(l(a)("Clear filters")), 1),
          c.more ? (o(), n("button", {
            key: 0,
            type: "button",
            class: "iv-btn ghost sm",
            disabled: c.loadingMore,
            onClick: s[3] || (s[3] = (e) => E("more"))
          }, i(c.loadingMore ? l(a)("Loading…") : l(a)("Load older games")), 9, He)) : h("", !0)
        ])
      ])) : (o(), n("div", Pe, [
        c.private ? (o(), n("p", Ke, [
          b($, {
            name: "eye",
            size: 15
          }),
          v(i(l(a)("This player's match history is private.")), 1)
        ])) : (o(), n("p", Qe, i(l(a)("No games in this history yet.")), 1))
      ]))
    ], 512));
  }
});
export {
  mt as default
};
