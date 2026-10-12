import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
import { defineComponent as ae, useId as ue, shallowRef as P, computed as y, watchEffect as ie, onMounted as re, onBeforeUnmount as ve, openBlock as u, createElementBlock as i, createElementVNode as o, toDisplayString as s, unref as t, normalizeClass as G, createCommentVNode as m, createTextVNode as U, Fragment as H, renderList as ce, normalizeStyle as V, createVNode as Z } from "vue";
import { useInvadeUi as pe, useFormat as de } from "../context.js";
import { monotone as fe } from "../curve.js";
import { signedLp as K } from "../logic/format.js";
import { rankLabel as M, count as he, tierColor as W } from "../logic/labels.js";
import X from "./RankCrest.vue.js";
/* empty css               */
/* empty css                 */
/* empty css                       */
/* empty css                    */
const ye = { class: "iv-panel-head" }, me = {
  key: 0,
  class: "iv-seg sm"
}, ge = {
  key: 1,
  class: "meta"
}, xe = {
  key: 0,
  class: "iv-pf-lpg-read"
}, _e = { class: "iv-unit" }, ke = { key: 0 }, Me = { key: 1 }, Le = ["aria-label"], $e = ["viewBox"], be = { class: "iv-pf-lpg-guides" }, Ie = ["x2", "y1", "y2"], Re = ["x", "y"], we = ["d", "fill"], Ee = ["d"], Pe = ["x1", "x2"], Be = ["cx", "cy"], De = ["cx", "cy"], Ne = ["cx", "cy"], Se = { key: 0 }, Te = {
  key: 2,
  class: "iv-pf-note"
}, Ve = {
  key: 3,
  class: "iv-pf-facts"
}, Ce = { key: 0 }, ze = { key: 1 }, L = 128, Y = 14, Ae = 10, Fe = 64, je = /* @__PURE__ */ ae({
  __name: "LpGraph",
  props: {
    points: {},
    card: {}
  },
  setup(j) {
    const I = j, { t: a } = pe(), { date: J } = de(), C = `iv-lpg-${ue()}`, d = P("solo"), $ = y(() => ["solo", "flex"].filter((e) => I.points.some((l) => l.queue === e)));
    ie(() => {
      $.value.length && !$.value.includes(d.value) && (d.value = $.value[0]);
    });
    const f = y(() => I.points.filter((e) => e.queue === d.value)), R = y(() => f.value[f.value.length - 1]), x = y(() => d.value === "solo" ? I.card.solo : I.card.flex), g = P(300), B = P(null);
    let D;
    re(() => {
      D = new ResizeObserver(([e]) => {
        e.contentRect.width && (g.value = Math.round(e.contentRect.width));
      }), B.value && D.observe(B.value);
    }), ve(() => D?.disconnect());
    const Q = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND"], ee = ["IV", "III", "II", "I"];
    function le(e, l) {
      if (e > 2800) return `${e - 2800} ${a("LP")}`;
      if (e === 2800) return `${M({ tier: "MASTER", division: "", lp: 0 }, !1, a)}+`;
      const n = Q[Math.floor(e / 400)] ?? "IRON";
      return M({ tier: n, division: l ? "" : ee[Math.floor(e % 400 / 100)] ?? "IV", lp: 0 }, !1, a);
    }
    const c = y(() => {
      const e = f.value;
      if (e.length < 2) return null;
      const l = e.map((r) => r.value), n = Math.min(...l), k = Math.max(...l), z = Math.max(k - n, 60) * 0.3, T = Math.max(0, n - z), w = k + z, E = [100, 400, 800, 1600].find((r) => Math.floor(w / r) - Math.ceil(T / r) < 3) ?? 2800, A = g.value - Fe, ne = (r) => 2 + r * (A - 4) / (e.length - 1), F = (r) => Y + (w - r) * (L - Y - Ae) / (w - T), O = [];
      for (let r = Math.ceil(T / E) * E; r <= w; r += E) O.push({ y: F(r), name: le(r, E >= 400) });
      const b = e.map((r, se) => [ne(se), F(r.value)]), q = fe(b);
      return { right: A, guides: O, dots: b, line: q, area: `${q}L${b[b.length - 1][0].toFixed(1)} ${L}L${b[0][0].toFixed(1)} ${L}Z` };
    }), p = P(null), h = y(() => f.value.length - 1);
    function te(e) {
      const l = c.value;
      if (!l) return;
      const n = e.currentTarget.getBoundingClientRect(), k = (e.clientX - n.left) / n.width * g.value;
      p.value = Math.max(0, Math.min(h.value, Math.round((k - 2) / (l.right - 4) * h.value)));
    }
    function oe(e) {
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
        // Beside the point, on the side with room.
        style: n > c.value.right / 2 ? { right: `${g.value - n + 10}px` } : { left: `${n + 10}px` }
      };
    }), N = y(() => {
      const e = f.value;
      return e.length > 1 ? { lp: Math.round(e[e.length - 1].value - e[0].value), since: e[0].t } : null;
    }), _ = y(() => {
      const e = f.value;
      return e.length < 2 ? null : e.reduce((l, n) => n.value > l.value ? n : l);
    }), S = (e, l = !1) => J(e, { day: "numeric", month: "short", ...l ? { hour: "2-digit", minute: "2-digit" } : {} });
    return (e, l) => (u(), i("section", {
      ref_key: "box",
      ref: B,
      class: "iv-panel iv-pf-panel iv-pf-lpg"
    }, [
      o("header", ye, [
        o("h3", null, s(t(a)("LP history")), 1),
        $.value.length > 1 ? (u(), i("div", me, [
          o("button", {
            type: "button",
            class: G({ on: d.value === "solo" }),
            onClick: l[0] || (l[0] = (n) => d.value = "solo")
          }, s(t(a)("Solo/Duo")), 3),
          o("button", {
            type: "button",
            class: G({ on: d.value === "flex" }),
            onClick: l[1] || (l[1] = (n) => d.value = "flex")
          }, s(t(a)("Flex")), 3)
        ])) : $.value.length ? (u(), i("span", ge, s(d.value === "solo" ? t(a)("Solo/Duo") : t(a)("Flex")), 1)) : m("", !0)
      ]),
      R.value ? (u(), i("p", xe, [
        o("span", null, s(t(M)(R.value, !1, t(a))), 1),
        o("b", null, [
          U(s(R.value.lp), 1),
          o("span", _e, s(t(a)("LP")), 1)
        ]),
        N.value ? (u(), i("small", ke, s(t(K)(N.value.lp)) + " " + s(t(a)("LP")) + " · " + s(t(a)("since {date}", { date: S(N.value.since) })) + " · " + s(t(he)(f.value.length - 1, "changes", t(a))), 1)) : (u(), i("small", Me, s(S(R.value.t, !0)), 1))
      ])) : m("", !0),
      c.value ? (u(), i("div", {
        key: 1,
        class: "iv-pf-lpg-plot",
        tabindex: "0",
        role: "img",
        "aria-label": t(a)("LP history"),
        onKeydown: oe,
        onBlur: l[3] || (l[3] = (n) => p.value = null)
      }, [
        (u(), i("svg", {
          viewBox: `0 0 ${g.value} ${L}`,
          height: L,
          "aria-hidden": "true",
          onPointermove: te,
          onPointerleave: l[2] || (l[2] = (n) => p.value = null)
        }, [
          o("defs", null, [
            o("linearGradient", {
              id: C,
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
          o("g", be, [
            (u(!0), i(H, null, ce(c.value.guides, (n) => (u(), i(H, {
              key: n.y
            }, [
              o("line", {
                x1: "0",
                x2: g.value,
                y1: n.y,
                y2: n.y
              }, null, 8, Ie),
              o("text", {
                x: g.value,
                y: n.y - 4
              }, s(n.name), 9, Re)
            ], 64))), 128))
          ]),
          o("path", {
            d: c.value.area,
            fill: `url(#${C})`
          }, null, 8, we),
          o("path", {
            d: c.value.line,
            class: "iv-pf-lpg-line"
          }, null, 8, Ee),
          v.value ? (u(), i("line", {
            key: 0,
            x1: v.value.x,
            x2: v.value.x,
            y1: "0",
            y2: L,
            class: "iv-pf-lpg-cross"
          }, null, 8, Pe)) : m("", !0),
          o("circle", {
            cx: c.value.dots[h.value][0],
            cy: c.value.dots[h.value][1],
            r: "7",
            class: "iv-pf-lpg-halo"
          }, null, 8, Be),
          o("circle", {
            cx: c.value.dots[h.value][0],
            cy: c.value.dots[h.value][1],
            r: "3",
            class: "iv-pf-lpg-dot"
          }, null, 8, De),
          v.value ? (u(), i("circle", {
            key: 1,
            cx: v.value.x,
            cy: v.value.y,
            r: "3",
            class: "iv-pf-lpg-dot"
          }, null, 8, Ne)) : m("", !0)
        ], 40, $e)),
        v.value ? (u(), i("p", {
          key: 0,
          class: "iv-pf-lpg-tip",
          style: V(v.value.style)
        }, [
          o("span", null, s(S(v.value.point.t, !0)), 1),
          o("b", null, s(t(M)(v.value.point, !1, t(a))) + " " + s(v.value.point.lp) + " " + s(t(a)("LP")), 1),
          v.value.change !== null ? (u(), i("span", Se, s(t(K)(v.value.change)), 1)) : m("", !0)
        ], 4)) : m("", !0)
      ], 40, Le)) : (u(), i("p", Te, s(t(a)("Your LP history builds up as you play ranked games with Invade running.")), 1)),
      _.value || x.value?.previous ? (u(), i("dl", Ve, [
        _.value ? (u(), i("div", Ce, [
          o("dt", null, s(t(a)("Peak")), 1),
          o("dd", null, [
            Z(X, {
              tier: _.value.tier,
              size: 16
            }, null, 8, ["tier"]),
            o("b", {
              style: V({ color: t(W)(_.value.tier) })
            }, s(t(M)(_.value, !1, t(a))), 5),
            U(" " + s(_.value.lp) + " " + s(t(a)("LP")), 1)
          ])
        ])) : m("", !0),
        x.value?.previous ? (u(), i("div", ze, [
          o("dt", null, s(t(a)("Last season")), 1),
          o("dd", null, [
            Z(X, {
              tier: x.value.previous,
              size: 16
            }, null, 8, ["tier"]),
            o("b", {
              style: V({ color: t(W)(x.value.previous) })
            }, s(t(M)({ ...x.value, tier: x.value.previous, division: "" }, !1, t(a))), 5)
          ])
        ])) : m("", !0)
      ])) : m("", !0)
    ], 512));
  }
});
export {
  je as default
};
