import { defineComponent as O, computed as y, openBlock as n, createElementBlock as o, createVNode as R, createElementVNode as a, toDisplayString as m, unref as l, Fragment as v, renderList as p, normalizeClass as b, createTextVNode as I, createCommentVNode as W } from "vue";
import { useInvadeUi as z, useFormat as G, useNames as K } from "../context.js";
import { hideBroken as c } from "../dom.js";
import { RUNE_SLOTS as T } from "../logic/detail.js";
import { tk as h } from "../logic/i18n.js";
import Q from "./PlayerPicker.vue.js";
const X = { class: "iv-bd" }, q = { class: "iv-bd-grid" }, A = {
  key: 0,
  class: "iv-bd-runes"
}, H = { class: "iv-label" }, J = { class: "iv-bd-tree-name" }, Y = ["src"], Z = ["src", "alt", "title"], ee = {
  key: 1,
  class: "iv-bd-slot"
}, le = ["src", "alt", "title"], se = { class: "iv-bd-kit" }, te = { class: "iv-label" }, ne = { class: "iv-bd-items" }, oe = ["src"], re = { class: "iv-label" }, ae = { class: "iv-bd-spells" }, ie = ["src"], ce = { class: "iv-bd-facts" }, ue = { class: "iv-label" }, _e = /* @__PURE__ */ O({
  __name: "BuildTab",
  props: {
    detail: {},
    selected: {},
    me: {}
  },
  emits: ["select"],
  setup(_, { emit: L }) {
    const w = _, B = L, { t: r } = z(), { compact: S, signedGold: N } = G(), { itemIcon: C, runeIcon: E, runeName: g, spellIcon: D, spellName: M, styleIcon: V, styleName: j } = K(), u = y(() => w.detail.players[w.selected]), P = y(() => new Set(u.value.perks)), x = y(() => {
      const [e, s] = u.value.styles;
      return [
        { id: e, rows: T[e] ?? null, fallback: u.value.perks.slice(0, 4) },
        { id: s, rows: T[s]?.slice(1) ?? null, fallback: u.value.perks.slice(4, 6) }
      ].filter((t) => t.id > 0);
    }), U = ["", "", h("Double kill"), h("Triple kill"), h("Quadra kill"), h("Penta kill")], $ = y(() => {
      const e = u.value, s = [
        { label: r("Wards"), value: r("{placed} placed · {killed} destroyed · {control} control", { placed: e.wardsPlaced, killed: e.wardsKilled, control: e.controlWards }) }
      ];
      if (e.ccTime !== null && s.push({ label: r("Crowd control"), value: r("{n} s", { n: e.ccTime }) }), s.push({ label: r("Objective damage"), value: r("{n} · {towers} to towers", { n: S(e.objectiveDamage), towers: S(e.turretDamage) }) }), e.largestSpree !== null && s.push({ label: r("Largest killing spree"), value: String(e.largestSpree) }), e.largestMulti !== null && e.largestMulti > 1 && s.push({ label: r("Largest multikill"), value: r(U[Math.min(5, e.largestMulti)]) }), e.gold15 !== null || e.xp15 !== null || e.cs15 !== null) {
        const t = [
          e.gold15 !== null ? r("{n} gold", { n: N(e.gold15) }) : "",
          e.xp15 !== null ? r("{n} XP", { n: N(e.xp15) }) : "",
          e.cs15 !== null ? r("{n} CS", { n: `${e.cs15 > 0 ? "+" : ""}${e.cs15}` }) : ""
        ].filter(Boolean);
        s.push({ label: r("Lead at 15 min"), value: t.join(" · ") });
      }
      return s;
    });
    return (e, s) => (n(), o("div", X, [
      R(Q, {
        detail: _.detail,
        selected: _.selected,
        me: _.me,
        onSelect: s[0] || (s[0] = (t) => B("select", t))
      }, null, 8, ["detail", "selected", "me"]),
      a("div", q, [
        x.value.length && u.value.perks[0] ? (n(), o("section", A, [
          a("h4", H, m(l(r)("Runes")), 1),
          (n(!0), o(v, null, p(x.value, (t, d) => (n(), o("div", {
            key: t.id,
            class: b(["iv-bd-tree", { second: d }])
          }, [
            a("p", J, [
              a("img", {
                src: l(V)(t.id),
                alt: "",
                onError: s[1] || (s[1] = //@ts-ignore
                (...i) => l(c) && l(c)(...i))
              }, null, 40, Y),
              I(m(l(j)(t.id)), 1)
            ]),
            t.rows ? (n(!0), o(v, { key: 0 }, p(t.rows, (i, f) => (n(), o("div", {
              key: f,
              class: b(["iv-bd-slot", { keys: !d && !f }])
            }, [
              (n(!0), o(v, null, p(i, (k) => (n(), o("img", {
                key: k,
                src: l(E)(k),
                alt: l(g)(k),
                title: l(g)(k),
                class: b({ off: !P.value.has(k) }),
                onError: s[2] || (s[2] = //@ts-ignore
                (...F) => l(c) && l(c)(...F))
              }, null, 42, Z))), 128))
            ], 2))), 128)) : (n(), o("div", ee, [
              (n(!0), o(v, null, p(t.fallback, (i) => (n(), o("img", {
                key: i,
                src: l(E)(i),
                alt: l(g)(i),
                title: l(g)(i),
                onError: s[3] || (s[3] = //@ts-ignore
                (...f) => l(c) && l(c)(...f))
              }, null, 40, le))), 128))
            ]))
          ], 2))), 128))
        ])) : W("", !0),
        a("section", se, [
          a("h4", te, m(l(r)("Items")), 1),
          a("div", ne, [
            (n(!0), o(v, null, p(u.value.items, (t, d) => (n(), o(v, { key: d }, [
              t ? (n(), o("img", {
                key: 0,
                src: l(C)(t),
                alt: "",
                class: b({ trinket: d === 6 }),
                onError: s[4] || (s[4] = //@ts-ignore
                (...i) => l(c) && l(c)(...i))
              }, null, 42, oe)) : (n(), o("i", {
                key: 1,
                class: b({ trinket: d === 6 })
              }, null, 2))
            ], 64))), 128))
          ]),
          a("h4", re, m(l(r)("Summoner spells")), 1),
          a("div", ae, [
            (n(!0), o(v, null, p(u.value.spells, (t, d) => (n(), o("span", { key: d }, [
              a("img", {
                src: l(D)(t),
                alt: "",
                onError: s[5] || (s[5] = //@ts-ignore
                (...i) => l(c) && l(c)(...i))
              }, null, 40, ie),
              I(m(l(M)(t)), 1)
            ]))), 128))
          ])
        ]),
        a("section", ce, [
          a("h4", ue, m(l(r)("Details")), 1),
          a("dl", null, [
            (n(!0), o(v, null, p($.value, (t) => (n(), o("div", {
              key: t.label
            }, [
              a("dt", null, m(t.label), 1),
              a("dd", null, m(t.value), 1)
            ]))), 128))
          ])
        ])
      ])
    ]));
  }
});
export {
  _e as default
};
