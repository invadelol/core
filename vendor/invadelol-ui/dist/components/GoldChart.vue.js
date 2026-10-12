import { defineComponent as Ve, useId as Xe, shallowRef as O, computed as f, watch as Ge, onMounted as Ue, onBeforeUnmount as Ke, openBlock as c, createElementBlock as i, createElementVNode as a, toDisplayString as r, unref as v, Fragment as w, normalizeClass as L, createCommentVNode as E, renderList as P, normalizeStyle as z, createVNode as We, createTextVNode as Ze } from "vue";
import { useInvadeUi as qe, useFormat as Je, useNames as Qe } from "../context.js";
import { relation as de } from "../logic/detail.js";
import { tk as he } from "../logic/i18n.js";
import { leadFor as et, storyOf as tt } from "../logic/story.js";
import lt from "./ObjectiveIcon.vue.js";
const at = { class: "iv-gch" }, nt = { class: "iv-gch-head" }, st = {
  class: "iv-gch-read",
  "aria-live": "polite"
}, ot = { class: "iv-gch-when" }, ut = { class: "iv-gch-who" }, ct = { class: "iv-gch-unit" }, it = { class: "iv-seg sm" }, vt = ["onClick"], rt = { class: "iv-gch-main" }, dt = ["aria-label"], ht = ["viewBox"], pt = { class: "iv-gch-grid" }, mt = ["x2", "y1", "y2"], yt = ["x", "y"], xt = ["x1", "x2", "y2"], _t = ["x"], gt = ["x"], ft = ["d"], kt = {
  key: 0,
  class: "iv-gch-lead"
}, bt = ["id"], wt = ["width", "height"], $t = ["id"], Mt = ["y", "width", "height"], It = ["x", "y"], Ct = ["x", "y"], Lt = ["d", "clip-path"], Nt = ["d", "clip-path"], Et = ["x2", "y1", "y2"], Pt = ["d"], At = { key: 1 }, St = ["x1", "x2", "y2"], Tt = ["cx", "cy", "r"], zt = ["cx", "cy"], Ft = ["title"], Bt = ["src", "title", "onPointerenter", "onClick"], Rt = { class: "iv-gch-tip-who" }, Yt = ["src"], Dt = { class: "iv-gch-tip-v" }, Ot = { class: "iv-gch-tip-place" }, jt = {
  key: 0,
  class: "iv-gch-tip-row"
}, Ht = {
  key: 1,
  class: "iv-gch-tip-row"
}, Vt = { class: "iv-gch-tip-time" }, Xt = ["aria-pressed", "onPointerenter", "onFocus", "onClick"], Gt = ["src"], Ut = { class: "iv-gch-name" }, Kt = { class: "iv-gch-hint" }, b = 40, F = 30, B = 10, W = 236, R = 56, tl = /* @__PURE__ */ Ve({
  __name: "GoldChart",
  props: {
    detail: {},
    timeline: {},
    selected: {},
    me: {}
  },
  setup(V) {
    const g = V, { t: h } = qe(), { compact: Ee, mmss: j, num: Z, signedGold: Pe } = Je(), { champIcon: ae, champName: X } = Qe(), q = Xe(), pe = [
      { id: "gold", label: he("Gold") },
      { id: "xp", label: he("XP") },
      { id: "cs", label: he("CS") }
    ], $ = O("gold"), y = f(() => g.detail.players), Y = f(() => g.me?.teamId ?? y.value[0]?.teamId ?? 100), ne = f(() => {
      const t = new Set(y.value.map((l) => l.teamId));
      return t.size === 2 && t.has(100) && t.has(200);
    }), H = f(() => y.value.map((t, l) => g.timeline[$.value][l] ?? [])), k = f(() => g.timeline.t), J = f(() => Math.max(0, k.value.length - 1)), se = (t) => $.value === "cs" ? Z(Math.round(t)) : Ee(Math.round(t)), oe = (t) => $.value === "cs" ? `${t > 0 ? "+" : t < 0 ? "−" : ""}${Z(Math.abs(Math.round(t)))}` : Pe(Math.round(t)), me = (t) => $.value !== "cs" && Math.abs(t) >= 1e3 && t % 1e3 === 0 ? `${Z(t / 1e3)}k` : se(t), ye = (t) => (t > 0 ? "+" : t < 0 ? "−" : "") + me(Math.abs(t)), xe = f(() => $.value === "gold" ? h("gold") : $.value === "xp" ? h("XP") : h("CS")), ue = f(() => $.value === "gold" ? et(g.timeline, Y.value) : $.value === "xp" ? Y.value === 200 ? g.timeline.xpDiff.map((t) => -t) : g.timeline.xpDiff : k.value.map((t, l) => H.value.reduce((e, n, s) => e + (y.value[s].teamId === Y.value ? 1 : -1) * (n[l] ?? 0), 0))), _e = (t) => y.value.findIndex((l) => l.participantId === y.value[t]?.opponent), I = O([]);
    Ge(
      () => g.selected,
      (t) => {
        const l = _e(t);
        I.value = l >= 0 ? [t, l] : [t];
      },
      { immediate: !0 }
    );
    const ge = (t) => I.value = I.value.includes(t) ? I.value.filter((l) => l !== t) : [...I.value, t], d = O(null), G = (t) => t === g.selected ? "var(--brand)" : de(y.value[t].teamId, g.me) === "ally" ? "var(--win)" : "var(--loss)", ce = O(null), fe = O(560);
    let ie;
    Ue(() => {
      ie = new ResizeObserver(([t]) => {
        const l = Math.round(t.contentRect.width);
        l > 0 && (fe.value = l);
      }), ce.value && ie.observe(ce.value);
    }), Ke(() => ie?.disconnect());
    const ke = B + W + 22, A = ke + 16, ve = A + R + 16, be = ve + 4;
    function we(t, l) {
      const e = t / l || 1, n = 10 ** Math.floor(Math.log10(e)), s = e / n;
      return (s <= 1 ? 1 : s <= 2 ? 2 : s <= 2.5 ? 2.5 : s <= 5 ? 5 : 10) * n;
    }
    const u = f(() => {
      const t = k.value, l = t.length;
      if (l < 2) return null;
      const e = t[l - 1] || 1, n = fe.value, s = (o) => b + o / e * (n - b - F);
      let _ = 1;
      for (const o of H.value) for (const C of o) _ = Math.max(_, C);
      const M = we(_, 4);
      _ = Math.ceil(_ / M) * M;
      const m = (o) => B + (1 - o / _) * W, N = [];
      for (let o = 0; o <= _ + 1e-9; o += M) N.push({ y: m(o), label: o ? me(o) : "0" });
      const D = e > 2700 ? 600 : 300, U = [];
      for (let o = D; o < e - D / 3; o += D) U.push({ x: s(o), label: j(o) });
      const je = H.value.map((o) => {
        let C = "";
        for (let K = 0; K < Math.min(l, o.length); K++) C += `${K ? "L" : "M"}${s(t[K]).toFixed(1)} ${m(o[K]).toFixed(1)}`;
        return C;
      }), re = ue.value, Me = Math.max(1, ...re.map(Math.abs)), Ie = we(Me, 3), Ce = Math.ceil(Me / Ie) * Ie, te = A + R / 2, Le = (o) => te - o / Ce * (R / 2);
      let le = "";
      re.forEach((o, C) => le += `${C ? "L" : "M"}${s(t[C] ?? 0).toFixed(1)} ${Le(o).toFixed(1)}`);
      const He = le ? `${le}L${s(t[re.length - 1] ?? 0).toFixed(1)} ${te}L${b} ${te}Z` : "", T = H.value.map((o, C) => ({ i: C, y: m(o[Math.min(l, o.length) - 1] ?? 0) })).sort((o, C) => o.y - C.y);
      for (let o = 1; o < T.length; o++) T[o].y = Math.max(T[o].y, T[o - 1].y + 15);
      const Ne = (T[T.length - 1]?.y ?? 0) - (B + W);
      if (Ne > 0) for (const o of T) o.y -= Ne;
      return { x: s, y: m, ly: Le, zero: te, lmax: Ce, tmax: e, w: n, paths: je, yTicks: N, xTicks: U, leadLine: le, leadArea: He, ends: T };
    }), Ae = f(() => {
      const t = u.value;
      if (!t) return [];
      const l = { dragon: "dragon", baron: "baron", herald: "herald", grubs: "grubs", monster: "dragon", inhibitor: "inhib" };
      return tt(g.detail, g.timeline).events.filter((e) => e.kind === "objective" && e.obj.kind !== "tower").map((e) => {
        const n = e.kind === "objective" ? e : null;
        return {
          key: n.key,
          x: t.x(n.t),
          icon: l[n.obj.kind],
          side: de(n.team, g.me),
          title: `${j(n.t)} · ${n.team === Y.value ? h("Your team") : h("Enemy team")}`
        };
      });
    }), p = O(null), Se = O(0);
    function Te(t) {
      const l = u.value, e = (t - b) / (l.w - b - F) * l.tmax;
      let n = 0;
      for (let s = 1; s < k.value.length; s++) Math.abs(k.value[s] - e) < Math.abs(k.value[n] - e) && (n = s);
      return n;
    }
    function ze(t) {
      const l = u.value;
      if (!l) return;
      const e = t.currentTarget.getBoundingClientRect(), n = t.clientX - e.left, s = t.clientY - e.top, _ = Te(n);
      if (p.value = _, Se.value = s, s > B + W + 6) return d.value = null;
      let M = null, m = 18;
      H.value.forEach((N, D) => {
        const U = Math.abs(l.y(N[_] ?? 0) - s);
        U < m && (m = U, M = D);
      }), d.value = M;
    }
    function $e() {
      p.value = null, d.value = null;
    }
    function Fe(t) {
      const l = p.value ?? J.value;
      if (t.key === "ArrowLeft") p.value = Math.max(0, l - 1);
      else if (t.key === "ArrowRight") p.value = Math.min(J.value, l + 1);
      else if (t.key === "Home") p.value = 0;
      else if (t.key === "End") p.value = J.value;
      else return t.key === "Escape" ? $e() : void 0;
      t.preventDefault();
    }
    const Q = f(() => p.value ?? J.value), S = (t, l = Q.value) => H.value[t]?.[l] ?? 0, Be = f(() => {
      const t = (l) => l === d.value ? 3 : l === g.selected ? 2 : I.value.includes(l) ? 1 : 0;
      return y.value.map((l, e) => e).sort((l, e) => t(l) - t(e));
    }), Re = f(() => {
      const t = u.value;
      return !t || p.value === null ? [] : [.../* @__PURE__ */ new Set([...I.value, ...d.value !== null ? [d.value] : []])].map((e) => ({ i: e, y: t.y(S(e)), color: G(e) }));
    }), Ye = f(() => {
      const t = Q.value, l = Math.max(1, ...y.value.map((s, _) => S(_, t))), e = g.me ? [h("Your team"), h("Enemy team")] : [h("Blue side"), h("Red side")];
      return [Y.value, ...y.value.some((s) => s.teamId !== Y.value) ? [-1] : []].map((s, _) => {
        const M = y.value.map((m, N) => ({ p: m, i: N, v: S(N, t) })).filter((m) => s === -1 ? m.p.teamId !== Y.value : m.p.teamId === s).map((m) => ({ ...m, w: m.v / l * 100 }));
        return { team: s, label: e[_], side: _ ? "enemy" : "ally", total: M.reduce((m, N) => m + N.v, 0), rows: M };
      });
    }), ee = f(() => ue.value[Q.value] ?? 0), x = f(() => {
      const t = u.value, l = d.value, e = p.value;
      if (!t || l === null || e === null) return null;
      const n = y.value[l], s = S(l, e), _ = 1 + y.value.filter((N, D) => S(D, e) > s).length, M = _e(l), m = t.x(k.value[e]);
      return {
        p: n,
        v: s,
        place: _,
        gained: e > 0 ? s - S(l, e - 1) : null,
        vs: M >= 0 ? De(l, M, e) : null,
        left: m,
        top: Math.max(B, Math.min(B + W - 40, t.y(s))),
        flip: m > t.w * 0.58
      };
    });
    function De(t, l, e) {
      const n = S(t, e) - S(l, e), s = de(y.value[t].teamId, g.me) === "ally" ? n > 0 : n < 0;
      return { p: y.value[l], d: n, tone: n === 0 ? "" : s ? "ally" : "enemy" };
    }
    const Oe = (t) => h("{n} of {total}", { n: t, total: y.value.length });
    return (t, l) => (c(), i("div", at, [
      a("header", nt, [
        a("p", st, [
          a("span", ot, r(p.value === null ? v(h)("End of game") : v(j)(k.value[Q.value])), 1),
          ne.value ? (c(), i(w, { key: 0 }, [
            a("span", ut, r(V.me ? v(h)("Your team") : v(h)("Blue side")), 1),
            a("b", {
              class: L(ee.value > 0 ? "ally" : ee.value < 0 ? "enemy" : "")
            }, r(ee.value === 0 ? v(h)("even") : oe(ee.value)), 3),
            a("span", ct, r(xe.value), 1)
          ], 64)) : E("", !0)
        ]),
        a("div", it, [
          (c(), i(w, null, P(pe, (e) => a("button", {
            key: e.id,
            type: "button",
            class: L({ on: $.value === e.id }),
            onClick: (n) => $.value = e.id
          }, r(v(h)(e.label)), 11, vt)), 64))
        ])
      ]),
      a("div", rt, [
        a("div", {
          ref_key: "plot",
          ref: ce,
          class: "iv-gch-plot",
          tabindex: "0",
          role: "img",
          "aria-label": v(h)("{metric} of each player over the game", { metric: v(h)(pe.find((e) => e.id === $.value).label) }),
          onKeydown: Fe
        }, [
          u.value ? (c(), i("svg", {
            key: 0,
            viewBox: `0 0 ${u.value.w} ${be}`,
            height: be,
            class: L({ "has-hot": d.value !== null }),
            onPointermove: ze,
            onPointerleave: $e
          }, [
            a("g", pt, [
              (c(!0), i(w, null, P(u.value.yTicks, (e) => (c(), i(w, {
                key: `y${e.y}`
              }, [
                a("line", {
                  x1: b,
                  x2: u.value.w - F,
                  y1: e.y,
                  y2: e.y
                }, null, 8, mt),
                a("text", {
                  x: b - 8,
                  y: e.y + 3.5,
                  "text-anchor": "end"
                }, r(e.label), 9, yt)
              ], 64))), 128)),
              (c(!0), i(w, null, P(u.value.xTicks, (e) => (c(), i("line", {
                key: `x${e.x}`,
                class: "v",
                x1: e.x,
                x2: e.x,
                y1: B,
                y2: A + R
              }, null, 8, xt))), 128)),
              (c(!0), i(w, null, P(u.value.xTicks, (e) => (c(), i("text", {
                key: `xl${e.x}`,
                x: e.x,
                y: ve,
                "text-anchor": "middle"
              }, r(e.label), 9, _t))), 128)),
              a("text", {
                x: u.value.w - F,
                y: ve,
                "text-anchor": "end"
              }, r(v(j)(u.value.tmax)), 9, gt)
            ]),
            (c(), i("g", {
              key: $.value,
              class: "iv-gch-lines"
            }, [
              (c(!0), i(w, null, P(Be.value, (e) => (c(), i("path", {
                key: e,
                d: u.value.paths[e],
                pathLength: "1",
                class: L(["iv-gch-line", { pin: I.value.includes(e), self: e === V.selected, hot: e === d.value }]),
                style: z({ "--c": G(e) })
              }, null, 14, ft))), 128))
            ])),
            ne.value ? (c(), i("g", kt, [
              a("defs", null, [
                a("clipPath", {
                  id: `${v(q)}-up`
                }, [
                  a("rect", {
                    x: b,
                    y: A,
                    width: Math.max(0, u.value.w - b - F),
                    height: R / 2
                  }, null, 8, wt)
                ], 8, bt),
                a("clipPath", {
                  id: `${v(q)}-down`
                }, [
                  a("rect", {
                    x: b,
                    y: u.value.zero,
                    width: Math.max(0, u.value.w - b - F),
                    height: R / 2
                  }, null, 8, Mt)
                ], 8, $t)
              ]),
              a("text", {
                x: b - 8,
                y: A + 9,
                "text-anchor": "end"
              }, r(ye(u.value.lmax)), 9, It),
              a("text", {
                x: b - 8,
                y: A + R,
                "text-anchor": "end"
              }, r(ye(-u.value.lmax)), 9, Ct),
              a("path", {
                class: "up",
                d: u.value.leadArea,
                "clip-path": `url(#${v(q)}-up)`
              }, null, 8, Lt),
              a("path", {
                class: "down",
                d: u.value.leadArea,
                "clip-path": `url(#${v(q)}-down)`
              }, null, 8, Nt),
              a("line", {
                class: "zero",
                x1: b,
                x2: u.value.w - F,
                y1: u.value.zero,
                y2: u.value.zero
              }, null, 8, Et),
              a("path", {
                class: "line",
                d: u.value.leadLine
              }, null, 8, Pt)
            ])) : E("", !0),
            p.value !== null ? (c(), i("g", At, [
              a("line", {
                class: "iv-gch-cross",
                x1: u.value.x(k.value[p.value]),
                x2: u.value.x(k.value[p.value]),
                y1: B,
                y2: A + R
              }, null, 8, St),
              (c(!0), i(w, null, P(Re.value, (e) => (c(), i("circle", {
                key: e.i,
                class: L(["iv-gch-dot", { hot: e.i === d.value }]),
                cx: u.value.x(k.value[p.value]),
                cy: e.y,
                r: e.i === d.value ? 4.5 : 3.5,
                style: z({ fill: e.color })
              }, null, 14, Tt))), 128)),
              ne.value ? (c(), i("circle", {
                key: 0,
                class: "iv-gch-dot",
                cx: u.value.x(k.value[p.value]),
                cy: u.value.ly(ue.value[p.value] ?? 0),
                r: "3",
                style: { fill: "var(--text-1)" }
              }, null, 8, zt)) : E("", !0)
            ])) : E("", !0)
          ], 42, ht)) : E("", !0),
          u.value ? (c(), i(w, { key: 1 }, [
            a("span", {
              class: "iv-gch-band-label",
              style: z({ top: `${A - 13}px`, left: `${b}px` })
            }, r(v(h)("Team lead")), 5),
            (c(!0), i(w, null, P(Ae.value, (e) => (c(), i("span", {
              key: e.key,
              class: L(["iv-gch-mark", e.side]),
              style: z({ left: `${e.x}px`, top: `${ke}px` }),
              title: e.title
            }, [
              We(lt, {
                name: e.icon,
                size: 12
              }, null, 8, ["name"])
            ], 14, Ft))), 128)),
            (c(!0), i(w, null, P(u.value.ends, (e) => (c(), i("img", {
              key: e.i,
              class: L(["iv-gch-end", { pin: I.value.includes(e.i), self: e.i === V.selected, hot: e.i === d.value, dim: d.value !== null && e.i !== d.value }]),
              src: v(ae)(y.value[e.i].championId),
              style: z({ left: `${u.value.w - F + 8}px`, top: `${e.y}px`, "--c": G(e.i) }),
              title: y.value[e.i].gameName || v(X)(y.value[e.i].championId),
              alt: "",
              onPointerenter: (n) => d.value = e.i,
              onPointerleave: l[0] || (l[0] = (n) => d.value = null),
              onClick: (n) => ge(e.i)
            }, null, 46, Bt))), 128)),
            p.value !== null && !x.value ? (c(), i("span", {
              key: 0,
              class: "iv-gch-chip",
              style: z({ left: `${u.value.x(k.value[p.value])}px` })
            }, r(v(j)(k.value[p.value])), 5)) : E("", !0),
            x.value ? (c(), i("div", {
              key: 1,
              class: L(["iv-gch-tip", { flip: x.value.flip }]),
              style: z({ left: `${x.value.left}px`, top: `${x.value.top}px`, "--c": G(d.value) })
            }, [
              a("p", Rt, [
                a("img", {
                  src: v(ae)(x.value.p.championId),
                  alt: ""
                }, null, 8, Yt),
                a("b", null, r(x.value.p.gameName || v(X)(x.value.p.championId)), 1),
                a("small", null, r(v(X)(x.value.p.championId)), 1)
              ]),
              a("p", Dt, [
                a("b", null, r(v(Z)(x.value.v)), 1),
                l[3] || (l[3] = Ze()),
                a("span", null, r(xe.value), 1),
                a("span", Ot, r(Oe(x.value.place)), 1)
              ]),
              x.value.gained !== null ? (c(), i("p", jt, [
                a("span", null, r(v(h)("Last minute")), 1),
                a("b", null, r(oe(x.value.gained)), 1)
              ])) : E("", !0),
              x.value.vs ? (c(), i("p", Ht, [
                a("span", null, r(v(h)("vs {name}", { name: v(X)(x.value.vs.p.championId) })), 1),
                a("b", {
                  class: L(x.value.vs.tone)
                }, r(oe(x.value.vs.d)), 3)
              ])) : E("", !0),
              a("p", Vt, r(v(j)(k.value[p.value])), 1)
            ], 6)) : E("", !0)
          ], 64)) : E("", !0)
        ], 40, dt),
        a("aside", {
          class: "iv-gch-legend",
          onPointerleave: l[2] || (l[2] = (e) => d.value = null)
        }, [
          (c(!0), i(w, null, P(Ye.value, (e) => (c(), i("section", {
            key: e.team,
            class: L(["iv-gch-team", e.side])
          }, [
            a("h5", null, [
              a("span", null, r(e.label), 1),
              a("b", null, r(se(e.total)), 1)
            ]),
            (c(!0), i(w, null, P(e.rows, (n) => (c(), i("button", {
              key: n.i,
              type: "button",
              class: L(["iv-gch-row", { pin: I.value.includes(n.i), self: n.i === V.selected, hot: n.i === d.value }]),
              style: z({ "--c": G(n.i), "--w": `${n.w}%` }),
              "aria-pressed": I.value.includes(n.i),
              onPointerenter: (s) => d.value = n.i,
              onFocus: (s) => d.value = n.i,
              onBlur: l[1] || (l[1] = (s) => d.value = null),
              onClick: (s) => ge(n.i)
            }, [
              a("img", {
                src: v(ae)(n.p.championId),
                alt: ""
              }, null, 8, Gt),
              a("span", Ut, r(n.p.gameName || v(X)(n.p.championId)), 1),
              a("b", null, r(se(n.v)), 1)
            ], 46, Xt))), 128))
          ], 2))), 128)),
          a("p", Kt, r(v(h)("Click a player to pin their line")), 1)
        ], 32)
      ])
    ]));
  }
});
export {
  tl as default
};
