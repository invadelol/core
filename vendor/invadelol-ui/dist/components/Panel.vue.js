import '../styles/base.css';
import '../styles/primitives.css';
import { defineComponent as i, openBlock as t, createElementBlock as a, toDisplayString as n, createCommentVNode as s, renderSlot as l } from "vue";
/* empty css                 */
/* empty css                       */
const m = { class: "iv-panel" }, c = {
  key: 0,
  class: "iv-panel-head"
}, r = { key: 0 }, d = {
  key: 1,
  class: "meta"
}, y = /* @__PURE__ */ i({
  __name: "Panel",
  props: {
    title: {},
    meta: {}
  },
  setup(e) {
    return (o, h) => (t(), a("section", m, [
      e.title || e.meta || o.$slots.head ? (t(), a("header", c, [
        e.title ? (t(), a("h3", r, n(e.title), 1)) : s("", !0),
        e.meta ? (t(), a("span", d, n(e.meta), 1)) : s("", !0),
        l(o.$slots, "head")
      ])) : s("", !0),
      l(o.$slots, "default")
    ]));
  }
});
export {
  y as default
};
