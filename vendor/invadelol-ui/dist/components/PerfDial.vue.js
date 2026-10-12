import '../styles/base.css';
import './PerfDial.css';
import { defineComponent as j, computed as i, openBlock as u, createElementBlock as m, normalizeStyle as y, normalizeClass as M, createElementVNode as $, unref as x, createCommentVNode as E, toDisplayString as b } from "vue";
import { tk as r } from "../logic/i18n.js";
import { useInvadeUi as A, useFormat as R } from "../context.js";
/* empty css                 */
const F = ["title", "aria-label", "role"], N = {
  viewBox: "0 0 40 40",
  "aria-hidden": "true"
}, V = ["d"], w = ["d", "stroke-dasharray"], c = 15, O = /* @__PURE__ */ j({
  __name: "PerfDial",
  props: {
    score: {},
    rank: { default: 0 },
    tag: { default: "" },
    size: { default: "md" }
  },
  setup(n) {
    const e = n, { t: s } = A(), { ordinal: h } = R(), o = [
      [25, [255, 93, 110]],
      [57, [134, 124, 200]],
      [92, [76, 155, 255]]
    ], z = i(() => {
      const t = e.score ?? 0;
      if (t <= o[0][0]) return o[0][1].join(" ");
      if (t >= o[2][0]) return o[2][1].join(" ");
      const [[a, l], [C, I]] = t < o[1][0] ? [o[0], o[1]] : [o[1], o[2]], P = (t - a) / (C - a);
      return l.map((k, S) => Math.round(k + (I[S] - k) * P)).join(" ");
    }), B = [
      [85, r("Exceptional game")],
      [70, r("Great game")],
      [55, r("Good game")],
      [40, r("Average game")],
      [0, r("Rough game")]
    ], f = i(() => e.tag === "mvp" ? s("MVP") : e.tag === "ace" ? s("ACE") : e.rank ? h(e.rank) : ""), d = i(() => {
      if (e.score === null) return;
      const t = e.score, a = [s("Invade score {score}", { score: t }), s(B.find(([l]) => t >= l)[1])];
      return e.tag === "mvp" ? a.push(s("Best player of the winning team")) : e.tag === "ace" ? a.push(s("Best player of the losing team")) : e.rank && a.push(s("{place} of 10", { place: h(e.rank) })), a.join(" · ");
    }), v = 250 / 360 * 2 * Math.PI * c, p = (() => {
      const t = (a) => {
        const l = a * Math.PI / 180;
        return `${(20 + c * Math.cos(l)).toFixed(2)} ${(20 + c * Math.sin(l)).toFixed(2)}`;
      };
      return `M${t(145)}A${c} ${c} 0 1 1 ${t(395)}`;
    })(), g = i(() => Math.max(3, Math.min(100, e.score ?? 0)) / 100 * v);
    return (t, a) => (u(), m("span", {
      class: M(["iv-dial", { sm: n.size === "sm", empty: n.score === null }]),
      style: y({ "--c": z.value }),
      title: d.value,
      "aria-label": d.value,
      role: d.value ? "img" : void 0
    }, [
      (u(), m("svg", N, [
        $("path", {
          class: "iv-dial-track",
          d: x(p)
        }, null, 8, V),
        n.score !== null ? (u(), m("path", {
          key: 0,
          class: "iv-dial-arc",
          d: x(p),
          "stroke-dasharray": `${g.value} ${v}`,
          style: y({ "--len": g.value })
        }, null, 12, w)) : E("", !0)
      ])),
      $("b", null, b(n.score ?? "–"), 1),
      n.size === "md" && f.value && n.score !== null ? (u(), m("small", {
        key: 0,
        class: M(["iv-dial-place", n.tag])
      }, b(f.value), 3)) : E("", !0)
    ], 14, F));
  }
});
export {
  O as default
};
