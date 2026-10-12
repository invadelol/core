import { defineComponent as l, openBlock as t, createElementBlock as r, Fragment as m, renderList as u, unref as n, createCommentVNode as i } from "vue";
import { useNames as p } from "../context.js";
const _ = ["src", "alt", "title"], N = /* @__PURE__ */ l({
  __name: "ItemIcons",
  props: {
    ids: {}
  },
  setup(s) {
    const { itemIcon: c, itemName: o } = p();
    return (f, d) => (t(!0), r(m, null, u(s.ids, (e, a) => (t(), r(m, { key: a }, [
      e ? (t(), r("img", {
        key: 0,
        src: n(c)(e),
        alt: n(o)(e),
        title: n(o)(e)
      }, null, 8, _)) : i("", !0)
    ], 64))), 128));
  }
});
export {
  N as default
};
