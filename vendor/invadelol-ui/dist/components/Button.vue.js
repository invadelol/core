import { defineComponent as n, openBlock as a, createElementBlock as l, normalizeClass as o, renderSlot as i } from "vue";
const u = ["type"], f = /* @__PURE__ */ n({
  __name: "Button",
  props: {
    variant: { default: "default" },
    size: { default: "md" },
    iconOnly: { type: Boolean, default: !1 },
    type: { default: "button" }
  },
  setup(e) {
    return (t, d) => (a(), l("button", {
      type: e.type,
      class: o(["iv-btn", [e.variant !== "default" && e.variant, e.size !== "md" && e.size, { "icon-only": e.iconOnly }]])
    }, [
      i(t.$slots, "default")
    ], 10, u));
  }
});
export {
  f as default
};
