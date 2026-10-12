import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
import { defineComponent as Ue, useId as Ke, shallowRef as O, computed as g, watch as We, onMounted as Ze, onBeforeUnmount as qe, openBlock as i, createElementBlock as c, createElementVNode as n, toDisplayString as r, unref as v, Fragment as w, normalizeClass as L, createCommentVNode as P, renderList as E, normalizeStyle as z, createVNode as Je, createTextVNode as Qe } from "vue";
import { useInvadeUi as et, useFormat as tt, useNames as lt } from "../context.js";
import { relation as he } from "../logic/detail.js";
import { tk as pe } from "../logic/i18n.js";
import { leadFor as nt, storyOf as at } from "../logic/story.js";
import st from "./ObjectiveIcon.vue.js";
/* empty css                 */
/* empty css                       */
/* empty css                   */
const ot = { class: "iv-gch" }, ut = { class: "iv-gch-head" }, it = {
  class: "iv-gch-read",
  "aria-live": "polite"
}, ct = { class: "iv-gch-when" }, vt = { class: "iv-gch-who" }, rt = { class: "iv-gch-unit" }, dt = { class: "iv-seg sm" }, ht = ["onClick"], pt = { class: "iv-gch-main" }, mt = ["aria-label"], yt = ["viewBox"], xt = { class: "iv-gch-grid" }, _t = ["x2", "y1", "y2"], ft = ["x", "y"], gt = ["x1", "x2", "y2"], kt = ["x"], bt = ["x"], wt = ["d"], $t = {
  key: 0,
  class: "iv-gch-lead"
}, Mt = ["id"], It = ["width", "height"], Ct = ["id"], Lt = ["y", "width", "height"], Nt = ["x", "y"], Pt = ["x", "y"], Et = ["d", "clip-path"], Tt = ["d", "clip-path"], At = ["x2", "y1", "y2"], St = ["d"], zt = { key: 1 }, Bt = ["x1", "x2", "y2"], Ft = ["cx", "cy", "r"], Rt = ["cx", "cy"], Yt = ["title"], Dt = ["src", "title", "onPointerenter", "onClick"], Ot = { class: "iv-gch-tip-who" }, jt = ["src"], Ht = { class: "iv-gch-tip-v" }, Vt = { class: "iv-gch-tip-place" }, Xt = {
  key: 0,
  class: "iv-gch-tip-row"
}, Gt = {
  key: 1,
  class: "iv-gch-tip-row"
}, Ut = { class: "iv-gch-tip-time" }, Kt = ["aria-pressed", "onPointerenter", "onFocus", "onClick"], Wt = ["src"], Zt = { class: "iv-gch-name" }, qt = { class: "iv-gch-hint" }, Jt = { class: "iv-gch-hint-mouse" }, Qt = { class: "iv-gch-hint-touch" }, b = 40, B = 30, F = 10, W = 236, R = 56, cl = /* @__PURE__ */ Ue({
  __name: "GoldChart",
  props: {
    detail: {},
    timeline: {},
    selected: {},
    me: {}
  },
  setup(V) {
    const f = V, { t: d } = et(), { compact: Te, mmss: j, num: Z, signedGold: Ae } = tt(), { champIcon: ne, champName: X } = lt(), q = Ke(), me = [
      { id: "gold", label: pe("Gold") },
      { id: "xp", label: pe("XP") },
      { id: "cs", label: pe("CS") }
    ], $ = O("gold"), y = g(() => f.detail.players), Y = g(() => f.me?.teamId ?? y.value[0]?.teamId ?? 100), ae = g(() => {
      const t = new Set(y.value.map((l) => l.teamId));
      return t.size === 2 && t.has(100) && t.has(200);
    }), H = g(() => y.value.map((t, l) => f.timeline[$.value][l] ?? [])), k = g(() => f.timeline.t), J = g(() => Math.max(0, k.value.length - 1)), se = (t) => $.value === "cs" ? Z(Math.round(t)) : Te(Math.round(t)), oe = (t) => $.value === "cs" ? `${t > 0 ? "+" : t < 0 ? "−" : ""}${Z(Math.abs(Math.round(t)))}` : Ae(Math.round(t)), ye = (t) => $.value !== "cs" && Math.abs(t) >= 1e3 && t % 1e3 === 0 ? `${Z(t / 1e3)}k` : se(t), xe = (t) => (t > 0 ? "+" : t < 0 ? "−" : "") + ye(Math.abs(t)), _e = g(() => $.value === "gold" ? d("gold") : $.value === "xp" ? d("XP") : d("CS")), ue = g(() => $.value === "gold" ? nt(f.timeline, Y.value) : $.value === "xp" ? Y.value === 200 ? f.timeline.xpDiff.map((t) => -t) : f.timeline.xpDiff : k.value.map((t, l) => H.value.reduce((e, a, s) => e + (y.value[s].teamId === Y.value ? 1 : -1) * (a[l] ?? 0), 0))), fe = (t) => y.value.findIndex((l) => l.participantId === y.value[t]?.opponent), I = O([]);
    We(
      () => f.selected,
      (t) => {
        const l = fe(t);
        I.value = l >= 0 ? [t, l] : [t];
      },
      { immediate: !0 }
    );
    const ge = (t) => I.value = I.value.includes(t) ? I.value.filter((l) => l !== t) : [...I.value, t], h = O(null), G = (t) => t === f.selected ? "var(--brand)" : he(y.value[t].teamId, f.me) === "ally" ? "var(--win)" : "var(--loss)", ie = O(null), ke = O(560);
    let ce;
    Ze(() => {
      ce = new ResizeObserver(([t]) => {
        const l = Math.round(t.contentRect.width);
        l > 0 && (ke.value = l);
      }), ie.value && ce.observe(ie.value);
    }), qe(() => ce?.disconnect());
    const be = F + W + 22, T = be + 16, ve = T + R + 16, we = ve + 4;
    function $e(t, l) {
      const e = t / l || 1, a = 10 ** Math.floor(Math.log10(e)), s = e / a;
      return (s <= 1 ? 1 : s <= 2 ? 2 : s <= 2.5 ? 2.5 : s <= 5 ? 5 : 10) * a;
    }
    const u = g(() => {
      const t = k.value, l = t.length;
      if (l < 2) return null;
      const e = t[l - 1] || 1, a = ke.value, s = (o) => b + o / e * (a - b - B);
      let _ = 1;
      for (const o of H.value) for (const C of o) _ = Math.max(_, C);
      const M = $e(_, 4);
      _ = Math.ceil(_ / M) * M;
      const m = (o) => F + (1 - o / _) * W, N = [];
      for (let o = 0; o <= _ + 1e-9; o += M) N.push({ y: m(o), label: o ? ye(o) : "0" });
      const D = e > 2700 ? 600 : 300, U = [];
      for (let o = D; o < e - D / 3; o += D) U.push({ x: s(o), label: j(o) });
      const Xe = H.value.map((o) => {
        let C = "";
        for (let K = 0; K < Math.min(l, o.length); K++) C += `${K ? "L" : "M"}${s(t[K]).toFixed(1)} ${m(o[K]).toFixed(1)}`;
        return C;
      }), de = ue.value, Ce = Math.max(1, ...de.map(Math.abs)), Le = $e(Ce, 3), Ne = Math.ceil(Ce / Le) * Le, te = T + R / 2, Pe = (o) => te - o / Ne * (R / 2);
      let le = "";
      de.forEach((o, C) => le += `${C ? "L" : "M"}${s(t[C] ?? 0).toFixed(1)} ${Pe(o).toFixed(1)}`);
      const Ge = le ? `${le}L${s(t[de.length - 1] ?? 0).toFixed(1)} ${te}L${b} ${te}Z` : "", S = H.value.map((o, C) => ({ i: C, y: m(o[Math.min(l, o.length) - 1] ?? 0) })).sort((o, C) => o.y - C.y);
      for (let o = 1; o < S.length; o++) S[o].y = Math.max(S[o].y, S[o - 1].y + 15);
      const Ee = (S[S.length - 1]?.y ?? 0) - (F + W);
      if (Ee > 0) for (const o of S) o.y -= Ee;
      return { x: s, y: m, ly: Pe, zero: te, lmax: Ne, tmax: e, w: a, paths: Xe, yTicks: N, xTicks: U, leadLine: le, leadArea: Ge, ends: S };
    }), Se = g(() => {
      const t = u.value;
      if (!t) return [];
      const l = { dragon: "dragon", baron: "baron", herald: "herald", grubs: "grubs", monster: "dragon", inhibitor: "inhib" };
      return at(f.detail, f.timeline).events.filter((e) => e.kind === "objective" && e.obj.kind !== "tower").map((e) => {
        const a = e.kind === "objective" ? e : null;
        return {
          key: a.key,
          x: t.x(a.t),
          icon: l[a.obj.kind],
          side: he(a.team, f.me),
          title: `${j(a.t)} · ${a.team === Y.value ? d("Your team") : d("Enemy team")}`
        };
      });
    }), p = O(null), ze = O(0);
    function Be(t) {
      const l = u.value, e = (t - b) / (l.w - b - B) * l.tmax;
      let a = 0;
      for (let s = 1; s < k.value.length; s++) Math.abs(k.value[s] - e) < Math.abs(k.value[a] - e) && (a = s);
      return a;
    }
    function Me(t) {
      const l = u.value;
      if (!l) return;
      const e = t.currentTarget.getBoundingClientRect(), a = t.clientX - e.left, s = t.clientY - e.top, _ = Be(a);
      if (p.value = _, ze.value = s, s > F + W + 6) return h.value = null;
      let M = null, m = 18;
      H.value.forEach((N, D) => {
        const U = Math.abs(l.y(N[_] ?? 0) - s);
        U < m && (m = U, M = D);
      }), h.value = M;
    }
    function re() {
      p.value = null, h.value = null;
    }
    let Ie = !1;
    function Fe(t) {
      Ie = t.pointerType === "touch", Me(t);
    }
    function Re() {
      Ie || re();
    }
    function Ye(t) {
      const l = p.value ?? J.value;
      if (t.key === "ArrowLeft") p.value = Math.max(0, l - 1);
      else if (t.key === "ArrowRight") p.value = Math.min(J.value, l + 1);
      else if (t.key === "Home") p.value = 0;
      else if (t.key === "End") p.value = J.value;
      else return t.key === "Escape" ? re() : void 0;
      t.preventDefault();
    }
    const Q = g(() => p.value ?? J.value), A = (t, l = Q.value) => H.value[t]?.[l] ?? 0, De = g(() => {
      const t = (l) => l === h.value ? 3 : l === f.selected ? 2 : I.value.includes(l) ? 1 : 0;
      return y.value.map((l, e) => e).sort((l, e) => t(l) - t(e));
    }), Oe = g(() => {
      const t = u.value;
      return !t || p.value === null ? [] : [.../* @__PURE__ */ new Set([...I.value, ...h.value !== null ? [h.value] : []])].map((e) => ({ i: e, y: t.y(A(e)), color: G(e) }));
    }), je = g(() => {
      const t = Q.value, l = Math.max(1, ...y.value.map((s, _) => A(_, t))), e = f.me ? [d("Your team"), d("Enemy team")] : [d("Blue side"), d("Red side")];
      return [Y.value, ...y.value.some((s) => s.teamId !== Y.value) ? [-1] : []].map((s, _) => {
        const M = y.value.map((m, N) => ({ p: m, i: N, v: A(N, t) })).filter((m) => s === -1 ? m.p.teamId !== Y.value : m.p.teamId === s).map((m) => ({ ...m, w: m.v / l * 100 }));
        return { team: s, label: e[_], side: _ ? "enemy" : "ally", total: M.reduce((m, N) => m + N.v, 0), rows: M };
      });
    }), ee = g(() => ue.value[Q.value] ?? 0), x = g(() => {
      const t = u.value, l = h.value, e = p.value;
      if (!t || l === null || e === null) return null;
      const a = y.value[l], s = A(l, e), _ = 1 + y.value.filter((N, D) => A(D, e) > s).length, M = fe(l), m = t.x(k.value[e]);
      return {
        p: a,
        v: s,
        place: _,
        gained: e > 0 ? s - A(l, e - 1) : null,
        vs: M >= 0 ? He(l, M, e) : null,
        left: m,
        top: Math.max(F, Math.min(F + W - 40, t.y(s))),
        flip: m > t.w * 0.58
      };
    });
    function He(t, l, e) {
      const a = A(t, e) - A(l, e), s = he(y.value[t].teamId, f.me) === "ally" ? a > 0 : a < 0;
      return { p: y.value[l], d: a, tone: a === 0 ? "" : s ? "ally" : "enemy" };
    }
    const Ve = (t) => d("{n} of {total}", { n: t, total: y.value.length });
    return (t, l) => (i(), c("div", ot, [
      n("header", ut, [
        n("p", it, [
          n("span", ct, r(p.value === null ? v(d)("End of game") : v(j)(k.value[Q.value])), 1),
          ae.value ? (i(), c(w, { key: 0 }, [
            n("span", vt, r(V.me ? v(d)("Your team") : v(d)("Blue side")), 1),
            n("b", {
              class: L(ee.value > 0 ? "ally" : ee.value < 0 ? "enemy" : "")
            }, r(ee.value === 0 ? v(d)("even") : oe(ee.value)), 3),
            n("span", rt, r(_e.value), 1)
          ], 64)) : P("", !0)
        ]),
        n("div", dt, [
          (i(), c(w, null, E(me, (e) => n("button", {
            key: e.id,
            type: "button",
            class: L({ on: $.value === e.id }),
            onClick: (a) => $.value = e.id
          }, r(v(d)(e.label)), 11, ht)), 64))
        ])
      ]),
      n("div", pt, [
        n("div", {
          ref_key: "plot",
          ref: ie,
          class: "iv-gch-plot",
          tabindex: "0",
          role: "img",
          "aria-label": v(d)("{metric} of each player over the game", { metric: v(d)(me.find((e) => e.id === $.value).label) }),
          onKeydown: Ye,
          onBlur: re
        }, [
          u.value ? (i(), c("svg", {
            key: 0,
            viewBox: `0 0 ${u.value.w} ${we}`,
            height: we,
            class: L({ "has-hot": h.value !== null }),
            onPointerdown: Fe,
            onPointermove: Me,
            onPointerleave: Re
          }, [
            n("g", xt, [
              (i(!0), c(w, null, E(u.value.yTicks, (e) => (i(), c(w, {
                key: `y${e.y}`
              }, [
                n("line", {
                  x1: b,
                  x2: u.value.w - B,
                  y1: e.y,
                  y2: e.y
                }, null, 8, _t),
                n("text", {
                  x: b - 8,
                  y: e.y + 3.5,
                  "text-anchor": "end"
                }, r(e.label), 9, ft)
              ], 64))), 128)),
              (i(!0), c(w, null, E(u.value.xTicks, (e) => (i(), c("line", {
                key: `x${e.x}`,
                class: "v",
                x1: e.x,
                x2: e.x,
                y1: F,
                y2: T + R
              }, null, 8, gt))), 128)),
              (i(!0), c(w, null, E(u.value.xTicks, (e) => (i(), c("text", {
                key: `xl${e.x}`,
                x: e.x,
                y: ve,
                "text-anchor": "middle"
              }, r(e.label), 9, kt))), 128)),
              n("text", {
                x: u.value.w - B,
                y: ve,
                "text-anchor": "end"
              }, r(v(j)(u.value.tmax)), 9, bt)
            ]),
            (i(), c("g", {
              key: $.value,
              class: "iv-gch-lines"
            }, [
              (i(!0), c(w, null, E(De.value, (e) => (i(), c("path", {
                key: e,
                d: u.value.paths[e],
                pathLength: "1",
                class: L(["iv-gch-line", { pin: I.value.includes(e), self: e === V.selected, hot: e === h.value }]),
                style: z({ "--c": G(e) })
              }, null, 14, wt))), 128))
            ])),
            ae.value ? (i(), c("g", $t, [
              n("defs", null, [
                n("clipPath", {
                  id: `${v(q)}-up`
                }, [
                  n("rect", {
                    x: b,
                    y: T,
                    width: Math.max(0, u.value.w - b - B),
                    height: R / 2
                  }, null, 8, It)
                ], 8, Mt),
                n("clipPath", {
                  id: `${v(q)}-down`
                }, [
                  n("rect", {
                    x: b,
                    y: u.value.zero,
                    width: Math.max(0, u.value.w - b - B),
                    height: R / 2
                  }, null, 8, Lt)
                ], 8, Ct)
              ]),
              n("text", {
                x: b - 8,
                y: T + 9,
                "text-anchor": "end"
              }, r(xe(u.value.lmax)), 9, Nt),
              n("text", {
                x: b - 8,
                y: T + R,
                "text-anchor": "end"
              }, r(xe(-u.value.lmax)), 9, Pt),
              n("path", {
                class: "up",
                d: u.value.leadArea,
                "clip-path": `url(#${v(q)}-up)`
              }, null, 8, Et),
              n("path", {
                class: "down",
                d: u.value.leadArea,
                "clip-path": `url(#${v(q)}-down)`
              }, null, 8, Tt),
              n("line", {
                class: "zero",
                x1: b,
                x2: u.value.w - B,
                y1: u.value.zero,
                y2: u.value.zero
              }, null, 8, At),
              n("path", {
                class: "line",
                d: u.value.leadLine
              }, null, 8, St)
            ])) : P("", !0),
            p.value !== null ? (i(), c("g", zt, [
              n("line", {
                class: "iv-gch-cross",
                x1: u.value.x(k.value[p.value]),
                x2: u.value.x(k.value[p.value]),
                y1: F,
                y2: T + R
              }, null, 8, Bt),
              (i(!0), c(w, null, E(Oe.value, (e) => (i(), c("circle", {
                key: e.i,
                class: L(["iv-gch-dot", { hot: e.i === h.value }]),
                cx: u.value.x(k.value[p.value]),
                cy: e.y,
                r: e.i === h.value ? 4.5 : 3.5,
                style: z({ fill: e.color })
              }, null, 14, Ft))), 128)),
              ae.value ? (i(), c("circle", {
                key: 0,
                class: "iv-gch-dot",
                cx: u.value.x(k.value[p.value]),
                cy: u.value.ly(ue.value[p.value] ?? 0),
                r: "3",
                style: { fill: "var(--text-1)" }
              }, null, 8, Rt)) : P("", !0)
            ])) : P("", !0)
          ], 42, yt)) : P("", !0),
          u.value ? (i(), c(w, { key: 1 }, [
            n("span", {
              class: "iv-gch-band-label",
              style: z({ top: `${T - 13}px`, left: `${b}px` })
            }, r(v(d)("Team lead")), 5),
            (i(!0), c(w, null, E(Se.value, (e) => (i(), c("span", {
              key: e.key,
              class: L(["iv-gch-mark", e.side]),
              style: z({ left: `${e.x}px`, top: `${be}px` }),
              title: e.title
            }, [
              Je(st, {
                name: e.icon,
                size: 12
              }, null, 8, ["name"])
            ], 14, Yt))), 128)),
            (i(!0), c(w, null, E(u.value.ends, (e) => (i(), c("img", {
              key: e.i,
              class: L(["iv-gch-end", { pin: I.value.includes(e.i), self: e.i === V.selected, hot: e.i === h.value, dim: h.value !== null && e.i !== h.value }]),
              src: v(ne)(y.value[e.i].championId),
              style: z({ left: `${u.value.w - B + 8}px`, top: `${e.y}px`, "--c": G(e.i) }),
              title: y.value[e.i].gameName || v(X)(y.value[e.i].championId),
              alt: "",
              onPointerenter: (a) => h.value = e.i,
              onPointerleave: l[0] || (l[0] = (a) => h.value = null),
              onClick: (a) => ge(e.i)
            }, null, 46, Dt))), 128)),
            p.value !== null && !x.value ? (i(), c("span", {
              key: 0,
              class: "iv-gch-chip",
              style: z({ left: `${u.value.x(k.value[p.value])}px` })
            }, r(v(j)(k.value[p.value])), 5)) : P("", !0),
            x.value ? (i(), c("div", {
              key: 1,
              class: L(["iv-gch-tip", { flip: x.value.flip }]),
              style: z({ left: `${x.value.left}px`, top: `${x.value.top}px`, "--c": G(h.value) })
            }, [
              n("p", Ot, [
                n("img", {
                  src: v(ne)(x.value.p.championId),
                  alt: ""
                }, null, 8, jt),
                n("b", null, r(x.value.p.gameName || v(X)(x.value.p.championId)), 1),
                n("small", null, r(v(X)(x.value.p.championId)), 1)
              ]),
              n("p", Ht, [
                n("b", null, r(v(Z)(x.value.v)), 1),
                l[3] || (l[3] = Qe()),
                n("span", null, r(_e.value), 1),
                n("span", Vt, r(Ve(x.value.place)), 1)
              ]),
              x.value.gained !== null ? (i(), c("p", Xt, [
                n("span", null, r(v(d)("Last minute")), 1),
                n("b", null, r(oe(x.value.gained)), 1)
              ])) : P("", !0),
              x.value.vs ? (i(), c("p", Gt, [
                n("span", null, r(v(d)("vs {name}", { name: v(X)(x.value.vs.p.championId) })), 1),
                n("b", {
                  class: L(x.value.vs.tone)
                }, r(oe(x.value.vs.d)), 3)
              ])) : P("", !0),
              n("p", Ut, r(v(j)(k.value[p.value])), 1)
            ], 6)) : P("", !0)
          ], 64)) : P("", !0)
        ], 40, mt),
        n("aside", {
          class: "iv-gch-legend",
          onPointerleave: l[2] || (l[2] = (e) => h.value = null)
        }, [
          (i(!0), c(w, null, E(je.value, (e) => (i(), c("section", {
            key: e.team,
            class: L(["iv-gch-team", e.side])
          }, [
            n("h5", null, [
              n("span", null, r(e.label), 1),
              n("b", null, r(se(e.total)), 1)
            ]),
            (i(!0), c(w, null, E(e.rows, (a) => (i(), c("button", {
              key: a.i,
              type: "button",
              class: L(["iv-gch-row", { pin: I.value.includes(a.i), self: a.i === V.selected, hot: a.i === h.value }]),
              style: z({ "--c": G(a.i), "--w": `${a.w}%` }),
              "aria-pressed": I.value.includes(a.i),
              onPointerenter: (s) => h.value = a.i,
              onFocus: (s) => h.value = a.i,
              onBlur: l[1] || (l[1] = (s) => h.value = null),
              onClick: (s) => ge(a.i)
            }, [
              n("img", {
                src: v(ne)(a.p.championId),
                alt: ""
              }, null, 8, Wt),
              n("span", Zt, r(a.p.gameName || v(X)(a.p.championId)), 1),
              n("b", null, r(se(a.v)), 1)
            ], 46, Kt))), 128))
          ], 2))), 128)),
          n("p", qt, [
            n("span", Jt, r(v(d)("Click a player to pin their line")), 1),
            n("span", Qt, r(v(d)("Tap a player to pin their line")), 1)
          ])
        ], 32)
      ])
    ]));
  }
});
export {
  cl as default
};
