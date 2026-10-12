import '../styles/base.css';
import '../styles/primitives.css';
import { defineComponent as t, openBlock as i, createElementBlock as n, normalizeStyle as l } from "vue";
/* empty css                 */
/* empty css                       */
const s = /* @__PURE__ */ t({
  __name: "Skeleton",
  props: {
    width: {},
    height: {}
  },
  setup(e) {
    return (o, r) => (i(), n("span", {
      class: "iv-skel",
      style: l({ display: "block", width: e.width, height: e.height }),
      "aria-hidden": "true"
    }, null, 4));
  }
});
export {
  s as default
};
