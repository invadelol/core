import '../styles/base.css';
import './TrendLine.css';
import { defineComponent as _, computed as g, useId as k, openBlock as a, createElementBlock as o, createElementVNode as u, createCommentVNode as d } from "vue";
/* empty css                 */
const $ = ["viewBox", "height"], F = { key: 0 }, B = ["x", "width", "height"], w = ["y1", "y2"], N = ["points", "fill"], j = ["points"], A = {
  key: 1,
  class: "iv-trend empty"
}, y = 3, M = /* @__PURE__ */ _({
  __name: "TrendLine",
  props: {
    values: {},
    height: { default: 28 },
    baseline: { default: null },
    band: { default: 0 },
    area: { type: Boolean, default: !1 }
  },
  setup(c) {
    const t = c, e = g(() => {
      const n = t.values.filter((l) => Number.isFinite(l));
      if (n.length < 2) return null;
      const s = t.baseline != null ? [...n, t.baseline] : n;
      let i = Math.min(...s), h = Math.max(...s);
      h - i < 1e-9 && (i -= 1, h += 1);
      const r = t.height, v = (l) => y + (1 - (l - i) / (h - i)) * (r - y * 2), b = (l) => l / (n.length - 1) * 100, m = n.map((l, x) => `${b(x).toFixed(2)},${v(l).toFixed(2)}`), f = t.band > 0 && t.band < n.length ? b(n.length - t.band) : null;
      return {
        line: m.join(" "),
        area: `0,${r} ${m.join(" ")} 100,${r}`,
        base: t.baseline != null ? v(t.baseline) : null,
        bandFrom: f,
        h: r
      };
    }), p = `iv-trend-${k()}`;
    return (n, s) => e.value ? (a(), o("svg", {
      key: 0,
      class: "iv-trend",
      viewBox: `0 0 100 ${e.value.h}`,
      preserveAspectRatio: "none",
      height: e.value.h,
      "aria-hidden": "true"
    }, [
      c.area ? (a(), o("defs", F, [
        u("linearGradient", {
          id: p,
          x1: "0",
          x2: "0",
          y1: "0",
          y2: "1"
        }, [...s[0] || (s[0] = [
          u("stop", {
            offset: "0",
            "stop-color": "var(--brand)",
            "stop-opacity": "0.16"
          }, null, -1),
          u("stop", {
            offset: "1",
            "stop-color": "var(--brand)",
            "stop-opacity": "0"
          }, null, -1)
        ])])
      ])) : d("", !0),
      e.value.bandFrom != null ? (a(), o("rect", {
        key: 1,
        x: e.value.bandFrom,
        y: "0",
        width: 100 - e.value.bandFrom,
        height: e.value.h,
        class: "iv-trend-band"
      }, null, 8, B)) : d("", !0),
      e.value.base != null ? (a(), o("line", {
        key: 2,
        x1: "0",
        x2: "100",
        y1: e.value.base,
        y2: e.value.base,
        class: "iv-trend-base"
      }, null, 8, w)) : d("", !0),
      c.area ? (a(), o("polygon", {
        key: 3,
        points: e.value.area,
        fill: `url(#${p})`
      }, null, 8, N)) : d("", !0),
      u("polyline", {
        points: e.value.line,
        class: "iv-trend-series"
      }, null, 8, j)
    ], 8, $)) : (a(), o("span", A));
  }
});
export {
  M as default
};
