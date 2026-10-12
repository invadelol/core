import { defineComponent as m, openBlock as e, createElementBlock as t, Fragment as n, renderList as u, unref as a, createCommentVNode as i } from "vue";
import { useNames as l } from "../context.js";
const p = ["src"], I = /* @__PURE__ */ m({
  __name: "ItemIcons",
  props: {
    ids: {}
  },
  setup(o) {
    const { itemIcon: s } = l();
    return (_, d) => (e(!0), t(n, null, u(o.ids, (r, c) => (e(), t(n, { key: c }, [
      r ? (e(), t("img", {
        key: 0,
        src: a(s)(r),
        alt: ""
      }, null, 8, p)) : i("", !0)
    ], 64))), 128));
  }
});
export {
  I as default
};
