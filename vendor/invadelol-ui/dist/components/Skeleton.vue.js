import { defineComponent as t, openBlock as n, createElementBlock as i, normalizeStyle as l } from "vue";
const r = /* @__PURE__ */ t({
  __name: "Skeleton",
  props: {
    width: {},
    height: {}
  },
  setup(e) {
    return (a, o) => (n(), i("span", {
      class: "iv-skel",
      style: l({ display: "block", width: e.width, height: e.height }),
      "aria-hidden": "true"
    }, null, 4));
  }
});
export {
  r as default
};
