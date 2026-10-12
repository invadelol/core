import { defineComponent as l, useModel as n, openBlock as a, createElementBlock as o, Fragment as r, renderList as i, normalizeClass as d, toDisplayString as u, mergeModels as c } from "vue";
const m = { class: "iv-tabs" }, p = ["aria-pressed", "onClick"], k = /* @__PURE__ */ l({
  __name: "Tabs",
  props: /* @__PURE__ */ c({
    tabs: {}
  }, {
    modelValue: { required: !0 },
    modelModifiers: {}
  }),
  emits: ["update:modelValue"],
  setup(s) {
    const t = n(s, "modelValue");
    return (_, b) => (a(), o("nav", m, [
      (a(!0), o(r, null, i(s.tabs, (e) => (a(), o("button", {
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
  k as default
};
