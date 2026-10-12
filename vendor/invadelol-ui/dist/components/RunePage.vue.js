import '../styles/base.css';
import './RunePage.css';
import { defineComponent as y, computed as o, openBlock as a, createElementBlock as l, createElementVNode as r, unref as e, Fragment as p, renderList as g, normalizeClass as f, toDisplayString as k } from "vue";
import { useNames as N } from "../context.js";
/* empty css                 */
const w = { class: "iv-runes" }, x = { class: "iv-runes-row" }, B = ["src", "alt"], C = ["src", "alt", "title"], E = { class: "iv-runes-row" }, I = ["src", "alt"], j = ["src", "alt", "title"], z = { class: "iv-runes-shards" }, S = /* @__PURE__ */ y({
  __name: "RunePage",
  props: {
    page: {}
  },
  setup(t) {
    const c = t, { runeIcon: i, runeName: n, styleIcon: u, styleName: m } = N(), d = o(() => c.page.p.slice(1)), _ = o(() => c.page.s.slice(1)), h = o(() => c.page.m.map(n).join(" · "));
    return (D, F) => (a(), l("div", w, [
      r("div", x, [
        r("img", {
          class: "tree",
          src: e(u)(t.page.p[0]),
          alt: e(m)(t.page.p[0])
        }, null, 8, B),
        (a(!0), l(p, null, g(d.value, (s, v) => (a(), l("img", {
          key: s,
          class: f({ key: v === 0 }),
          src: e(i)(s),
          alt: e(n)(s),
          title: e(n)(s)
        }, null, 10, C))), 128))
      ]),
      r("div", E, [
        r("img", {
          class: "tree",
          src: e(u)(t.page.s[0]),
          alt: e(m)(t.page.s[0])
        }, null, 8, I),
        (a(!0), l(p, null, g(_.value, (s) => (a(), l("img", {
          key: s,
          src: e(i)(s),
          alt: e(n)(s),
          title: e(n)(s)
        }, null, 8, j))), 128))
      ]),
      r("div", z, k(h.value), 1)
    ]));
  }
});
export {
  S as default
};
