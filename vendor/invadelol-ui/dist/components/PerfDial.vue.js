import '../styles/base.css';
import './PerfDial.css';
import { defineComponent as R, computed as l, openBlock as u, createElementBlock as d, normalizeStyle as M, normalizeClass as $, createElementVNode as E, unref as b, createCommentVNode as x, toDisplayString as P } from "vue";
import { tk as c } from "../logic/i18n.js";
import { useInvadeUi as D, useFormat as F } from "../context.js";
/* empty css                 */
const G = ["title", "aria-label", "role"], N = {
  viewBox: "0 0 40 40",
  "aria-hidden": "true"
}, V = ["d"], w = ["d", "stroke-dasharray"], L = 80, z = 90, i = 15, q = /* @__PURE__ */ R({
  __name: "PerfDial",
  props: {
    score: {},
    rank: { default: 0 },
    tag: { default: "" },
    size: { default: "md" }
  },
  setup(s) {
    const e = s, { t: n } = D(), { ordinal: h } = F(), o = [
      [12, [255, 93, 110]],
      [42, [134, 124, 200]],
      [76, [76, 155, 255]]
    ], m = l(() => e.score === null ? "" : e.score >= z ? "peak" : e.score >= L ? "gold" : ""), A = l(() => {
      const t = e.score ?? 0;
      if (m.value) return `var(--score-${m.value}-rgb)`;
      if (t <= o[0][0]) return o[0][1].join(" ");
      if (t >= o[2][0]) return o[2][1].join(" ");
      const [[a, r], [C, I]] = t < o[1][0] ? [o[0], o[1]] : [o[1], o[2]], S = (t - a) / (C - a);
      return r.map((y, j) => Math.round(y + (I[j] - y) * S)).join(" ");
    }), B = [
      [z, c("Exceptional game")],
      [70, c("Great game")],
      [52, c("Good game")],
      [30, c("Average game")],
      [0, c("Rough game")]
    ], f = l(() => e.tag === "mvp" ? n("MVP") : e.tag === "ace" ? n("ACE") : e.rank ? h(e.rank) : ""), v = l(() => {
      if (e.score === null) return;
      const t = e.score, a = [n("Invade score {score}", { score: t }), n(B.find(([r]) => t >= r)[1])];
      return e.tag === "mvp" ? a.push(n("Best player of the winning team")) : e.tag === "ace" ? a.push(n("Best player of the losing team")) : e.rank && a.push(n("{place} of 10", { place: h(e.rank) })), a.join(" · ");
    }), g = 250 / 360 * 2 * Math.PI * i, p = (() => {
      const t = (a) => {
        const r = a * Math.PI / 180;
        return `${(20 + i * Math.cos(r)).toFixed(2)} ${(20 + i * Math.sin(r)).toFixed(2)}`;
      };
      return `M${t(145)}A${i} ${i} 0 1 1 ${t(395)}`;
    })(), k = l(() => Math.max(3, Math.min(100, e.score ?? 0)) / 100 * g);
    return (t, a) => (u(), d("span", {
      class: $(["iv-dial", [m.value, { sm: s.size === "sm", empty: s.score === null }]]),
      style: M({ "--c": A.value }),
      title: v.value,
      "aria-label": v.value,
      role: v.value ? "img" : void 0
    }, [
      (u(), d("svg", N, [
        E("path", {
          class: "iv-dial-track",
          d: b(p)
        }, null, 8, V),
        s.score !== null ? (u(), d("path", {
          key: 0,
          class: "iv-dial-arc",
          d: b(p),
          "stroke-dasharray": `${k.value} ${g}`,
          style: M({ "--len": k.value })
        }, null, 12, w)) : x("", !0)
      ])),
      E("b", null, P(s.score ?? "–"), 1),
      s.size === "md" && f.value && s.score !== null ? (u(), d("small", {
        key: 0,
        class: $(["iv-dial-place", s.tag])
      }, P(f.value), 3)) : x("", !0)
    ], 14, G));
  }
});
export {
  q as default
};
