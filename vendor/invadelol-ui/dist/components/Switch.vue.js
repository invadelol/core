import '../styles/base.css';
import '../styles/primitives.css';
import { defineComponent as i, useModel as n, openBlock as d, createElementBlock as r, withDirectives as u, createElementVNode as o, vModelCheckbox as m, mergeModels as s } from "vue";
/* empty css                 */
/* empty css                       */
const c = ["title"], p = ["aria-label"], h = /* @__PURE__ */ i({
  __name: "Switch",
  props: /* @__PURE__ */ s({
    label: {}
  }, {
    modelValue: { type: Boolean, required: !0 },
    modelModifiers: {}
  }),
  emits: ["update:modelValue"],
  setup(l) {
    const t = n(l, "modelValue");
    return (b, e) => (d(), r("label", {
      class: "iv-switch",
      title: l.label
    }, [
      u(o("input", {
        "onUpdate:modelValue": e[0] || (e[0] = (a) => t.value = a),
        type: "checkbox",
        "aria-label": l.label
      }, null, 8, p), [
        [m, t.value]
      ]),
      e[1] || (e[1] = o("i", null, null, -1))
    ], 8, c));
  }
});
export {
  h as default
};
