import '../styles/base.css';
import '../styles/primitives.css';
import { defineComponent as n, openBlock as a, createElementBlock as l, normalizeClass as o, renderSlot as i } from "vue";
/* empty css                 */
/* empty css                       */
const u = ["type"], s = /* @__PURE__ */ n({
  __name: "Button",
  props: {
    variant: { default: "default" },
    size: { default: "md" },
    iconOnly: { type: Boolean, default: !1 },
    type: { default: "button" }
  },
  setup(t) {
    return (e, d) => (a(), l("button", {
      type: t.type,
      class: o(["iv-btn", [t.variant !== "default" && t.variant, t.size !== "md" && t.size, { "icon-only": t.iconOnly }]])
    }, [
      i(e.$slots, "default")
    ], 10, u));
  }
});
export {
  s as default
};
