import '../styles/base.css';
import '../styles/primitives.css';
import { defineComponent as r, useModel as n, openBlock as o, createElementBlock as s, normalizeClass as i, Fragment as a, renderList as d, toDisplayString as m, mergeModels as u } from "vue";
/* empty css                 */
/* empty css                       */
const c = ["aria-pressed", "onClick"], _ = /* @__PURE__ */ r({
  __name: "Segmented",
  props: /* @__PURE__ */ u({
    options: {},
    size: { default: "md" }
  }, {
    modelValue: { required: !0 },
    modelModifiers: {}
  }),
  emits: ["update:modelValue"],
  setup(t) {
    const l = n(t, "modelValue");
    return (p, f) => (o(), s("div", {
      class: i(["iv-seg", { sm: t.size === "sm" }]),
      role: "group"
    }, [
      (o(!0), s(a, null, d(t.options, (e) => (o(), s("button", {
        key: e.id,
        type: "button",
        class: i({ on: l.value === e.id }),
        "aria-pressed": l.value === e.id,
        onClick: (g) => l.value = e.id
      }, m(e.label), 11, c))), 128))
    ], 2));
  }
});
export {
  _ as default
};
