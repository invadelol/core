import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
import { defineComponent as O, computed as y, openBlock as n, createElementBlock as o, createVNode as R, createElementVNode as i, toDisplayString as m, unref as l, Fragment as v, renderList as p, normalizeClass as b, createTextVNode as I, createCommentVNode as W } from "vue";
import { useInvadeUi as z, useFormat as G, useNames as K } from "../context.js";
import { hideBroken as c } from "../dom.js";
import { RUNE_SLOTS as T } from "../logic/detail.js";
import { tk as h } from "../logic/i18n.js";
import Q from "./PlayerPicker.vue.js";
/* empty css                 */
/* empty css                       */
/* empty css                   */
const X = { class: "iv-bd" }, q = { class: "iv-bd-grid" }, A = {
  key: 0,
  class: "iv-bd-runes"
}, H = { class: "iv-label" }, J = { class: "iv-bd-tree-name" }, Y = ["src"], Z = ["src", "alt", "title"], ee = {
  key: 1,
  class: "iv-bd-slot"
}, le = ["src", "alt", "title"], te = { class: "iv-bd-kit" }, se = { class: "iv-label" }, ne = { class: "iv-bd-items" }, oe = ["src"], re = { class: "iv-label" }, ie = { class: "iv-bd-spells" }, ae = ["src"], ce = { class: "iv-bd-facts" }, ue = { class: "iv-label" }, ye = /* @__PURE__ */ O({
  __name: "BuildTab",
  props: {
    detail: {},
    selected: {},
    me: {}
  },
  emits: ["select"],
  setup(_, { emit: L }) {
    const w = _, B = L, { t: r } = z(), { compact: S, signedGold: N } = G(), { itemIcon: C, runeIcon: E, runeName: g, spellIcon: D, spellName: M, styleIcon: V, styleName: j } = K(), u = y(() => w.detail.players[w.selected]), P = y(() => new Set(u.value.perks)), x = y(() => {
      const [e, t] = u.value.styles;
      return [
        { id: e, rows: T[e] ?? null, fallback: u.value.perks.slice(0, 4) },
        { id: t, rows: T[t]?.slice(1) ?? null, fallback: u.value.perks.slice(4, 6) }
      ].filter((s) => s.id > 0);
    }), U = ["", "", h("Double kill"), h("Triple kill"), h("Quadra kill"), h("Penta kill")], $ = y(() => {
      const e = u.value, t = [
        { label: r("Wards"), value: r("{placed} placed · {killed} destroyed · {control} control", { placed: e.wardsPlaced, killed: e.wardsKilled, control: e.controlWards }) }
      ];
      if (e.ccTime !== null && t.push({ label: r("Crowd control"), value: r("{n} s", { n: e.ccTime }) }), t.push({ label: r("Objective damage"), value: r("{n} · {towers} to towers", { n: S(e.objectiveDamage), towers: S(e.turretDamage) }) }), e.largestSpree !== null && t.push({ label: r("Largest killing spree"), value: String(e.largestSpree) }), e.largestMulti !== null && e.largestMulti > 1 && t.push({ label: r("Largest multikill"), value: r(U[Math.min(5, e.largestMulti)]) }), e.gold15 !== null || e.xp15 !== null || e.cs15 !== null) {
        const s = [
          e.gold15 !== null ? r("{n} gold", { n: N(e.gold15) }) : "",
          e.xp15 !== null ? r("{n} XP", { n: N(e.xp15) }) : "",
          e.cs15 !== null ? r("{n} CS", { n: `${e.cs15 > 0 ? "+" : ""}${e.cs15}` }) : ""
        ].filter(Boolean);
        t.push({ label: r("Lead at 15 min"), value: s.join(" · ") });
      }
      return t;
    });
    return (e, t) => (n(), o("div", X, [
      R(Q, {
        detail: _.detail,
        selected: _.selected,
        me: _.me,
        onSelect: t[0] || (t[0] = (s) => B("select", s))
      }, null, 8, ["detail", "selected", "me"]),
      i("div", q, [
        x.value.length && u.value.perks[0] ? (n(), o("section", A, [
          i("h4", H, m(l(r)("Runes")), 1),
          (n(!0), o(v, null, p(x.value, (s, d) => (n(), o("div", {
            key: s.id,
            class: b(["iv-bd-tree", { second: d }])
          }, [
            i("p", J, [
              i("img", {
                src: l(V)(s.id),
                alt: "",
                onError: t[1] || (t[1] = //@ts-ignore
                (...a) => l(c) && l(c)(...a))
              }, null, 40, Y),
              I(m(l(j)(s.id)), 1)
            ]),
            s.rows ? (n(!0), o(v, { key: 0 }, p(s.rows, (a, f) => (n(), o("div", {
              key: f,
              class: b(["iv-bd-slot", { keys: !d && !f }])
            }, [
              (n(!0), o(v, null, p(a, (k) => (n(), o("img", {
                key: k,
                src: l(E)(k),
                alt: l(g)(k),
                title: l(g)(k),
                class: b({ off: !P.value.has(k) }),
                onError: t[2] || (t[2] = //@ts-ignore
                (...F) => l(c) && l(c)(...F))
              }, null, 42, Z))), 128))
            ], 2))), 128)) : (n(), o("div", ee, [
              (n(!0), o(v, null, p(s.fallback, (a) => (n(), o("img", {
                key: a,
                src: l(E)(a),
                alt: l(g)(a),
                title: l(g)(a),
                onError: t[3] || (t[3] = //@ts-ignore
                (...f) => l(c) && l(c)(...f))
              }, null, 40, le))), 128))
            ]))
          ], 2))), 128))
        ])) : W("", !0),
        i("section", te, [
          i("h4", se, m(l(r)("Items")), 1),
          i("div", ne, [
            (n(!0), o(v, null, p(u.value.items, (s, d) => (n(), o(v, { key: d }, [
              s ? (n(), o("img", {
                key: 0,
                src: l(C)(s),
                alt: "",
                class: b({ trinket: d === 6 }),
                onError: t[4] || (t[4] = //@ts-ignore
                (...a) => l(c) && l(c)(...a))
              }, null, 42, oe)) : (n(), o("i", {
                key: 1,
                class: b({ trinket: d === 6 })
              }, null, 2))
            ], 64))), 128))
          ]),
          i("h4", re, m(l(r)("Summoner spells")), 1),
          i("div", ie, [
            (n(!0), o(v, null, p(u.value.spells, (s, d) => (n(), o("span", { key: d }, [
              i("img", {
                src: l(D)(s),
                alt: "",
                onError: t[5] || (t[5] = //@ts-ignore
                (...a) => l(c) && l(c)(...a))
              }, null, 40, ae),
              I(m(l(M)(s)), 1)
            ]))), 128))
          ])
        ]),
        i("section", ce, [
          i("h4", ue, m(l(r)("Details")), 1),
          i("dl", null, [
            (n(!0), o(v, null, p($.value, (s) => (n(), o("div", {
              key: s.label
            }, [
              i("dt", null, m(s.label), 1),
              i("dd", null, m(s.value), 1)
            ]))), 128))
          ])
        ])
      ])
    ]));
  }
});
export {
  ye as default
};
