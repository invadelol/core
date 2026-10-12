import { defineComponent as s, openBlock as o, createElementBlock as t, createElementVNode as n, createCommentVNode as a } from "vue";
const i = { class: "iv-logo" }, d = ["height", "width"], r = {
  key: 0,
  class: "iv-logo-word"
}, m = /* @__PURE__ */ s({
  __name: "Logo",
  props: {
    size: { default: 28 },
    word: { type: Boolean, default: !1 }
  },
  setup(e) {
    return (c, l) => (o(), t("span", i, [
      (o(), t("svg", {
        height: e.size,
        width: e.size * 155 / 170,
        viewBox: "54 22 155 170",
        "aria-label": "Invade",
        class: "iv-logo-mark"
      }, [...l[0] || (l[0] = [
        n("path", { d: "M140.32,114.78l66.57-52.4-84.5,29.38,18.32-28.35-30.09,17.830,39.13-56.71-79.86,45.07-7.92,13.62.91,24.19,31.05,8.35,9.9,22.32,25.04,9.9-8.54,18.83-36.29.19v8.54l67.35,14.75-21.54-28.53,71.03-44.25-60.55-2.72ZM73.47,105.37l14.19-27.76,4.98,27.76h-19.17Z" }, null, -1),
        n("polygon", { points: "55.54 130.51 73.97 130.39 85.04 143.21 66.99 144.45 55.54 130.51" }, null, -1)
      ])], 8, d)),
      e.word ? (o(), t("span", r, "Invade")) : a("", !0)
    ]));
  }
});
export {
  m as default
};
