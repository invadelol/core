import { defineComponent as p, computed as l, openBlock as r, createElementBlock as i, renderSlot as u } from "vue";
import { useInvadeUi as d } from "../context.js";
const f = ["href"], m = ["disabled"], h = /* @__PURE__ */ p({
  __name: "Link",
  props: {
    to: {}
  },
  setup(a) {
    const t = a, o = d(), n = l(() => t.to ? o.linkTo(t.to) : void 0), c = l(() => !!t.to && (!!n.value || !!o.onOpen));
    function s(e) {
      !t.to || !o.onOpen || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || (e.preventDefault(), o.onOpen(t.to, e));
    }
    return (e, k) => n.value ? (r(), i("a", {
      key: 0,
      href: n.value,
      onClick: s
    }, [
      u(e.$slots, "default")
    ], 8, f)) : (r(), i("button", {
      key: 1,
      type: "button",
      disabled: !c.value,
      onClick: s
    }, [
      u(e.$slots, "default")
    ], 8, m));
  }
});
export {
  h as default
};
