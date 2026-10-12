import '../styles/base.css';
import './TrendLine.css';
import { defineComponent as g, computed as k, useId as F, openBlock as s, createElementBlock as o, createElementVNode as u, createCommentVNode as m, Fragment as $ } from "vue";
import { monotone as B } from "../curve.js";
/* empty css                 */
const w = ["viewBox", "height"], L = { key: 0 }, M = ["x", "width", "height"], N = ["y1", "y2"], A = ["d", "fill"], C = ["d"], E = ["points"], V = {
  key: 1,
  class: "iv-trend empty"
}, y = 3, I = /* @__PURE__ */ g({
  __name: "TrendLine",
  props: {
    values: {},
    height: { default: 28 },
    baseline: { default: null },
    band: { default: 0 },
    area: { type: Boolean, default: !1 },
    span: { default: 0 }
  },
  setup(h) {
    const t = h, e = k(() => {
      const a = t.values.filter((n) => Number.isFinite(n));
      if (a.length < 2) return null;
      const d = t.baseline != null ? [...a, t.baseline] : a;
      let l = Math.min(...d), i = Math.max(...d);
      if (t.span > 0) {
        const n = Math.max((i - l) * 0.8, t.span / 2), r = (l + i) / 2;
        l = r - n, i = r + n;
      } else i - l < 1e-9 && (l -= 1, i += 1);
      const c = t.height, p = (n) => y + (1 - (n - l) / (i - l)) * (c - y * 2), v = (n) => n / (a.length - 1) * 100, x = a.map((n, r) => `${v(r).toFixed(2)},${p(n).toFixed(2)}`), _ = t.band > 0 && t.band < a.length ? v(a.length - t.band) : null, b = t.area ? B(a.map((n, r) => [v(r), p(n)])) : "";
      return {
        line: x.join(" "),
        curve: b,
        area: `${b}L100 ${c}L0 ${c}Z`,
        base: t.baseline != null ? p(t.baseline) : null,
        bandFrom: _,
        h: c
      };
    }), f = `iv-trend-${F()}`;
    return (a, d) => e.value ? (s(), o("svg", {
      key: 0,
      class: "iv-trend",
      viewBox: `0 0 100 ${e.value.h}`,
      preserveAspectRatio: "none",
      height: e.value.h,
      "aria-hidden": "true"
    }, [
      h.area ? (s(), o("defs", L, [
        u("linearGradient", {
          id: f,
          x1: "0",
          x2: "0",
          y1: "0",
          y2: "1"
        }, [...d[0] || (d[0] = [
          u("stop", {
            offset: "0",
            "stop-color": "var(--brand)",
            "stop-opacity": "0.12"
          }, null, -1),
          u("stop", {
            offset: "1",
            "stop-color": "var(--brand)",
            "stop-opacity": "0"
          }, null, -1)
        ])])
      ])) : m("", !0),
      e.value.bandFrom != null ? (s(), o("rect", {
        key: 1,
        x: e.value.bandFrom,
        y: "0",
        width: 100 - e.value.bandFrom,
        height: e.value.h,
        class: "iv-trend-band"
      }, null, 8, M)) : m("", !0),
      e.value.base != null ? (s(), o("line", {
        key: 2,
        x1: "0",
        x2: "100",
        y1: e.value.base,
        y2: e.value.base,
        class: "iv-trend-base"
      }, null, 8, N)) : m("", !0),
      h.area ? (s(), o($, { key: 3 }, [
        u("path", {
          d: e.value.area,
          fill: `url(#${f})`
        }, null, 8, A),
        u("path", {
          d: e.value.curve,
          class: "iv-trend-series"
        }, null, 8, C)
      ], 64)) : (s(), o("polyline", {
        key: 4,
        points: e.value.line,
        class: "iv-trend-series"
      }, null, 8, E))
    ], 8, w)) : (s(), o("span", V));
  }
});
export {
  I as default
};
