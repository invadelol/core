import '../styles/base.css';
import './StarButton.css';
import { defineComponent as r, openBlock as i, createElementBlock as n, withModifiers as l, unref as o, normalizeClass as m, createVNode as v } from "vue";
import f from "./Icon.vue.js";
import { useInvadeUi as d } from "../context.js";
/* empty css                 */
const c = ["aria-pressed", "aria-label", "title"], B = /* @__PURE__ */ r({
  __name: "StarButton",
  props: {
    saved: { type: Boolean },
    label: {}
  },
  emits: ["toggle"],
  setup(e) {
    const { t } = d();
    return (s, a) => (i(), n("button", {
      type: "button",
      class: m(["iv-star", { saved: e.saved }]),
      "aria-pressed": e.saved,
      "aria-label": `${o(t)(e.saved ? "Remove from favorites" : "Save to favorites")} · ${e.label}`,
      title: o(t)(e.saved ? "Remove from favorites" : "Save to favorites"),
      onClick: a[0] || (a[0] = l((u) => s.$emit("toggle"), ["stop"]))
    }, [
      v(f, {
        name: "star",
        size: 16
      })
    ], 10, c));
  }
});
export {
  B as default
};
