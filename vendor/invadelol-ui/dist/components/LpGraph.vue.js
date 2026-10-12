import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
import { defineComponent as ie, useId as re, shallowRef as M, computed as y, watchEffect as ve, onMounted as ce, onBeforeUnmount as pe, watchPostEffect as de, openBlock as u, createElementBlock as i, createElementVNode as o, toDisplayString as a, unref as t, normalizeClass as W, createCommentVNode as m, createTextVNode as H, Fragment as Z, renderList as fe, normalizeStyle as z, createVNode as K } from "vue";
import { useInvadeUi as he, useFormat as ye } from "../context.js";
import { monotone as me } from "../curve.js";
import { signedLp as X } from "../logic/format.js";
import { rankLabel as L, count as ge, tierColor as Y } from "../logic/labels.js";
import j from "./RankCrest.vue.js";
/* empty css               */
/* empty css                 */
/* empty css                       */
/* empty css                    */
const xe = { class: "iv-panel-head" }, _e = {
  key: 0,
  class: "iv-seg sm"
}, ke = {
  key: 1,
  class: "meta"
}, Me = {
  key: 0,
  class: "iv-pf-lpg-read"
}, Le = { class: "iv-unit" }, be = { key: 0 }, Ie = { key: 1 }, $e = ["aria-label"], we = ["viewBox"], Re = { class: "iv-pf-lpg-guides" }, Ee = ["x2", "y1", "y2"], Pe = ["x", "y"], Be = ["d", "fill"], De = ["d"], Ne = ["x1", "x2"], Se = ["cx", "cy"], Te = ["cx", "cy"], Ve = ["cx", "cy"], Ce = { key: 0 }, ze = {
  key: 2,
  class: "iv-pf-note"
}, Ae = {
  key: 3,
  class: "iv-pf-facts"
}, Fe = { key: 0 }, Oe = { key: 1 }, b = 128, J = 14, qe = 10, Ge = 64, el = /* @__PURE__ */ ie({
  __name: "LpGraph",
  props: {
    points: {},
    card: {}
  },
  setup(Q) {
    const w = Q, { t: s } = he(), { date: ee } = ye(), A = `iv-lpg-${re()}`, d = M("solo"), I = y(() => ["solo", "flex"].filter((e) => w.points.some((l) => l.queue === e)));
    ve(() => {
      I.value.length && !I.value.includes(d.value) && (d.value = I.value[0]);
    });
    const f = y(() => w.points.filter((e) => e.queue === d.value)), R = y(() => f.value[f.value.length - 1]), x = y(() => d.value === "solo" ? w.card.solo : w.card.flex), g = M(300), B = M(null);
    let D;
    ce(() => {
      D = new ResizeObserver(([e]) => {
        e.contentRect.width && (g.value = Math.round(e.contentRect.width));
      }), B.value && D.observe(B.value);
    }), pe(() => D?.disconnect());
    const le = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND"], te = ["IV", "III", "II", "I"];
    function oe(e, l) {
      if (e > 2800) return `${e - 2800} ${s("LP")}`;
      if (e === 2800) return `${L({ tier: "MASTER", division: "", lp: 0 }, !1, s)}+`;
      const n = le[Math.floor(e / 400)] ?? "IRON";
      return L({ tier: n, division: l ? "" : te[Math.floor(e % 400 / 100)] ?? "IV", lp: 0 }, !1, s);
    }
    const c = y(() => {
      const e = f.value;
      if (e.length < 2) return null;
      const l = e.map((r) => r.value), n = Math.min(...l), k = Math.max(...l), F = Math.max(k - n, 60) * 0.3, C = Math.max(0, n - F), E = k + F, P = [100, 400, 800, 1600].find((r) => Math.floor(E / r) - Math.ceil(C / r) < 3) ?? 2800, O = g.value - Ge, se = (r) => 2 + r * (O - 4) / (e.length - 1), q = (r) => J + (E - r) * (b - J - qe) / (E - C), G = [];
      for (let r = Math.ceil(C / P) * P; r <= E; r += P) G.push({ y: q(r), name: oe(r, P >= 400) });
      const $ = e.map((r, ue) => [se(ue), q(r.value)]), U = me($);
      return { right: O, guides: G, dots: $, line: U, area: `${U}L${$[$.length - 1][0].toFixed(1)} ${b}L${$[0][0].toFixed(1)} ${b}Z` };
    }), p = M(null), h = y(() => f.value.length - 1);
    function ne(e) {
      const l = c.value;
      if (!l) return;
      const n = e.currentTarget.getBoundingClientRect(), k = (e.clientX - n.left) / n.width * g.value;
      p.value = Math.max(0, Math.min(h.value, Math.round((k - 2) / (l.right - 4) * h.value)));
    }
    function ae(e) {
      const l = p.value ?? h.value;
      if (e.key === "ArrowLeft") p.value = Math.max(0, l - 1);
      else if (e.key === "ArrowRight") p.value = Math.min(h.value, l + 1);
      else if (e.key === "Home") p.value = 0;
      else if (e.key === "End") p.value = h.value;
      else if (e.key === "Escape") p.value = null;
      else return;
      e.preventDefault();
    }
    const v = y(() => {
      const e = p.value, l = f.value[e ?? -1];
      if (e === null || !l || !c.value) return null;
      const [n, k] = c.value.dots[e];
      return {
        point: l,
        x: n,
        y: k,
        change: e > 0 ? Math.round(l.value - f.value[e - 1].value) : null,
        // Beside the point, on the side with room, and never past the graph's edges.
        style: { left: `${Math.max(0, Math.min(n > c.value.right / 2 ? n - S.value - 10 : n + 10, g.value - S.value))}px` }
      };
    }), N = M(null), S = M(0);
    de(() => {
      v.value && N.value && (S.value = N.value.offsetWidth);
    });
    const T = y(() => {
      const e = f.value;
      return e.length > 1 ? { lp: Math.round(e[e.length - 1].value - e[0].value), since: e[0].t } : null;
    }), _ = y(() => {
      const e = f.value;
      return e.length < 2 ? null : e.reduce((l, n) => n.value > l.value ? n : l);
    }), V = (e, l = !1) => ee(e, { day: "numeric", month: "short", ...l ? { hour: "2-digit", minute: "2-digit" } : {} });
    return (e, l) => (u(), i("section", {
      ref_key: "box",
      ref: B,
      class: "iv-panel iv-pf-panel iv-pf-lpg"
    }, [
      o("header", xe, [
        o("h3", null, a(t(s)("LP history")), 1),
        I.value.length > 1 ? (u(), i("div", _e, [
          o("button", {
            type: "button",
            class: W({ on: d.value === "solo" }),
            onClick: l[0] || (l[0] = (n) => d.value = "solo")
          }, a(t(s)("Solo/Duo")), 3),
          o("button", {
            type: "button",
            class: W({ on: d.value === "flex" }),
            onClick: l[1] || (l[1] = (n) => d.value = "flex")
          }, a(t(s)("Flex")), 3)
        ])) : I.value.length ? (u(), i("span", ke, a(d.value === "solo" ? t(s)("Solo/Duo") : t(s)("Flex")), 1)) : m("", !0)
      ]),
      R.value ? (u(), i("p", Me, [
        o("span", null, a(t(L)(R.value, !1, t(s))), 1),
        o("b", null, [
          H(a(R.value.lp), 1),
          o("span", Le, a(t(s)("LP")), 1)
        ]),
        T.value ? (u(), i("small", be, a(t(X)(T.value.lp)) + " " + a(t(s)("LP")) + " · " + a(t(s)("since {date}", { date: V(T.value.since) })) + " · " + a(t(ge)(f.value.length - 1, "changes", t(s))), 1)) : (u(), i("small", Ie, a(V(R.value.t, !0)), 1))
      ])) : m("", !0),
      c.value ? (u(), i("div", {
        key: 1,
        class: "iv-pf-lpg-plot",
        tabindex: "0",
        role: "img",
        "aria-label": t(s)("LP history"),
        onKeydown: ae,
        onBlur: l[3] || (l[3] = (n) => p.value = null)
      }, [
        (u(), i("svg", {
          viewBox: `0 0 ${g.value} ${b}`,
          height: b,
          "aria-hidden": "true",
          onPointermove: ne,
          onPointerleave: l[2] || (l[2] = (n) => p.value = null)
        }, [
          o("defs", null, [
            o("linearGradient", {
              id: A,
              x1: "0",
              x2: "0",
              y1: "0",
              y2: "1"
            }, [...l[4] || (l[4] = [
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
          o("g", Re, [
            (u(!0), i(Z, null, fe(c.value.guides, (n) => (u(), i(Z, {
              key: n.y
            }, [
              o("line", {
                x1: "0",
                x2: g.value,
                y1: n.y,
                y2: n.y
              }, null, 8, Ee),
              o("text", {
                x: g.value,
                y: n.y - 4
              }, a(n.name), 9, Pe)
            ], 64))), 128))
          ]),
          o("path", {
            d: c.value.area,
            fill: `url(#${A})`
          }, null, 8, Be),
          o("path", {
            d: c.value.line,
            class: "iv-pf-lpg-line"
          }, null, 8, De),
          v.value ? (u(), i("line", {
            key: 0,
            x1: v.value.x,
            x2: v.value.x,
            y1: "0",
            y2: b,
            class: "iv-pf-lpg-cross"
          }, null, 8, Ne)) : m("", !0),
          o("circle", {
            cx: c.value.dots[h.value][0],
            cy: c.value.dots[h.value][1],
            r: "7",
            class: "iv-pf-lpg-halo"
          }, null, 8, Se),
          o("circle", {
            cx: c.value.dots[h.value][0],
            cy: c.value.dots[h.value][1],
            r: "3",
            class: "iv-pf-lpg-dot"
          }, null, 8, Te),
          v.value ? (u(), i("circle", {
            key: 1,
            cx: v.value.x,
            cy: v.value.y,
            r: "3",
            class: "iv-pf-lpg-dot"
          }, null, 8, Ve)) : m("", !0)
        ], 40, we)),
        v.value ? (u(), i("p", {
          key: 0,
          ref_key: "tip",
          ref: N,
          class: "iv-pf-lpg-tip",
          style: z(v.value.style)
        }, [
          o("span", null, a(V(v.value.point.t, !0)), 1),
          o("b", null, a(t(L)(v.value.point, !1, t(s))) + " " + a(v.value.point.lp) + " " + a(t(s)("LP")), 1),
          v.value.change !== null ? (u(), i("span", Ce, a(t(X)(v.value.change)), 1)) : m("", !0)
        ], 4)) : m("", !0)
      ], 40, $e)) : (u(), i("p", ze, a(t(s)("Your LP history builds up as you play ranked games with Invade running.")), 1)),
      _.value || x.value?.previous ? (u(), i("dl", Ae, [
        _.value ? (u(), i("div", Fe, [
          o("dt", null, a(t(s)("Peak")), 1),
          o("dd", null, [
            K(j, {
              tier: _.value.tier,
              size: 16
            }, null, 8, ["tier"]),
            o("b", {
              style: z({ color: t(Y)(_.value.tier) })
            }, a(t(L)(_.value, !1, t(s))), 5),
            H(" " + a(_.value.lp) + " " + a(t(s)("LP")), 1)
          ])
        ])) : m("", !0),
        x.value?.previous ? (u(), i("div", Oe, [
          o("dt", null, a(t(s)("Last season")), 1),
          o("dd", null, [
            K(j, {
              tier: x.value.previous,
              size: 16
            }, null, 8, ["tier"]),
            o("b", {
              style: z({ color: t(Y)(x.value.previous) })
            }, a(t(L)({ ...x.value, tier: x.value.previous, division: "" }, !1, t(s))), 5)
          ])
        ])) : m("", !0)
      ])) : m("", !0)
    ], 512));
  }
});
export {
  el as default
};
