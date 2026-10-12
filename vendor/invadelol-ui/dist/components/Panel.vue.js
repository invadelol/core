import { defineComponent as i, openBlock as t, createElementBlock as a, toDisplayString as o, createCommentVNode as n, renderSlot as l } from "vue";
const c = { class: "iv-panel" }, d = {
  key: 0,
  class: "iv-panel-head"
}, m = { key: 0 }, r = {
  key: 1,
  class: "meta"
}, f = /* @__PURE__ */ i({
  __name: "Panel",
  props: {
    title: {},
    meta: {}
  },
  setup(e) {
    return (s, h) => (t(), a("section", c, [
      e.title || e.meta || s.$slots.head ? (t(), a("header", d, [
        e.title ? (t(), a("h3", m, o(e.title), 1)) : n("", !0),
        e.meta ? (t(), a("span", r, o(e.meta), 1)) : n("", !0),
        l(s.$slots, "head")
      ])) : n("", !0),
      l(s.$slots, "default")
    ]));
  }
});
export {
  f as default
};
