import { defineComponent as i, useModel as r, openBlock as s, createElementBlock as o, normalizeClass as n, Fragment as a, renderList as d, toDisplayString as u, mergeModels as m } from "vue";
const c = ["aria-pressed", "onClick"], k = /* @__PURE__ */ i({
  __name: "Segmented",
  props: /* @__PURE__ */ m({
    options: {},
    size: { default: "md" }
  }, {
    modelValue: { required: !0 },
    modelModifiers: {}
  }),
  emits: ["update:modelValue"],
  setup(t) {
    const l = r(t, "modelValue");
    return (p, f) => (s(), o("div", {
      class: n(["iv-seg", { sm: t.size === "sm" }]),
      role: "group"
    }, [
      (s(!0), o(a, null, d(t.options, (e) => (s(), o("button", {
        key: e.id,
        type: "button",
        class: n({ on: l.value === e.id }),
        "aria-pressed": l.value === e.id,
        onClick: (g) => l.value = e.id
      }, u(e.label), 11, c))), 128))
    ], 2));
  }
});
export {
  k as default
};
