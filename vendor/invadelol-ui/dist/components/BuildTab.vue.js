import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
import { defineComponent as R, computed as y, openBlock as n, createElementBlock as o, createVNode as W, createElementVNode as i, toDisplayString as m, unref as e, Fragment as v, renderList as p, normalizeClass as b, createTextVNode as T, createCommentVNode as z } from "vue";
import { useInvadeUi as G, useFormat as K, useNames as Q } from "../context.js";
import { hideBroken as c } from "../dom.js";
import { RUNE_SLOTS as L } from "../logic/detail.js";
import { tk as h } from "../logic/i18n.js";
import X from "./PlayerPicker.vue.js";
/* empty css                 */
/* empty css                       */
/* empty css                   */
const q = { class: "iv-bd" }, A = { class: "iv-bd-grid" }, H = {
  key: 0,
  class: "iv-bd-runes"
}, J = { class: "iv-label" }, Y = { class: "iv-bd-tree-name" }, Z = ["src"], ee = ["src", "alt", "title"], le = {
  key: 1,
  class: "iv-bd-slot"
}, te = ["src", "alt", "title"], se = { class: "iv-bd-kit" }, ne = { class: "iv-label" }, oe = { class: "iv-bd-items" }, re = ["src", "alt", "title"], ie = { class: "iv-label" }, ae = { class: "iv-bd-spells" }, ce = ["src"], ue = { class: "iv-bd-facts" }, de = { class: "iv-label" }, he = /* @__PURE__ */ R({
  __name: "BuildTab",
  props: {
    detail: {},
    selected: {},
    me: {}
  },
  emits: ["select"],
  setup(_, { emit: B }) {
    const w = _, C = B, { t: r } = G(), { compact: N, signedGold: S } = K(), { itemIcon: D, itemName: E, runeIcon: x, runeName: g, spellIcon: M, spellName: V, styleIcon: j, styleName: P } = Q(), u = y(() => w.detail.players[w.selected]), U = y(() => new Set(u.value.perks)), I = y(() => {
      const [l, s] = u.value.styles;
      return [
        { id: l, rows: L[l] ?? null, fallback: u.value.perks.slice(0, 4) },
        { id: s, rows: L[s]?.slice(1) ?? null, fallback: u.value.perks.slice(4, 6) }
      ].filter((t) => t.id > 0);
    }), $ = ["", "", h("Double kill"), h("Triple kill"), h("Quadra kill"), h("Penta kill")], F = y(() => {
      const l = u.value, s = [
        { label: r("Wards"), value: r("{placed} placed · {killed} destroyed · {control} control", { placed: l.wardsPlaced, killed: l.wardsKilled, control: l.controlWards }) }
      ];
      if (l.ccTime !== null && s.push({ label: r("Crowd control"), value: r("{n} s", { n: l.ccTime }) }), s.push({ label: r("Objective damage"), value: r("{n} · {towers} to towers", { n: N(l.objectiveDamage), towers: N(l.turretDamage) }) }), l.largestSpree !== null && s.push({ label: r("Largest killing spree"), value: String(l.largestSpree) }), l.largestMulti !== null && l.largestMulti > 1 && s.push({ label: r("Largest multikill"), value: r($[Math.min(5, l.largestMulti)]) }), l.gold15 !== null || l.xp15 !== null || l.cs15 !== null) {
        const t = [
          l.gold15 !== null ? r("{n} gold", { n: S(l.gold15) }) : "",
          l.xp15 !== null ? r("{n} XP", { n: S(l.xp15) }) : "",
          l.cs15 !== null ? r("{n} CS", { n: `${l.cs15 > 0 ? "+" : ""}${l.cs15}` }) : ""
        ].filter(Boolean);
        s.push({ label: r("Lead at 15 min"), value: t.join(" · ") });
      }
      return s;
    });
    return (l, s) => (n(), o("div", q, [
      W(X, {
        detail: _.detail,
        selected: _.selected,
        me: _.me,
        onSelect: s[0] || (s[0] = (t) => C("select", t))
      }, null, 8, ["detail", "selected", "me"]),
      i("div", A, [
        I.value.length && u.value.perks[0] ? (n(), o("section", H, [
          i("h4", J, m(e(r)("Runes")), 1),
          (n(!0), o(v, null, p(I.value, (t, d) => (n(), o("div", {
            key: t.id,
            class: b(["iv-bd-tree", { second: d }])
          }, [
            i("p", Y, [
              i("img", {
                src: e(j)(t.id),
                alt: "",
                onError: s[1] || (s[1] = //@ts-ignore
                (...a) => e(c) && e(c)(...a))
              }, null, 40, Z),
              T(m(e(P)(t.id)), 1)
            ]),
            t.rows ? (n(!0), o(v, { key: 0 }, p(t.rows, (a, f) => (n(), o("div", {
              key: f,
              class: b(["iv-bd-slot", { keys: !d && !f }])
            }, [
              (n(!0), o(v, null, p(a, (k) => (n(), o("img", {
                key: k,
                src: e(x)(k),
                alt: e(g)(k),
                title: e(g)(k),
                class: b({ off: !U.value.has(k) }),
                onError: s[2] || (s[2] = //@ts-ignore
                (...O) => e(c) && e(c)(...O))
              }, null, 42, ee))), 128))
            ], 2))), 128)) : (n(), o("div", le, [
              (n(!0), o(v, null, p(t.fallback, (a) => (n(), o("img", {
                key: a,
                src: e(x)(a),
                alt: e(g)(a),
                title: e(g)(a),
                onError: s[3] || (s[3] = //@ts-ignore
                (...f) => e(c) && e(c)(...f))
              }, null, 40, te))), 128))
            ]))
          ], 2))), 128))
        ])) : z("", !0),
        i("section", se, [
          i("h4", ne, m(e(r)("Items")), 1),
          i("div", oe, [
            (n(!0), o(v, null, p(u.value.items, (t, d) => (n(), o(v, { key: d }, [
              t ? (n(), o("img", {
                key: 0,
                src: e(D)(t),
                alt: e(E)(t),
                title: e(E)(t),
                class: b({ trinket: d === 6 }),
                onError: s[4] || (s[4] = //@ts-ignore
                (...a) => e(c) && e(c)(...a))
              }, null, 42, re)) : (n(), o("i", {
                key: 1,
                class: b({ trinket: d === 6 })
              }, null, 2))
            ], 64))), 128))
          ]),
          i("h4", ie, m(e(r)("Summoner spells")), 1),
          i("div", ae, [
            (n(!0), o(v, null, p(u.value.spells, (t, d) => (n(), o("span", { key: d }, [
              i("img", {
                src: e(M)(t),
                alt: "",
                onError: s[5] || (s[5] = //@ts-ignore
                (...a) => e(c) && e(c)(...a))
              }, null, 40, ce),
              T(m(e(V)(t)), 1)
            ]))), 128))
          ])
        ]),
        i("section", ue, [
          i("h4", de, m(e(r)("Details")), 1),
          i("dl", null, [
            (n(!0), o(v, null, p(F.value, (t) => (n(), o("div", {
              key: t.label
            }, [
              i("dt", null, m(t.label), 1),
              i("dd", null, m(t.value), 1)
            ]))), 128))
          ])
        ])
      ])
    ]));
  }
});
export {
  he as default
};
