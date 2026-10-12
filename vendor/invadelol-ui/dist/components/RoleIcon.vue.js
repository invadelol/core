import { defineComponent as i, openBlock as n, createElementBlock as o, createElementVNode as e, createCommentVNode as r } from "vue";
const d = ["width", "height"], u = { key: 0 }, h = { key: 1 }, a = { key: 2 }, s = { key: 3 }, f = { key: 4 }, Z = /* @__PURE__ */ i({
  __name: "RoleIcon",
  props: {
    lane: {},
    size: { default: 18 }
  },
  setup(t) {
    return (c, l) => (n(), o("svg", {
      class: "iv-role-icon",
      width: t.size,
      height: t.size,
      viewBox: "0 0 34 34",
      "aria-hidden": "true",
      style: { "flex-shrink": "0" }
    }, [
      t.lane === "TOP" ? (n(), o("g", u, [...l[0] || (l[0] = [
        e("path", {
          fill: "currentColor",
          "fill-rule": "evenodd",
          opacity: ".5",
          d: "M21 14h-7v7h7v-7Zm5-3v15H11.014l-4 4H30V7.016Z"
        }, null, -1),
        e("path", {
          fill: "currentColor",
          d: "m4 4 .003 24.045 4.997-5V9h14l5.045-4.997Z"
        }, null, -1)
      ])])) : r("", !0),
      t.lane === "JUNGLE" ? (n(), o("g", h, [...l[1] || (l[1] = [
        e("path", {
          fill: "currentColor",
          "fill-rule": "evenodd",
          d: "M25 3c-2.128 3.3-5.147 6.851-6.966 11.469A42.373 42.373 0 0 1 20 20a27.7 27.7 0 0 1 1-3c0-4.977 1.856-8.723 4-14ZM13 20c-1.488-4.487-4.76-6.966-9-9 3.868 3.136 4.422 7.52 5 12l3.743 3.312C14.215 27.917 16.527 30.451 17 31c4.555-9.445-3.366-20.8-8-28 2.67 6.573 4.717 10.342 4 17Zm8 5a15.271 15.271 0 0 1 0 2l4-4c.578-4.48 1.132-8.864 5-12-5.288 2.537-7.866 7.854-9 14Z"
        }, null, -1)
      ])])) : r("", !0),
      t.lane === "MID" ? (n(), o("g", a, [...l[2] || (l[2] = [
        e("path", {
          fill: "currentColor",
          "fill-rule": "evenodd",
          opacity: ".5",
          d: "m30 12.968-4.008 4L26 26h-9l-4 4h17ZM16.979 8 21 4H4v16.977L8 17V8Z"
        }, null, -1),
        e("path", {
          fill: "currentColor",
          d: "M25 4 4 25v5h5L30 9V4Z"
        }, null, -1)
      ])])) : r("", !0),
      t.lane === "ADC" ? (n(), o("g", s, [...l[3] || (l[3] = [
        e("path", {
          fill: "currentColor",
          "fill-rule": "evenodd",
          opacity: ".5",
          d: "M13 20h7v-7h-7v7ZM4 4v22.984l3.955-4L8 8h14.986l4-4Z"
        }, null, -1),
        e("path", {
          fill: "currentColor",
          d: "m29.997 5.955-4.997 5V25H11l-5.045 4.997L30 30Z"
        }, null, -1)
      ])])) : r("", !0),
      t.lane === "SUPPORT" ? (n(), o("g", f, [...l[4] || (l[4] = [
        e("path", {
          fill: "currentColor",
          "fill-rule": "evenodd",
          d: "M26 13c3.535 0 8-4 8-4H23l-3 3 2 7 5-2-3-4h2ZM22 5l-1.173-2H13.062L12 5l5 6Zm-5 9-1-1-3 15 4 3 4-3-3-15ZM11 9H0s4.465 4 8 4h2l-3 4 5 2 2-7Z"
        }, null, -1)
      ])])) : r("", !0)
    ], 8, d));
  }
});
export {
  Z as default
};
