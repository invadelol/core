import '../styles/base.css';
import './RunePage.css';
import { defineComponent as C, computed as m, openBlock as e, createElementBlock as s, Fragment as c, renderList as o, createElementVNode as u, unref as t, createCommentVNode as y, createTextVNode as b, toDisplayString as N, normalizeClass as f } from "vue";
import { useNames as j } from "../context.js";
import { runePageView as E } from "../logic/runes.js";
/* empty css                 */
const I = ["aria-label"], P = { class: "iv-rp-name" }, D = ["src"], F = ["title"], L = ["src"], R = {
  key: 0,
  class: "iv-rp-shards"
}, S = ["title"], T = ["src"], q = {
  key: 1,
  class: "iv-runes"
}, A = { class: "iv-runes-row" }, G = ["src", "alt"], H = ["src", "alt", "title"], J = { class: "iv-runes-row" }, K = ["src", "alt"], M = ["src", "alt", "title"], O = { class: "iv-runes-shards" }, $ = /* @__PURE__ */ C({
  __name: "RunePage",
  props: {
    page: {},
    compact: { type: Boolean, default: !1 },
    trees: { default: void 0 }
  },
  setup(d) {
    const l = d, { runeIcon: i, runeName: n, styleIcon: _, styleName: h } = j(), w = m(() => l.page.p.slice(1)), V = m(() => l.page.s.slice(1)), x = m(() => l.page.m.map(n).join(" · ")), p = m(() => l.compact ? E(l.page, l.trees) : null), z = m(() => [...l.page.p.slice(1), ...l.page.s.slice(1), ...l.page.m].map(n).join(", "));
    return (Q, U) => p.value ? (e(), s("div", {
      key: 0,
      class: "iv-rp",
      role: "img",
      "aria-label": z.value
    }, [
      (e(!0), s(c, null, o([p.value.primary, p.value.secondary], (a, v) => (e(), s("div", {
        key: v,
        class: "iv-rp-tree"
      }, [
        u("span", P, [
          t(_)(a.tree) ? (e(), s("img", {
            key: 0,
            src: t(_)(a.tree),
            alt: ""
          }, null, 8, D)) : y("", !0),
          b(N(t(h)(a.tree)), 1)
        ]),
        (e(!0), s(c, null, o(a.rows, (k, g) => (e(), s("span", {
          key: g,
          class: "iv-rp-slots"
        }, [
          (e(!0), s(c, null, o(k, (r) => (e(), s("span", {
            key: r.id,
            class: f(["iv-rp-rune", { key: a.keystones && g === 0, on: r.on }]),
            title: t(n)(r.id)
          }, [
            t(i)(r.id) ? (e(), s("img", {
              key: 0,
              src: t(i)(r.id),
              alt: "",
              loading: "lazy"
            }, null, 8, L)) : y("", !0)
          ], 10, F))), 128))
        ]))), 128)),
        v === 1 && p.value.shards.length ? (e(), s("span", R, [
          (e(!0), s(c, null, o(p.value.shards, (k, g) => (e(), s("span", {
            key: g,
            class: "iv-rp-slots"
          }, [
            (e(!0), s(c, null, o(k, (r, B) => (e(), s("span", {
              key: B,
              class: f(["iv-rp-rune shard", { on: r.on }]),
              title: t(n)(r.id)
            }, [
              t(i)(r.id) ? (e(), s("img", {
                key: 0,
                src: t(i)(r.id),
                alt: "",
                loading: "lazy"
              }, null, 8, T)) : y("", !0)
            ], 10, S))), 128))
          ]))), 128))
        ])) : y("", !0)
      ]))), 128))
    ], 8, I)) : (e(), s("div", q, [
      u("div", A, [
        u("img", {
          class: "tree",
          src: t(_)(d.page.p[0]),
          alt: t(h)(d.page.p[0])
        }, null, 8, G),
        (e(!0), s(c, null, o(w.value, (a, v) => (e(), s("img", {
          key: a,
          class: f({ key: v === 0 }),
          src: t(i)(a),
          alt: t(n)(a),
          title: t(n)(a)
        }, null, 10, H))), 128))
      ]),
      u("div", J, [
        u("img", {
          class: "tree",
          src: t(_)(d.page.s[0]),
          alt: t(h)(d.page.s[0])
        }, null, 8, K),
        (e(!0), s(c, null, o(V.value, (a) => (e(), s("img", {
          key: a,
          src: t(i)(a),
          alt: t(n)(a),
          title: t(n)(a)
        }, null, 8, M))), 128))
      ]),
      u("div", O, N(x.value), 1)
    ]));
  }
});
export {
  $ as default
};
