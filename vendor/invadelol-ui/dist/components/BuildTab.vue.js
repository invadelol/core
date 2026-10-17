import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
import { defineComponent as X, computed as B, ref as q, watch as A, openBlock as l, createElementBlock as s, createVNode as H, createElementVNode as r, toDisplayString as u, unref as t, Fragment as p, renderList as b, normalizeClass as y, createCommentVNode as _, createTextVNode as f } from "vue";
import { useInvadeUi as J, useFormat as Y, useNames as Z } from "../context.js";
import { hideBroken as v } from "../dom.js";
import { RUNE_SLOTS as j } from "../logic/detail.js";
import { shopVisits as x } from "../logic/shop.js";
import { tk as w } from "../logic/i18n.js";
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
}, Be = ["src", "alt", "title"], Me = {
  key: 0,
  class: "iv-bd-tree second"
}, we = { class: "iv-bd-slot iv-bd-shards" }, Ee = ["src", "alt", "title"], Ne = { class: "iv-bd-kit" }, Ce = { class: "iv-label" }, Ie = { class: "iv-bd-items" }, Te = ["src", "alt", "title"], Le = { class: "iv-label" }, De = { class: "iv-bd-spells" }, Ve = ["src"], je = { class: "iv-bd-facts" }, Pe = { class: "iv-label" }, qe = /* @__PURE__ */ X({
  __name: "BuildTab",
  props: {
    detail: {},
    selected: {},
    me: {}
  },
  emits: ["select"],
  setup(M, { emit: P }) {
    const E = M, U = P, { t: i } = J(), { compact: I, signedGold: T, mmss: $ } = Y(), { itemIcon: N, itemName: h, runeIcon: C, runeName: g, spellIcon: F, spellName: O, styleIcon: R, styleName: W } = Z(), k = B(() => E.detail.players[E.selected]), L = B(
      () => (k.value.purchases?.length ? x(k.value.purchases) : []).map((n, a) => ({
        ...n,
        items: n.items.map((o, m) => ({ ...o, key: `${a}:${m}` }))
      }))
    ), c = q("");
    A(() => E.selected, () => c.value = "");
    const D = (n) => c.value = c.value === n ? "" : n, z = B(() => new Set(k.value.perks)), V = B(() => {
      const [n, a] = k.value.styles;
      return [
        { id: n, rows: j[n] ?? null, fallback: k.value.perks.slice(0, 4) },
        { id: a, rows: j[a]?.slice(1) ?? null, fallback: k.value.perks.slice(4, 6) }
      ].filter((o) => o.id > 0);
    }), G = ["", "", w("Double kill"), w("Triple kill"), w("Quadra kill"), w("Penta kill")], K = B(() => {
      const n = k.value, a = [
        { label: i("Wards"), value: i("{placed} placed · {killed} destroyed · {control} control", { placed: n.wardsPlaced, killed: n.wardsKilled, control: n.controlWards }) }
      ];
      if (n.ccTime !== null && a.push({ label: i("Crowd control"), value: i("{n} s", { n: n.ccTime }) }), a.push({ label: i("Objective damage"), value: i("{n} · {towers} to towers", { n: I(n.objectiveDamage), towers: I(n.turretDamage) }) }), n.largestSpree !== null && a.push({ label: i("Largest killing spree"), value: String(n.largestSpree) }), n.largestMulti !== null && n.largestMulti > 1 && a.push({ label: i("Largest multikill"), value: i(G[Math.min(5, n.largestMulti)]) }), n.gold15 !== null || n.xp15 !== null || n.cs15 !== null) {
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
        detail: M.detail,
        selected: M.selected,
        me: M.me,
        onSelect: a[0] || (a[0] = (o) => U("select", o))
      }, null, 8, ["detail", "selected", "me"]),
      L.value.length ? (l(), s("section", le, [
        r("h4", se, u(t(i)("Build path")), 1),
        r("ol", null, [
          (l(!0), s(p, null, b(L.value, (o, m) => (l(), s("li", { key: m }, [
            r("div", oe, [
              (l(!0), s(p, null, b(o.items.filter((e) => !e.sold), (e) => (l(), s("button", {
                key: e.key,
                type: "button",
                class: y(["iv-bd-buy", { sold: e.sold, open: c.value === e.key }]),
                "aria-label": `${t(h)(e.item)}, ${t(i)(e.sold ? "Sold at {t}" : "Bought at {t}", { t: t($)(e.t) })}`,
                onClick: (d) => D(e.key),
                onMouseenter: (d) => c.value = e.key,
                onMouseleave: (d) => c.value === e.key && (c.value = ""),
                onBlur: (d) => c.value === e.key && (c.value = "")
              }, [
                r("img", {
                  src: t(N)(e.item),
                  alt: "",
                  onError: a[1] || (a[1] = //@ts-ignore
                  (...d) => t(v) && t(v)(...d))
                }, null, 40, ae),
                e.count > 1 ? (l(), s("span", re, u(e.count), 1)) : _("", !0),
                c.value === e.key ? (l(), s("span", ie, [
                  r("strong", null, u(t(h)(e.item)), 1),
                  r("span", ue, [
                    f(u(t(i)(e.sold ? "Sold at {t}" : "Bought at {t}", { t: t($)(e.t) })), 1),
                    e.count > 1 ? (l(), s(p, { key: 0 }, [
                      f(" · ×" + u(e.count), 1)
                    ], 64)) : _("", !0)
                  ])
                ])) : _("", !0)
              ], 42, ne))), 128)),
              o.items.some((e) => e.sold) ? (l(), s("div", ce, [
                r("span", null, u(t(i)("Sold")), 1),
                (l(!0), s(p, null, b(o.items.filter((e) => e.sold), (e) => (l(), s("button", {
                  key: e.key,
                  type: "button",
                  class: y(["iv-bd-buy", { sold: e.sold, open: c.value === e.key }]),
                  "aria-label": `${t(h)(e.item)}, ${t(i)(e.sold ? "Sold at {t}" : "Bought at {t}", { t: t($)(e.t) })}`,
                  onClick: (d) => D(e.key),
                  onMouseenter: (d) => c.value = e.key,
                  onMouseleave: (d) => c.value === e.key && (c.value = ""),
                  onBlur: (d) => c.value === e.key && (c.value = "")
                }, [
                  r("img", {
                    src: t(N)(e.item),
                    alt: "",
                    onError: a[2] || (a[2] = //@ts-ignore
                    (...d) => t(v) && t(v)(...d))
                  }, null, 40, ve),
                  e.count > 1 ? (l(), s("span", me, u(e.count), 1)) : _("", !0),
                  c.value === e.key ? (l(), s("span", pe, [
                    r("strong", null, u(t(h)(e.item)), 1),
                    r("span", ke, [
                      f(u(t(i)(e.sold ? "Sold at {t}" : "Bought at {t}", { t: t($)(e.t) })), 1),
                      e.count > 1 ? (l(), s(p, { key: 0 }, [
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
        V.value.length && k.value.perks[0] ? (l(), s("section", ye, [
          r("h4", he, u(t(i)("Runes")), 1),
          (l(!0), s(p, null, b(V.value, (o, m) => (l(), s("div", {
            key: o.id,
            class: y(["iv-bd-tree", { second: m }])
          }, [
            r("p", ge, [
              r("img", {
                src: t(R)(o.id),
                alt: "",
                onError: a[3] || (a[3] = //@ts-ignore
                (...e) => t(v) && t(v)(...e))
              }, null, 40, fe),
              f(u(t(W)(o.id)), 1)
            ]),
            o.rows ? (l(!0), s(p, { key: 0 }, b(o.rows, (e, d) => (l(), s("div", {
              key: d,
              class: y(["iv-bd-slot", { keys: !m && !d }])
            }, [
              (l(!0), s(p, null, b(e, (S) => (l(), s("img", {
                key: S,
                src: t(C)(S),
                alt: t(g)(S),
                title: t(g)(S),
                class: y({ off: !z.value.has(S) }),
                onError: a[4] || (a[4] = //@ts-ignore
                (...Q) => t(v) && t(v)(...Q))
              }, null, 42, $e))), 128))
            ], 2))), 128)) : (l(), s("div", Se, [
              (l(!0), s(p, null, b(o.fallback, (e) => (l(), s("img", {
                key: e,
                src: t(C)(e),
                alt: t(g)(e),
                title: t(g)(e),
                onError: a[5] || (a[5] = //@ts-ignore
                (...d) => t(v) && t(v)(...d))
              }, null, 40, Be))), 128))
            ]))
          ], 2))), 128)),
          k.value.shards ? (l(), s("div", Me, [
            r("div", we, [
              (l(!0), s(p, null, b(k.value.shards, (o, m) => (l(), s("img", {
                key: m,
                src: t(C)(o),
                alt: t(g)(o),
                title: t(g)(o),
                onError: a[6] || (a[6] = //@ts-ignore
                (...e) => t(v) && t(v)(...e))
              }, null, 40, Ee))), 128))
            ])
          ])) : _("", !0)
        ])) : _("", !0),
        r("section", Ne, [
          r("h4", Ce, u(t(i)("Items")), 1),
          r("div", Ie, [
            (l(!0), s(p, null, b(k.value.items, (o, m) => (l(), s(p, { key: m }, [
              o ? (l(), s("img", {
                key: 0,
                src: t(N)(o),
                alt: t(h)(o),
                title: t(h)(o),
                class: y({ trinket: m === 6 }),
                onError: a[7] || (a[7] = //@ts-ignore
                (...e) => t(v) && t(v)(...e))
              }, null, 42, Te)) : (l(), s("i", {
                key: 1,
                class: y({ trinket: m === 6 })
              }, null, 2))
            ], 64))), 128))
          ]),
          r("h4", Le, u(t(i)("Summoner spells")), 1),
          r("div", De, [
            (l(!0), s(p, null, b(k.value.spells, (o, m) => (l(), s("span", { key: m }, [
              r("img", {
                src: t(F)(o),
                alt: "",
                onError: a[8] || (a[8] = //@ts-ignore
                (...e) => t(v) && t(v)(...e))
              }, null, 40, Ve),
              f(u(t(O)(o)), 1)
            ]))), 128))
          ])
        ]),
        r("section", je, [
          r("h4", Pe, u(t(i)("Details")), 1),
          r("dl", null, [
            (l(!0), s(p, null, b(K.value, (o) => (l(), s("div", {
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
  qe as default
};
