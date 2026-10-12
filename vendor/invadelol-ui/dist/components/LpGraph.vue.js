import { defineComponent as ee, useId as le, shallowRef as E, computed as y, watchEffect as te, onMounted as oe, onBeforeUnmount as ne, openBlock as u, createElementBlock as i, createElementVNode as t, toDisplayString as s, unref as o, normalizeClass as w, createCommentVNode as k, Fragment as M, normalizeStyle as P, createTextVNode as C, renderList as se, createVNode as U } from "vue";
import { useInvadeUi as ae, useFormat as ue } from "../context.js";
import { signedLp as W } from "../logic/format.js";
import { tierColor as N, rankLabel as L, count as ie } from "../logic/labels.js";
import Z from "./RankCrest.vue.js";
/* empty css               */
const re = { class: "iv-panel-head" }, ce = {
  key: 0,
  class: "iv-seg sm"
}, ve = {
  key: 1,
  class: "meta"
}, de = { class: "iv-pf-lpg-read" }, pe = { class: "iv-unit" }, fe = { class: "iv-unit" }, he = ["viewBox", "aria-label"], ye = { class: "iv-pf-lpg-grid" }, me = ["x2", "y1", "y2"], ge = ["y"], xe = ["d", "fill"], _e = ["d"], ke = ["x1", "x2", "y2"], Me = ["cx", "cy"], be = ["cx", "cy"], Ie = {
  key: 1,
  class: "iv-pf-note"
}, Le = {
  key: 2,
  class: "iv-pf-facts"
}, $e = { key: 0 }, Re = { key: 1 }, $ = 132, O = 14, S = 6, Ve = /* @__PURE__ */ ee({
  __name: "LpGraph",
  props: {
    points: {},
    card: {}
  },
  setup(H) {
    const R = H, { t: a } = ae(), { date: X } = ue(), A = `iv-lpg-${le()}`, v = E("solo"), b = y(() => ["solo", "flex"].filter((e) => R.points.filter((l) => l.queue === e).length > 1));
    te(() => {
      b.value.length && !b.value.includes(v.value) && (v.value = b.value[0]);
    });
    const m = y(() => R.points.filter((e) => e.queue === v.value)), g = y(() => v.value === "solo" ? R.card.solo : R.card.flex), x = E(300), D = E(null);
    let V;
    oe(() => {
      V = new ResizeObserver(([e]) => {
        e.contentRect.width && (x.value = Math.round(e.contentRect.width));
      }), D.value && V.observe(D.value);
    }), ne(() => V?.disconnect());
    const Y = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND"], j = ["IV", "III", "II", "I"];
    function J(e) {
      if (e >= 2800) return { tier: "MASTER", name: `${L({ tier: "MASTER", division: "", lp: 0 }, !1, a)}+` };
      const l = Y[Math.floor(e / 400)] ?? "IRON", n = j[Math.floor(e % 400 / 100)] ?? "IV";
      return { tier: l, name: L({ tier: l, division: n, lp: 0 }, !1, a) };
    }
    const c = y(() => {
      const e = m.value;
      if (e.length < 2) return null;
      const l = e.map((r) => r.value), n = Math.max(0, Math.floor((Math.min(...l) - 10) / 100) * 100);
      let f = Math.ceil((Math.max(...l) + 10) / 100) * 100;
      f - n < 200 && (f = n + 200);
      const B = f - n > 800 ? 400 : 100, F = (r) => 4 + r * (x.value - 8) / (e.length - 1), T = (r) => O + (f - r) * ($ - O - S) / (f - n);
      let z = "";
      e.forEach((r, h) => z += `${h ? "L" : "M"}${F(h).toFixed(1)} ${T(r.value).toFixed(1)}`);
      const G = [];
      for (let r = Math.ceil(n / B) * B; r < f; r += B) {
        const h = J(r);
        G.push({ y: T(r), label: h.name, color: N(h.tier) });
      }
      const Q = `${z}L${F(e.length - 1).toFixed(1)} ${$ - S}L4 ${$ - S}Z`;
      return { line: z, area: Q, grid: G, dots: e.map((r, h) => ({ x: F(h), y: T(r.value) })) };
    }), p = E(null);
    function K(e) {
      const l = e.currentTarget, n = m.value.length;
      if (n < 2) return;
      const f = e.offsetX / l.clientWidth * x.value;
      p.value = Math.max(0, Math.min(n - 1, Math.round((f - 4) / (x.value - 8) * (n - 1))));
    }
    const d = y(() => {
      const e = m.value, l = p.value;
      return l === null || !e[l] ? null : { point: e[l], change: l > 0 ? Math.round(e[l].value - e[l - 1].value) : null };
    }), I = y(() => {
      const e = m.value;
      return e.length > 1 ? { lp: Math.round(e[e.length - 1].value - e[0].value), since: e[0].t } : null;
    }), _ = y(() => {
      const e = m.value;
      return e.length < 2 ? null : e.reduce((l, n) => n.value > l.value ? n : l);
    }), q = (e, l = !1) => X(e, { day: "numeric", month: "short", ...l ? { hour: "2-digit", minute: "2-digit" } : {} });
    return (e, l) => (u(), i("section", {
      ref_key: "box",
      ref: D,
      class: "iv-panel iv-pf-panel iv-pf-lpg"
    }, [
      t("header", re, [
        t("h3", null, s(o(a)("LP history")), 1),
        b.value.length > 1 ? (u(), i("div", ce, [
          t("button", {
            type: "button",
            class: w({ on: v.value === "solo" }),
            onClick: l[0] || (l[0] = (n) => v.value = "solo")
          }, s(o(a)("Solo/Duo")), 3),
          t("button", {
            type: "button",
            class: w({ on: v.value === "flex" }),
            onClick: l[1] || (l[1] = (n) => v.value = "flex")
          }, s(o(a)("Flex")), 3)
        ])) : b.value.length ? (u(), i("span", ve, s(v.value === "solo" ? o(a)("Solo/Duo") : o(a)("Flex")), 1)) : k("", !0)
      ]),
      c.value ? (u(), i(M, { key: 0 }, [
        t("p", de, [
          d.value ? (u(), i(M, { key: 0 }, [
            t("b", {
              style: P({ color: o(N)(d.value.point.tier) })
            }, s(o(L)(d.value.point, !1, o(a))), 5),
            t("span", null, [
              C(s(d.value.point.lp), 1),
              t("span", pe, s(o(a)("LP")), 1)
            ]),
            d.value.change !== null ? (u(), i("span", {
              key: 0,
              class: w(["iv-pf-delta", d.value.change > 0 ? "up" : d.value.change < 0 ? "down" : ""])
            }, s(o(W)(d.value.change)), 3)) : k("", !0),
            t("small", null, s(q(d.value.point.t, !0)), 1)
          ], 64)) : I.value ? (u(), i(M, { key: 1 }, [
            t("span", {
              class: w(["iv-pf-delta", I.value.lp > 0 ? "up" : I.value.lp < 0 ? "down" : ""])
            }, [
              C(s(o(W)(I.value.lp)), 1),
              t("span", fe, s(o(a)("LP")), 1)
            ], 2),
            t("small", null, s(o(a)("since {date}", { date: q(I.value.since) })) + " · " + s(o(ie)(m.value.length - 1, "changes", o(a))), 1)
          ], 64)) : k("", !0)
        ]),
        (u(), i("svg", {
          class: "iv-pf-lpg-svg",
          viewBox: `0 0 ${x.value} ${$}`,
          role: "img",
          "aria-label": o(a)("LP history"),
          onPointermove: K,
          onPointerleave: l[2] || (l[2] = (n) => p.value = null)
        }, [
          t("defs", null, [
            t("linearGradient", {
              id: A,
              x1: "0",
              x2: "0",
              y1: "0",
              y2: "1"
            }, [...l[3] || (l[3] = [
              t("stop", {
                offset: "0",
                "stop-color": "var(--brand)",
                "stop-opacity": "0.16"
              }, null, -1),
              t("stop", {
                offset: "1",
                "stop-color": "var(--brand)",
                "stop-opacity": "0"
              }, null, -1)
            ])])
          ]),
          t("g", ye, [
            (u(!0), i(M, null, se(c.value.grid, (n) => (u(), i(M, {
              key: n.y
            }, [
              t("line", {
                x1: "0",
                x2: x.value,
                y1: n.y,
                y2: n.y
              }, null, 8, me),
              t("text", {
                x: "0",
                y: n.y - 4,
                style: P({ fill: n.color })
              }, s(n.label), 13, ge)
            ], 64))), 128))
          ]),
          t("path", {
            d: c.value.area,
            fill: `url(#${A})`
          }, null, 8, xe),
          t("path", {
            d: c.value.line,
            class: "iv-pf-lpg-line"
          }, null, 8, _e),
          p.value !== null ? (u(), i(M, { key: 0 }, [
            t("line", {
              x1: c.value.dots[p.value].x,
              x2: c.value.dots[p.value].x,
              y1: O,
              y2: $ - S,
              class: "iv-pf-lpg-cross"
            }, null, 8, ke),
            t("circle", {
              cx: c.value.dots[p.value].x,
              cy: c.value.dots[p.value].y,
              r: "3.5",
              class: "iv-pf-lpg-dot"
            }, null, 8, Me)
          ], 64)) : (u(), i("circle", {
            key: 1,
            cx: c.value.dots[c.value.dots.length - 1].x,
            cy: c.value.dots[c.value.dots.length - 1].y,
            r: "3",
            class: "iv-pf-lpg-dot"
          }, null, 8, be))
        ], 40, he))
      ], 64)) : (u(), i("p", Ie, s(o(a)("Your LP history builds up as you play ranked games with Invade running.")), 1)),
      _.value || g.value?.previous ? (u(), i("dl", Le, [
        _.value ? (u(), i("div", $e, [
          t("dt", null, s(o(a)("Peak")), 1),
          t("dd", null, [
            U(Z, {
              tier: _.value.tier,
              size: 16
            }, null, 8, ["tier"]),
            t("b", {
              style: P({ color: o(N)(_.value.tier) })
            }, s(o(L)(_.value, !1, o(a))), 5),
            C(" " + s(_.value.lp) + " " + s(o(a)("LP")), 1)
          ])
        ])) : k("", !0),
        g.value?.previous ? (u(), i("div", Re, [
          t("dt", null, s(o(a)("Last season")), 1),
          t("dd", null, [
            U(Z, {
              tier: g.value.previous,
              size: 16
            }, null, 8, ["tier"]),
            t("b", {
              style: P({ color: o(N)(g.value.previous) })
            }, s(o(L)({ ...g.value, tier: g.value.previous, division: "" }, !1, o(a))), 5)
          ])
        ])) : k("", !0)
      ])) : k("", !0)
    ], 512));
  }
});
export {
  Ve as default
};
