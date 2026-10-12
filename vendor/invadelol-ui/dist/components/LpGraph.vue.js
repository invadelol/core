import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
import { defineComponent as ve, useId as pe, shallowRef as M, computed as y, watchEffect as de, onMounted as fe, onBeforeUnmount as he, watchPostEffect as ye, openBlock as u, createElementBlock as i, createElementVNode as o, toDisplayString as n, unref as l, normalizeClass as Z, createCommentVNode as m, createTextVNode as K, Fragment as X, renderList as me, normalizeStyle as z, createVNode as Y } from "vue";
import { useInvadeUi as ge, useFormat as xe } from "../context.js";
import { monotone as _e } from "../curve.js";
import { signedLp as j } from "../logic/format.js";
import { rankLabel as L, count as ke, tierColor as J } from "../logic/labels.js";
import Q from "./RankCrest.vue.js";
/* empty css               */
/* empty css                 */
/* empty css                       */
/* empty css                    */
const Me = { class: "iv-panel-head" }, Le = {
  key: 0,
  class: "iv-seg sm"
}, be = {
  key: 1,
  class: "meta"
}, Ie = {
  key: 0,
  class: "iv-pf-lpg-read"
}, $e = { class: "iv-unit" }, we = { key: 0 }, Pe = { key: 1 }, Re = ["aria-label"], Ee = ["viewBox"], Be = { class: "iv-pf-lpg-guides" }, De = ["x2", "y1", "y2"], Ne = ["x", "y"], Te = ["d", "fill"], Se = ["d"], Ve = ["x1", "x2"], Ce = ["cx", "cy"], ze = ["cx", "cy"], Ae = ["cx", "cy"], Fe = { key: 0 }, Oe = {
  key: 2,
  class: "iv-pf-note"
}, qe = {
  key: 3,
  class: "iv-pf-facts"
}, Ge = { key: 0 }, Ue = { key: 1 }, b = 128, ee = 14, We = 10, He = 64, ot = /* @__PURE__ */ ve({
  __name: "LpGraph",
  props: {
    points: {},
    card: {}
  },
  setup(te) {
    const w = te, { t: s } = ge(), { date: le } = xe(), A = `iv-lpg-${pe()}`, d = M("solo"), I = y(() => ["solo", "flex"].filter((e) => w.points.some((t) => t.queue === e)));
    de(() => {
      I.value.length && !I.value.includes(d.value) && (d.value = I.value[0]);
    });
    const f = y(() => w.points.filter((e) => e.queue === d.value)), P = y(() => f.value[f.value.length - 1]), x = y(() => d.value === "solo" ? w.card.solo : w.card.flex), g = M(300), B = M(null);
    let D;
    fe(() => {
      D = new ResizeObserver(([e]) => {
        e.contentRect.width && (g.value = Math.round(e.contentRect.width));
      }), B.value && D.observe(B.value);
    }), he(() => D?.disconnect());
    const oe = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND"], ne = ["IV", "III", "II", "I"];
    function ae(e, t) {
      if (e > 2800) return `${e - 2800} ${s("LP")}`;
      if (e === 2800) return `${L({ tier: "MASTER", division: "", lp: 0 }, !1, s)}+`;
      const a = oe[Math.floor(e / 400)] ?? "IRON";
      return L({ tier: a, division: t ? "" : ne[Math.floor(e % 400 / 100)] ?? "IV", lp: 0 }, !1, s);
    }
    const v = y(() => {
      const e = f.value;
      if (e.length < 2) return null;
      const t = e.map((r) => r.value), a = Math.min(...t), k = Math.max(...t), q = Math.max(k - a, 60) * 0.3, C = Math.max(0, a - q), R = k + q, E = [100, 400, 800, 1600].find((r) => Math.floor(R / r) - Math.ceil(C / r) < 3) ?? 2800, G = g.value - He, re = (r) => 2 + r * (G - 4) / (e.length - 1), U = (r) => ee + (R - r) * (b - ee - We) / (R - C), W = [];
      for (let r = Math.ceil(C / E) * E; r <= R; r += E) W.push({ y: U(r), name: ae(r, E >= 400) });
      const $ = e.map((r, ce) => [re(ce), U(r.value)]), H = _e($);
      return { right: G, guides: W, dots: $, line: H, area: `${H}L${$[$.length - 1][0].toFixed(1)} ${b}L${$[0][0].toFixed(1)} ${b}Z` };
    }), p = M(null), h = y(() => f.value.length - 1);
    function F(e) {
      const t = v.value;
      if (!t) return;
      const a = e.currentTarget.getBoundingClientRect(), k = (e.clientX - a.left) / a.width * g.value;
      p.value = Math.max(0, Math.min(h.value, Math.round((k - 2) / (t.right - 4) * h.value)));
    }
    let O = !1;
    function se(e) {
      O = e.pointerType === "touch", F(e);
    }
    function ue() {
      O || (p.value = null);
    }
    function ie(e) {
      const t = p.value ?? h.value;
      if (e.key === "ArrowLeft") p.value = Math.max(0, t - 1);
      else if (e.key === "ArrowRight") p.value = Math.min(h.value, t + 1);
      else if (e.key === "Home") p.value = 0;
      else if (e.key === "End") p.value = h.value;
      else if (e.key === "Escape") p.value = null;
      else return;
      e.preventDefault();
    }
    const c = y(() => {
      const e = p.value, t = f.value[e ?? -1];
      if (e === null || !t || !v.value) return null;
      const [a, k] = v.value.dots[e];
      return {
        point: t,
        x: a,
        y: k,
        change: e > 0 ? Math.round(t.value - f.value[e - 1].value) : null,
        // Beside the point, on the side with room, and never past the graph's edges.
        style: { left: `${Math.max(0, Math.min(a > v.value.right / 2 ? a - T.value - 10 : a + 10, g.value - T.value))}px` }
      };
    }), N = M(null), T = M(0);
    ye(() => {
      c.value && N.value && (T.value = N.value.offsetWidth);
    });
    const S = y(() => {
      const e = f.value;
      return e.length > 1 ? { lp: Math.round(e[e.length - 1].value - e[0].value), since: e[0].t } : null;
    }), _ = y(() => {
      const e = f.value;
      return e.length < 2 ? null : e.reduce((t, a) => a.value > t.value ? a : t);
    }), V = (e, t = !1) => le(e, { day: "numeric", month: "short", ...t ? { hour: "2-digit", minute: "2-digit" } : {} });
    return (e, t) => (u(), i("section", {
      ref_key: "box",
      ref: B,
      class: "iv-panel iv-pf-panel iv-pf-lpg"
    }, [
      o("header", Me, [
        o("h3", null, n(l(s)("LP history")), 1),
        I.value.length > 1 ? (u(), i("div", Le, [
          o("button", {
            type: "button",
            class: Z({ on: d.value === "solo" }),
            onClick: t[0] || (t[0] = (a) => d.value = "solo")
          }, n(l(s)("Solo/Duo")), 3),
          o("button", {
            type: "button",
            class: Z({ on: d.value === "flex" }),
            onClick: t[1] || (t[1] = (a) => d.value = "flex")
          }, n(l(s)("Flex")), 3)
        ])) : I.value.length ? (u(), i("span", be, n(d.value === "solo" ? l(s)("Solo/Duo") : l(s)("Flex")), 1)) : m("", !0)
      ]),
      P.value ? (u(), i("p", Ie, [
        o("span", null, n(l(L)(P.value, !1, l(s))), 1),
        o("b", null, [
          K(n(P.value.lp), 1),
          o("span", $e, n(l(s)("LP")), 1)
        ]),
        S.value ? (u(), i("small", we, n(l(j)(S.value.lp)) + " " + n(l(s)("LP")) + " · " + n(l(s)("since {date}", { date: V(S.value.since) })) + " · " + n(l(ke)(f.value.length - 1, "changes", l(s))), 1)) : (u(), i("small", Pe, n(V(P.value.t, !0)), 1))
      ])) : m("", !0),
      v.value ? (u(), i("div", {
        key: 1,
        class: "iv-pf-lpg-plot",
        tabindex: "0",
        role: "img",
        "aria-label": l(s)("LP history"),
        onKeydown: ie,
        onBlur: t[2] || (t[2] = (a) => p.value = null)
      }, [
        (u(), i("svg", {
          viewBox: `0 0 ${g.value} ${b}`,
          height: b,
          "aria-hidden": "true",
          onPointerdown: se,
          onPointermove: F,
          onPointerleave: ue
        }, [
          o("defs", null, [
            o("linearGradient", {
              id: A,
              x1: "0",
              x2: "0",
              y1: "0",
              y2: "1"
            }, [...t[3] || (t[3] = [
              o("stop", {
                offset: "0",
                "stop-color": "var(--brand)",
                "stop-opacity": "0.12"
              }, null, -1),
              o("stop", {
                offset: "1",
                "stop-color": "var(--brand)",
                "stop-opacity": "0"
              }, null, -1)
            ])])
          ]),
          o("g", Be, [
            (u(!0), i(X, null, me(v.value.guides, (a) => (u(), i(X, {
              key: a.y
            }, [
              o("line", {
                x1: "0",
                x2: g.value,
                y1: a.y,
                y2: a.y
              }, null, 8, De),
              o("text", {
                x: g.value,
                y: a.y - 4
              }, n(a.name), 9, Ne)
            ], 64))), 128))
          ]),
          o("path", {
            d: v.value.area,
            fill: `url(#${A})`
          }, null, 8, Te),
          o("path", {
            d: v.value.line,
            class: "iv-pf-lpg-line"
          }, null, 8, Se),
          c.value ? (u(), i("line", {
            key: 0,
            x1: c.value.x,
            x2: c.value.x,
            y1: "0",
            y2: b,
            class: "iv-pf-lpg-cross"
          }, null, 8, Ve)) : m("", !0),
          o("circle", {
            cx: v.value.dots[h.value][0],
            cy: v.value.dots[h.value][1],
            r: "7",
            class: "iv-pf-lpg-halo"
          }, null, 8, Ce),
          o("circle", {
            cx: v.value.dots[h.value][0],
            cy: v.value.dots[h.value][1],
            r: "3",
            class: "iv-pf-lpg-dot"
          }, null, 8, ze),
          c.value ? (u(), i("circle", {
            key: 1,
            cx: c.value.x,
            cy: c.value.y,
            r: "3",
            class: "iv-pf-lpg-dot"
          }, null, 8, Ae)) : m("", !0)
        ], 40, Ee)),
        c.value ? (u(), i("p", {
          key: 0,
          ref_key: "tip",
          ref: N,
          class: "iv-pf-lpg-tip",
          style: z(c.value.style)
        }, [
          o("span", null, n(V(c.value.point.t, !0)), 1),
          o("b", null, n(l(L)(c.value.point, !1, l(s))) + " " + n(c.value.point.lp) + " " + n(l(s)("LP")), 1),
          c.value.change !== null ? (u(), i("span", Fe, n(l(j)(c.value.change)), 1)) : m("", !0)
        ], 4)) : m("", !0)
      ], 40, Re)) : (u(), i("p", Oe, n(l(s)("Your LP history builds up as you play ranked games with Invade running.")), 1)),
      _.value || x.value?.previous ? (u(), i("dl", qe, [
        _.value ? (u(), i("div", Ge, [
          o("dt", null, n(l(s)("Peak")), 1),
          o("dd", null, [
            Y(Q, {
              tier: _.value.tier,
              size: 16
            }, null, 8, ["tier"]),
            o("b", {
              style: z({ color: l(J)(_.value.tier) })
            }, n(l(L)(_.value, !1, l(s))), 5),
            K(" " + n(_.value.lp) + " " + n(l(s)("LP")), 1)
          ])
        ])) : m("", !0),
        x.value?.previous ? (u(), i("div", Ue, [
          o("dt", null, n(l(s)("Last season")), 1),
          o("dd", null, [
            Y(Q, {
              tier: x.value.previous,
              size: 16
            }, null, 8, ["tier"]),
            o("b", {
              style: z({ color: l(J)(x.value.previous) })
            }, n(l(L)({ ...x.value, tier: x.value.previous, division: "" }, !1, l(s))), 5)
          ])
        ])) : m("", !0)
      ])) : m("", !0)
    ], 512));
  }
});
export {
  ot as default
};
