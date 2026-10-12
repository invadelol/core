import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
import { defineComponent as W, computed as y, openBlock as o, createElementBlock as n, createVNode as z, createElementVNode as i, toDisplayString as v, unref as e, Fragment as m, renderList as p, normalizeClass as _, createTextVNode as T, createCommentVNode as L } from "vue";
import { useInvadeUi as G, useFormat as K, useNames as Q } from "../context.js";
import { hideBroken as c } from "../dom.js";
import { RUNE_SLOTS as B } from "../logic/detail.js";
import { tk as f } from "../logic/i18n.js";
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
}, te = ["src", "alt", "title"], se = {
  key: 0,
  class: "iv-bd-tree second"
}, oe = { class: "iv-bd-slot iv-bd-shards" }, ne = ["src", "alt", "title"], re = { class: "iv-bd-kit" }, ie = { class: "iv-label" }, ae = { class: "iv-bd-items" }, ce = ["src", "alt", "title"], ue = { class: "iv-label" }, de = { class: "iv-bd-spells" }, me = ["src"], ve = { class: "iv-bd-facts" }, pe = { class: "iv-label" }, Se = /* @__PURE__ */ W({
  __name: "BuildTab",
  props: {
    detail: {},
    selected: {},
    me: {}
  },
  emits: ["select"],
  setup(g, { emit: C }) {
    const N = g, D = C, { t: r } = G(), { compact: S, signedGold: E } = K(), { itemIcon: M, itemName: x, runeIcon: w, runeName: k, spellIcon: V, spellName: j, styleIcon: P, styleName: U } = Q(), u = y(() => N.detail.players[N.selected]), $ = y(() => new Set(u.value.perks)), I = y(() => {
      const [t, s] = u.value.styles;
      return [
        { id: t, rows: B[t] ?? null, fallback: u.value.perks.slice(0, 4) },
        { id: s, rows: B[s]?.slice(1) ?? null, fallback: u.value.perks.slice(4, 6) }
      ].filter((l) => l.id > 0);
    }), F = ["", "", f("Double kill"), f("Triple kill"), f("Quadra kill"), f("Penta kill")], O = y(() => {
      const t = u.value, s = [
        { label: r("Wards"), value: r("{placed} placed · {killed} destroyed · {control} control", { placed: t.wardsPlaced, killed: t.wardsKilled, control: t.controlWards }) }
      ];
      if (t.ccTime !== null && s.push({ label: r("Crowd control"), value: r("{n} s", { n: t.ccTime }) }), s.push({ label: r("Objective damage"), value: r("{n} · {towers} to towers", { n: S(t.objectiveDamage), towers: S(t.turretDamage) }) }), t.largestSpree !== null && s.push({ label: r("Largest killing spree"), value: String(t.largestSpree) }), t.largestMulti !== null && t.largestMulti > 1 && s.push({ label: r("Largest multikill"), value: r(F[Math.min(5, t.largestMulti)]) }), t.gold15 !== null || t.xp15 !== null || t.cs15 !== null) {
        const l = [
          t.gold15 !== null ? r("{n} gold", { n: E(t.gold15) }) : "",
          t.xp15 !== null ? r("{n} XP", { n: E(t.xp15) }) : "",
          t.cs15 !== null ? r("{n} CS", { n: `${t.cs15 > 0 ? "+" : ""}${t.cs15}` }) : ""
        ].filter(Boolean);
        s.push({ label: r("Lead at 15 min"), value: l.join(" · ") });
      }
      return s;
    });
    return (t, s) => (o(), n("div", q, [
      z(X, {
        detail: g.detail,
        selected: g.selected,
        me: g.me,
        onSelect: s[0] || (s[0] = (l) => D("select", l))
      }, null, 8, ["detail", "selected", "me"]),
      i("div", A, [
        I.value.length && u.value.perks[0] ? (o(), n("section", H, [
          i("h4", J, v(e(r)("Runes")), 1),
          (o(!0), n(m, null, p(I.value, (l, d) => (o(), n("div", {
            key: l.id,
            class: _(["iv-bd-tree", { second: d }])
          }, [
            i("p", Y, [
              i("img", {
                src: e(P)(l.id),
                alt: "",
                onError: s[1] || (s[1] = //@ts-ignore
                (...a) => e(c) && e(c)(...a))
              }, null, 40, Z),
              T(v(e(U)(l.id)), 1)
            ]),
            l.rows ? (o(!0), n(m, { key: 0 }, p(l.rows, (a, h) => (o(), n("div", {
              key: h,
              class: _(["iv-bd-slot", { keys: !d && !h }])
            }, [
              (o(!0), n(m, null, p(a, (b) => (o(), n("img", {
                key: b,
                src: e(w)(b),
                alt: e(k)(b),
                title: e(k)(b),
                class: _({ off: !$.value.has(b) }),
                onError: s[2] || (s[2] = //@ts-ignore
                (...R) => e(c) && e(c)(...R))
              }, null, 42, ee))), 128))
            ], 2))), 128)) : (o(), n("div", le, [
              (o(!0), n(m, null, p(l.fallback, (a) => (o(), n("img", {
                key: a,
                src: e(w)(a),
                alt: e(k)(a),
                title: e(k)(a),
                onError: s[3] || (s[3] = //@ts-ignore
                (...h) => e(c) && e(c)(...h))
              }, null, 40, te))), 128))
            ]))
          ], 2))), 128)),
          u.value.shards ? (o(), n("div", se, [
            i("div", oe, [
              (o(!0), n(m, null, p(u.value.shards, (l, d) => (o(), n("img", {
                key: d,
                src: e(w)(l),
                alt: e(k)(l),
                title: e(k)(l),
                onError: s[4] || (s[4] = //@ts-ignore
                (...a) => e(c) && e(c)(...a))
              }, null, 40, ne))), 128))
            ])
          ])) : L("", !0)
        ])) : L("", !0),
        i("section", re, [
          i("h4", ie, v(e(r)("Items")), 1),
          i("div", ae, [
            (o(!0), n(m, null, p(u.value.items, (l, d) => (o(), n(m, { key: d }, [
              l ? (o(), n("img", {
                key: 0,
                src: e(M)(l),
                alt: e(x)(l),
                title: e(x)(l),
                class: _({ trinket: d === 6 }),
                onError: s[5] || (s[5] = //@ts-ignore
                (...a) => e(c) && e(c)(...a))
              }, null, 42, ce)) : (o(), n("i", {
                key: 1,
                class: _({ trinket: d === 6 })
              }, null, 2))
            ], 64))), 128))
          ]),
          i("h4", ue, v(e(r)("Summoner spells")), 1),
          i("div", de, [
            (o(!0), n(m, null, p(u.value.spells, (l, d) => (o(), n("span", { key: d }, [
              i("img", {
                src: e(V)(l),
                alt: "",
                onError: s[6] || (s[6] = //@ts-ignore
                (...a) => e(c) && e(c)(...a))
              }, null, 40, me),
              T(v(e(j)(l)), 1)
            ]))), 128))
          ])
        ]),
        i("section", ve, [
          i("h4", pe, v(e(r)("Details")), 1),
          i("dl", null, [
            (o(!0), n(m, null, p(O.value, (l) => (o(), n("div", {
              key: l.label
            }, [
              i("dt", null, v(l.label), 1),
              i("dd", null, v(l.value), 1)
            ]))), 128))
          ])
        ])
      ])
    ]));
  }
});
export {
  Se as default
};
