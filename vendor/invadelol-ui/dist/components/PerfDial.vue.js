import '../styles/base.css';
import './PerfDial.css';
import { defineComponent as V, computed as r, shallowRef as D, watch as F, openBlock as u, createElementBlock as d, normalizeStyle as E, normalizeClass as h, createElementVNode as b, unref as w, createCommentVNode as x, toDisplayString as I } from "vue";
import { tk as c } from "../logic/i18n.js";
import { useInvadeUi as G, useFormat as N } from "../context.js";
import { joinView as L, drawsIn as P } from "../entrance.js";
/* empty css                 */
const O = ["title", "aria-label", "role"], T = {
  viewBox: "0 0 40 40",
  "aria-hidden": "true"
}, K = ["d"], U = ["d", "stroke-dasharray"], q = 80, j = 90, i = 15, Y = /* @__PURE__ */ V({
  __name: "PerfDial",
  props: {
    score: {},
    rank: { default: 0 },
    tag: { default: "" },
    size: { default: "md" }
  },
  setup(s) {
    const e = s, { t: l } = G(), { ordinal: f } = N(), o = [
      [12, [255, 93, 110]],
      [42, [134, 124, 200]],
      [76, [76, 155, 255]]
    ], m = r(() => e.score === null ? "" : e.score >= j ? "peak" : e.score >= q ? "gold" : ""), z = r(() => {
      const t = e.score ?? 0;
      if (m.value) return `var(--score-${m.value}-rgb)`;
      if (t <= o[0][0]) return o[0][1].join(" ");
      if (t >= o[2][0]) return o[2][1].join(" ");
      const [[a, n], [B, C]] = t < o[1][0] ? [o[0], o[1]] : [o[1], o[2]], R = (t - a) / (B - a);
      return n.map(($, S) => Math.round($ + (C[S] - $) * R)).join(" ");
    }), A = [
      [j, c("Exceptional game")],
      [70, c("Great game")],
      [52, c("Good game")],
      [30, c("Average game")],
      [0, c("Rough game")]
    ], p = r(() => e.tag === "mvp" ? l("MVP") : e.tag === "ace" ? l("ACE") : e.rank ? f(e.rank) : ""), v = r(() => {
      if (e.score === null) return;
      const t = e.score, a = [l("Invade score {score}", { score: t }), l(A.find(([n]) => t >= n)[1])];
      return e.tag === "mvp" ? a.push(l("Best player of the winning team")) : e.tag === "ace" ? a.push(l("Best player of the losing team")) : e.rank && a.push(l("{place} of 10", { place: f(e.rank) })), a.join(" · ");
    }), g = 250 / 360 * 2 * Math.PI * i, k = (() => {
      const t = (a) => {
        const n = a * Math.PI / 180;
        return `${(20 + i * Math.cos(n)).toFixed(2)} ${(20 + i * Math.sin(n)).toFixed(2)}`;
      };
      return `M${t(145)}A${i} ${i} 0 1 1 ${t(395)}`;
    })();
    L();
    const y = D(e.score !== null && !P());
    F(
      () => e.score === null,
      (t) => {
        t || (y.value = !P());
      }
    );
    const M = r(() => Math.max(3, Math.min(100, e.score ?? 0)) / 100 * g);
    return (t, a) => (u(), d("span", {
      class: h(["iv-dial", [m.value, { sm: s.size === "sm", empty: s.score === null }]]),
      style: E({ "--c": z.value }),
      title: v.value,
      "aria-label": v.value,
      role: v.value ? "img" : void 0
    }, [
      (u(), d("svg", T, [
        b("path", {
          class: "iv-dial-track",
          d: w(k)
        }, null, 8, K),
        s.score !== null ? (u(), d("path", {
          key: 0,
          class: h(["iv-dial-arc", { still: y.value }]),
          d: w(k),
          "stroke-dasharray": `${M.value} ${g}`,
          style: E({ "--len": M.value })
        }, null, 14, U)) : x("", !0)
      ])),
      b("b", null, I(s.score ?? "–"), 1),
      s.size === "md" && p.value && s.score !== null ? (u(), d("small", {
        key: 0,
        class: h(["iv-dial-place", s.tag])
      }, I(p.value), 3)) : x("", !0)
    ], 14, O));
  }
});
export {
  Y as default
};
