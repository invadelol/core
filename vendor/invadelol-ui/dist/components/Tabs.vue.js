import '../styles/base.css';
import '../styles/primitives.css';
import { defineComponent as l, useModel as r, openBlock as o, createElementBlock as a, Fragment as n, renderList as i, normalizeClass as d, toDisplayString as u, mergeModels as m } from "vue";
/* empty css                 */
/* empty css                       */
const c = { class: "iv-tabs" }, p = ["aria-pressed", "onClick"], g = /* @__PURE__ */ l({
  __name: "Tabs",
  props: /* @__PURE__ */ m({
    tabs: {}
  }, {
    modelValue: { required: !0 },
    modelModifiers: {}
  }),
  emits: ["update:modelValue"],
  setup(s) {
    const t = r(s, "modelValue");
    return (_, b) => (o(), a("nav", c, [
      (o(!0), a(n, null, i(s.tabs, (e) => (o(), a("button", {
        key: e.id,
        type: "button",
        class: d({ on: t.value === e.id }),
        "aria-pressed": t.value === e.id,
        onClick: (v) => t.value = e.id
      }, u(e.label), 11, p))), 128))
    ]));
  }
});
export {
  g as default
};
