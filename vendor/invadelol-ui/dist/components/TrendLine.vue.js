import '../styles/base.css';
import './TrendLine.css';
import { defineComponent as g, computed as k, useId as F, openBlock as a, createElementBlock as s, createElementVNode as i, createCommentVNode as m, Fragment as $ } from "vue";
import { monotone as B } from "../curve.js";
/* empty css                 */
const w = ["viewBox", "height"], L = { key: 0 }, N = ["x", "width", "height"], A = ["y1", "y2"], C = ["d", "fill"], E = ["d"], M = ["points"], V = {
  key: 1,
  class: "iv-trend empty"
}, y = 3, I = /* @__PURE__ */ g({
  __name: "TrendLine",
  props: {
    values: {},
    height: { default: 28 },
    baseline: { default: null },
    band: { default: 0 },
    area: { type: Boolean, default: !1 }
  },
  setup(u) {
    const t = u, e = k(() => {
      const n = t.values.filter((l) => Number.isFinite(l));
      if (n.length < 2) return null;
      const o = t.baseline != null ? [...n, t.baseline] : n;
      let r = Math.min(...o), c = Math.max(...o);
      c - r < 1e-9 && (r -= 1, c += 1);
      const d = t.height, h = (l) => y + (1 - (l - r) / (c - r)) * (d - y * 2), v = (l) => l / (n.length - 1) * 100, _ = n.map((l, p) => `${v(p).toFixed(2)},${h(l).toFixed(2)}`), x = t.band > 0 && t.band < n.length ? v(n.length - t.band) : null, f = t.area ? B(n.map((l, p) => [v(p), h(l)])) : "";
      return {
        line: _.join(" "),
        curve: f,
        area: `${f}L100 ${d}L0 ${d}Z`,
        base: t.baseline != null ? h(t.baseline) : null,
        bandFrom: x,
        h: d
      };
    }), b = `iv-trend-${F()}`;
    return (n, o) => e.value ? (a(), s("svg", {
      key: 0,
      class: "iv-trend",
      viewBox: `0 0 100 ${e.value.h}`,
      preserveAspectRatio: "none",
      height: e.value.h,
      "aria-hidden": "true"
    }, [
      u.area ? (a(), s("defs", L, [
        i("linearGradient", {
          id: b,
          x1: "0",
          x2: "0",
          y1: "0",
          y2: "1"
        }, [...o[0] || (o[0] = [
          i("stop", {
            offset: "0",
            "stop-color": "var(--brand)",
            "stop-opacity": "0.12"
          }, null, -1),
          i("stop", {
            offset: "1",
            "stop-color": "var(--brand)",
            "stop-opacity": "0"
          }, null, -1)
        ])])
      ])) : m("", !0),
      e.value.bandFrom != null ? (a(), s("rect", {
        key: 1,
        x: e.value.bandFrom,
        y: "0",
        width: 100 - e.value.bandFrom,
        height: e.value.h,
        class: "iv-trend-band"
      }, null, 8, N)) : m("", !0),
      e.value.base != null ? (a(), s("line", {
        key: 2,
        x1: "0",
        x2: "100",
        y1: e.value.base,
        y2: e.value.base,
        class: "iv-trend-base"
      }, null, 8, A)) : m("", !0),
      u.area ? (a(), s($, { key: 3 }, [
        i("path", {
          d: e.value.area,
          fill: `url(#${b})`
        }, null, 8, C),
        i("path", {
          d: e.value.curve,
          class: "iv-trend-series"
        }, null, 8, E)
      ], 64)) : (a(), s("polyline", {
        key: 4,
        points: e.value.line,
        class: "iv-trend-series"
      }, null, 8, M))
    ], 8, w)) : (a(), s("span", V));
  }
});
export {
  I as default
};
