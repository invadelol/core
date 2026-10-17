import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
import { defineComponent as Q, computed as B, ref as X, watch as A, openBlock as l, createElementBlock as s, createVNode as H, createElementVNode as r, toDisplayString as u, unref as t, Fragment as k, renderList as b, normalizeClass as h, createCommentVNode as _, createTextVNode as f } from "vue";
import { useInvadeUi as J, useFormat as Y, useNames as Z } from "../context.js";
import { hideBroken as c } from "../dom.js";
import { RUNE_SLOTS as j } from "../logic/detail.js";
import { shopVisits as x } from "../logic/shop.js";
import { tk as E } from "../logic/i18n.js";
import ee from "./PlayerPicker.vue.js";
/* empty css                 */
/* empty css                       */
/* empty css                   */
const te = { class: "iv-bd" }, le = {
  key: 0,
  class: "iv-bd-path"
}, se = { class: "iv-label" }, oe = { class: "iv-bd-visit" }, ne = ["aria-label", "onClick", "onMouseenter", "onMouseleave", "onBlur"], ae = ["src"], re = {
  key: 0,
  class: "iv-bd-count tabular"
}, ie = {
  key: 1,
  class: "iv-bd-tip",
  role: "tooltip"
}, ue = { class: "tabular" }, ce = {
  key: 0,
  class: "iv-bd-sold"
}, de = ["aria-label", "onClick", "onMouseenter", "onMouseleave", "onBlur"], ve = ["src"], me = {
  key: 0,
  class: "iv-bd-count tabular"
}, pe = {
  key: 1,
  class: "iv-bd-tip",
  role: "tooltip"
}, ke = { class: "tabular" }, be = { class: "tabular" }, _e = { class: "iv-bd-grid" }, ye = {
  key: 0,
  class: "iv-bd-runes"
}, he = { class: "iv-label" }, ge = { class: "iv-bd-tree-name" }, fe = ["src"], $e = ["src", "alt", "title"], Se = {
  key: 1,
  class: "iv-bd-slot"
}, Be = ["src", "alt", "title"], we = {
  key: 0,
  class: "iv-bd-tree second"
}, Me = { class: "iv-bd-slot iv-bd-shards" }, Ee = ["src", "alt", "title"], Ie = { class: "iv-bd-kit" }, Ne = { class: "iv-label" }, Ce = { class: "iv-bd-items" }, Te = ["src", "alt", "title"], Le = ["src", "alt", "title"], De = { class: "iv-label" }, Ve = { class: "iv-bd-spells" }, je = ["src"], Pe = { class: "iv-bd-facts" }, Re = { class: "iv-label" }, Ae = /* @__PURE__ */ Q({
  __name: "BuildTab",
  props: {
    detail: {},
    selected: {},
    me: {}
  },
  emits: ["select"],
  setup(w, { emit: P }) {
    const I = w, R = P, { t: i } = J(), { compact: C, signedGold: T, mmss: $ } = Y(), { itemIcon: M, itemName: y, runeIcon: N, runeName: g, spellIcon: U, spellName: F, styleIcon: O, styleName: W } = Z(), v = B(() => I.detail.players[I.selected]), L = B(
      () => (v.value.purchases?.length ? x(v.value.purchases) : []).map((n, a) => ({
        ...n,
        items: n.items.map((o, p) => ({ ...o, key: `${a}:${p}` }))
      }))
    ), d = X("");
    A(() => I.selected, () => d.value = "");
    const D = (n) => d.value = d.value === n ? "" : n, q = B(() => new Set(v.value.perks)), V = B(() => {
      const [n, a] = v.value.styles;
      return [
        { id: n, rows: j[n] ?? null, fallback: v.value.perks.slice(0, 4) },
        { id: a, rows: j[a]?.slice(1) ?? null, fallback: v.value.perks.slice(4, 6) }
      ].filter((o) => o.id > 0);
    }), z = ["", "", E("Double kill"), E("Triple kill"), E("Quadra kill"), E("Penta kill")], G = B(() => {
      const n = v.value, a = [
        { label: i("Wards"), value: i("{placed} placed · {killed} destroyed · {control} control", { placed: n.wardsPlaced, killed: n.wardsKilled, control: n.controlWards }) }
      ];
      if (n.ccTime !== null && a.push({ label: i("Crowd control"), value: i("{n} s", { n: n.ccTime }) }), a.push({ label: i("Objective damage"), value: i("{n} · {towers} to towers", { n: C(n.objectiveDamage), towers: C(n.turretDamage) }) }), n.largestSpree !== null && a.push({ label: i("Largest killing spree"), value: String(n.largestSpree) }), n.largestMulti !== null && n.largestMulti > 1 && a.push({ label: i("Largest multikill"), value: i(z[Math.min(5, n.largestMulti)]) }), n.gold15 !== null || n.xp15 !== null || n.cs15 !== null) {
        const o = [
          n.gold15 !== null ? i("{n} gold", { n: T(n.gold15) }) : "",
          n.xp15 !== null ? i("{n} XP", { n: T(n.xp15) }) : "",
          n.cs15 !== null ? i("{n} CS", { n: `${n.cs15 > 0 ? "+" : ""}${n.cs15}` }) : ""
        ].filter(Boolean);
        a.push({ label: i("Lead at 15 min"), value: o.join(" · ") });
      }
      return a;
    });
    return (n, a) => (l(), s("div", te, [
      H(ee, {
        detail: w.detail,
        selected: w.selected,
        me: w.me,
        onSelect: a[0] || (a[0] = (o) => R("select", o))
      }, null, 8, ["detail", "selected", "me"]),
      L.value.length ? (l(), s("section", le, [
        r("h4", se, u(t(i)("Build path")), 1),
        r("ol", null, [
          (l(!0), s(k, null, b(L.value, (o, p) => (l(), s("li", { key: p }, [
            r("div", oe, [
              (l(!0), s(k, null, b(o.items.filter((e) => !e.sold), (e) => (l(), s("button", {
                key: e.key,
                type: "button",
                class: h(["iv-bd-buy", { sold: e.sold, open: d.value === e.key }]),
                "aria-label": `${t(y)(e.item)}, ${t(i)(e.sold ? "Sold at {t}" : "Bought at {t}", { t: t($)(e.t) })}`,
                onClick: (m) => D(e.key),
                onMouseenter: (m) => d.value = e.key,
                onMouseleave: (m) => d.value === e.key && (d.value = ""),
                onBlur: (m) => d.value === e.key && (d.value = "")
              }, [
                r("img", {
                  src: t(M)(e.item),
                  alt: "",
                  onError: a[1] || (a[1] = //@ts-ignore
                  (...m) => t(c) && t(c)(...m))
                }, null, 40, ae),
                e.count > 1 ? (l(), s("span", re, u(e.count), 1)) : _("", !0),
                d.value === e.key ? (l(), s("span", ie, [
                  r("strong", null, u(t(y)(e.item)), 1),
                  r("span", ue, [
                    f(u(t(i)(e.sold ? "Sold at {t}" : "Bought at {t}", { t: t($)(e.t) })), 1),
                    e.count > 1 ? (l(), s(k, { key: 0 }, [
                      f(" · ×" + u(e.count), 1)
                    ], 64)) : _("", !0)
                  ])
                ])) : _("", !0)
              ], 42, ne))), 128)),
              o.items.some((e) => e.sold) ? (l(), s("div", ce, [
                r("span", null, u(t(i)("Sold")), 1),
                (l(!0), s(k, null, b(o.items.filter((e) => e.sold), (e) => (l(), s("button", {
                  key: e.key,
                  type: "button",
                  class: h(["iv-bd-buy", { sold: e.sold, open: d.value === e.key }]),
                  "aria-label": `${t(y)(e.item)}, ${t(i)(e.sold ? "Sold at {t}" : "Bought at {t}", { t: t($)(e.t) })}`,
                  onClick: (m) => D(e.key),
                  onMouseenter: (m) => d.value = e.key,
                  onMouseleave: (m) => d.value === e.key && (d.value = ""),
                  onBlur: (m) => d.value === e.key && (d.value = "")
                }, [
                  r("img", {
                    src: t(M)(e.item),
                    alt: "",
                    onError: a[2] || (a[2] = //@ts-ignore
                    (...m) => t(c) && t(c)(...m))
                  }, null, 40, ve),
                  e.count > 1 ? (l(), s("span", me, u(e.count), 1)) : _("", !0),
                  d.value === e.key ? (l(), s("span", pe, [
                    r("strong", null, u(t(y)(e.item)), 1),
                    r("span", ke, [
                      f(u(t(i)(e.sold ? "Sold at {t}" : "Bought at {t}", { t: t($)(e.t) })), 1),
                      e.count > 1 ? (l(), s(k, { key: 0 }, [
                        f(" · ×" + u(e.count), 1)
                      ], 64)) : _("", !0)
                    ])
                  ])) : _("", !0)
                ], 42, de))), 128))
              ])) : _("", !0)
            ]),
            r("time", be, u(t($)(o.t)), 1)
          ]))), 128))
        ])
      ])) : _("", !0),
      r("div", _e, [
        V.value.length && v.value.perks[0] ? (l(), s("section", ye, [
          r("h4", he, u(t(i)("Runes")), 1),
          (l(!0), s(k, null, b(V.value, (o, p) => (l(), s("div", {
            key: o.id,
            class: h(["iv-bd-tree", { second: p }])
          }, [
            r("p", ge, [
              r("img", {
                src: t(O)(o.id),
                alt: "",
                onError: a[3] || (a[3] = //@ts-ignore
                (...e) => t(c) && t(c)(...e))
              }, null, 40, fe),
              f(u(t(W)(o.id)), 1)
            ]),
            o.rows ? (l(!0), s(k, { key: 0 }, b(o.rows, (e, m) => (l(), s("div", {
              key: m,
              class: h(["iv-bd-slot", { keys: !p && !m }])
            }, [
              (l(!0), s(k, null, b(e, (S) => (l(), s("img", {
                key: S,
                src: t(N)(S),
                alt: t(g)(S),
                title: t(g)(S),
                class: h({ off: !q.value.has(S) }),
                onError: a[4] || (a[4] = //@ts-ignore
                (...K) => t(c) && t(c)(...K))
              }, null, 42, $e))), 128))
            ], 2))), 128)) : (l(), s("div", Se, [
              (l(!0), s(k, null, b(o.fallback, (e) => (l(), s("img", {
                key: e,
                src: t(N)(e),
                alt: t(g)(e),
                title: t(g)(e),
                onError: a[5] || (a[5] = //@ts-ignore
                (...m) => t(c) && t(c)(...m))
              }, null, 40, Be))), 128))
            ]))
          ], 2))), 128)),
          v.value.shards ? (l(), s("div", we, [
            r("div", Me, [
              (l(!0), s(k, null, b(v.value.shards, (o, p) => (l(), s("img", {
                key: p,
                src: t(N)(o),
                alt: t(g)(o),
                title: t(g)(o),
                onError: a[6] || (a[6] = //@ts-ignore
                (...e) => t(c) && t(c)(...e))
              }, null, 40, Ee))), 128))
            ])
          ])) : _("", !0)
        ])) : _("", !0),
        r("section", Ie, [
          r("h4", Ne, u(t(i)("Items")), 1),
          r("div", Ce, [
            (l(!0), s(k, null, b(v.value.items, (o, p) => (l(), s(k, { key: p }, [
              p === 6 && v.value.roleItem ? (l(), s("img", {
                key: 0,
                class: "role",
                src: t(M)(v.value.roleItem),
                alt: t(y)(v.value.roleItem),
                title: `${t(y)(v.value.roleItem)} · ${t(i)("Role quest reward")}`,
                onError: a[7] || (a[7] = //@ts-ignore
                (...e) => t(c) && t(c)(...e))
              }, null, 40, Te)) : _("", !0),
              o ? (l(), s("img", {
                key: 1,
                src: t(M)(o),
                alt: t(y)(o),
                title: t(y)(o),
                class: h({ trinket: p === 6 }),
                onError: a[8] || (a[8] = //@ts-ignore
                (...e) => t(c) && t(c)(...e))
              }, null, 42, Le)) : (l(), s("i", {
                key: 2,
                class: h({ trinket: p === 6 })
              }, null, 2))
            ], 64))), 128))
          ]),
          r("h4", De, u(t(i)("Summoner spells")), 1),
          r("div", Ve, [
            (l(!0), s(k, null, b(v.value.spells, (o, p) => (l(), s("span", { key: p }, [
              r("img", {
                src: t(U)(o),
                alt: "",
                onError: a[9] || (a[9] = //@ts-ignore
                (...e) => t(c) && t(c)(...e))
              }, null, 40, je),
              f(u(t(F)(o)), 1)
            ]))), 128))
          ])
        ]),
        r("section", Pe, [
          r("h4", Re, u(t(i)("Details")), 1),
          r("dl", null, [
            (l(!0), s(k, null, b(G.value, (o) => (l(), s("div", {
              key: o.label
            }, [
              r("dt", null, u(o.label), 1),
              r("dd", null, u(o.value), 1)
            ]))), 128))
          ])
        ])
      ])
    ]));
  }
});
export {
  Ae as default
};
