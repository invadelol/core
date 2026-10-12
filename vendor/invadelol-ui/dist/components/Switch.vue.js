import { defineComponent as i, useModel as n, openBlock as d, createElementBlock as u, withDirectives as r, createElementVNode as o, vModelCheckbox as s, mergeModels as m } from "vue";
const c = ["title"], b = ["aria-label"], v = /* @__PURE__ */ i({
  __name: "Switch",
  props: /* @__PURE__ */ m({
    label: {}
  }, {
    modelValue: { type: Boolean, required: !0 },
    modelModifiers: {}
  }),
  emits: ["update:modelValue"],
  setup(l) {
    const t = n(l, "modelValue");
    return (p, e) => (d(), u("label", {
      class: "iv-switch",
      title: l.label
    }, [
      r(o("input", {
        "onUpdate:modelValue": e[0] || (e[0] = (a) => t.value = a),
        type: "checkbox",
        "aria-label": l.label
      }, null, 8, b), [
        [s, t.value]
      ]),
      e[1] || (e[1] = o("i", null, null, -1))
    ], 8, c));
  }
});
export {
  v as default
};
