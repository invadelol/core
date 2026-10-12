import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
import { defineComponent as Ne, shallowRef as C, computed as b, onMounted as Te, onBeforeUnmount as Re, watch as Ae, openBlock as n, createElementBlock as a, createElementVNode as i, unref as l, normalizeClass as _, toDisplayString as o, Fragment as k, renderList as T, createTextVNode as B, createCommentVNode as y, normalizeStyle as se, createVNode as je } from "vue";
import { useInvadeUi as xe, useFormat as Oe, useNames as Me } from "../context.js";
import { relation as Se } from "../logic/detail.js";
import { tk as v } from "../logic/i18n.js";
import { positionName as $e } from "../logic/labels.js";
import { storyOf as we, leadFor as Ce, involves as De, isEpic as He, PHASES as Ge, valueAt as le, FIGHT_GAP as Le, scoreAt as Be } from "../logic/story.js";
import Fe from "./ObjectiveIcon.vue.js";
/* empty css                 */
/* empty css                       */
/* empty css                   */
const Ue = { class: "iv-evt" }, Pe = { class: "iv-evt-head" }, Ke = ["aria-label"], Ve = ["aria-pressed"], We = ["title", "aria-pressed", "onClick"], ze = ["src"], qe = {
  key: 0,
  class: "iv-evt-who"
}, Qe = {
  key: 1,
  class: "iv-seg sm iv-evt-filter"
}, Xe = ["onClick"], Je = {
  key: 0,
  class: "iv-pf-note"
}, Ye = { class: "iv-evt-phase" }, Ze = { class: "iv-evt-phase-name" }, et = { class: "iv-evt-phase-time" }, tt = { class: "iv-evt-phase-facts" }, it = ["title"], st = ["title"], lt = { class: "ally" }, ot = { class: "enemy" }, nt = ["title"], at = {
  key: 0,
  class: "iv-evt-quiet"
}, rt = {
  key: 1,
  class: "iv-evt-list"
}, ct = { class: "iv-evt-body" }, dt = { class: "iv-evt-score" }, vt = { class: "ally" }, ut = { class: "enemy" }, mt = { class: "iv-evt-meta" }, kt = ["onMouseenter"], ht = {
  key: 0,
  class: "iv-evt-body"
}, pt = { class: "iv-evt-verb" }, ft = { class: "iv-evt-art dead" }, _t = ["src", "title"], yt = { class: "iv-evt-verb" }, gt = { class: "iv-evt-art" }, bt = ["src", "title"], Et = { class: "iv-evt-verb" }, It = { class: "iv-evt-art dead" }, Nt = ["src", "title"], Tt = { class: "iv-evt-art" }, Rt = ["src", "title"], At = { class: "iv-evt-verb" }, jt = { class: "iv-evt-art dead" }, xt = ["src", "title"], Ot = { class: "iv-evt-target" }, Mt = ["title"], St = ["src", "title"], $t = {
  key: 1,
  class: "iv-evt-body"
}, wt = ["title"], Ct = {
  key: 0,
  class: "iv-evt-verb"
}, Dt = {
  key: 1,
  class: "iv-evt-meta"
}, Ht = {
  key: 2,
  class: "iv-evt-meta"
}, Gt = ["title"], Lt = ["src"], Bt = {
  key: 2,
  class: "iv-evt-state",
  "aria-hidden": "true"
}, Ft = { class: "ally" }, Ut = { class: "enemy" }, Zt = /* @__PURE__ */ Ne({
  __name: "Timeline",
  props: {
    detail: {},
    timeline: {},
    selected: {},
    me: {}
  },
  emits: ["select"],
  setup(F, { emit: oe }) {
    const h = F, ne = oe, { t: r } = xe(), { mmss: M, num: ae, signedGold: q } = Oe(), { champIcon: Q, champName: I } = Me(), f = C("player"), re = [
      { id: "all", label: v("All") },
      { id: "kills", label: v("Kills") },
      { id: "objectives", label: v("Objectives") }
    ], S = C("all"), U = b(() => we(h.detail, h.timeline)), D = (t) => U.value.byId.get(t), E = b(() => h.detail.players[h.selected]), N = b(() => h.me?.teamId ?? h.detail.players[0]?.teamId ?? 100), X = b(() => N.value === 100 ? 200 : 100), J = (t) => Se(t, h.me), Y = b(() => Ce(h.timeline, N.value)), ce = b(() => Math.max(h.detail.duration, h.timeline.t[h.timeline.t.length - 1] ?? 0)), de = b(() => {
      const t = h.detail.players.map((s, d) => ({ p: s, i: d }));
      return [t.filter((s) => s.p.teamId === N.value), t.filter((s) => s.p.teamId !== N.value)].filter((s) => s.length);
    });
    function ve(t) {
      f.value = "player", ne("select", t);
    }
    const Z = {
      AIR_DRAGON: v("Cloud drake"),
      FIRE_DRAGON: v("Infernal drake"),
      EARTH_DRAGON: v("Mountain drake"),
      WATER_DRAGON: v("Ocean drake"),
      HEXTECH_DRAGON: v("Hextech drake"),
      CHEMTECH_DRAGON: v("Chemtech drake"),
      ELDER_DRAGON: v("Elder dragon")
    }, ue = {
      dragon: v("Dragon"),
      baron: v("Baron Nashor"),
      herald: v("Rift Herald"),
      grubs: v("Voidgrubs"),
      monster: v("Epic monster"),
      tower: v("Turret"),
      inhibitor: v("Inhibitor")
    }, me = {
      dragon: "dragon",
      baron: "baron",
      herald: "herald",
      grubs: "grubs",
      monster: "dragon",
      tower: "tower",
      inhibitor: "inhib"
    }, ke = { TOP_LANE: v("Top"), MID_LANE: v("Mid"), BOT_LANE: v("Bot") }, he = { OUTER_TURRET: v("outer"), INNER_TURRET: v("inner"), BASE_TURRET: v("base"), NEXUS_TURRET: v("Nexus") }, pe = ["", "", v("Double kill"), v("Triple kill"), v("Quadra kill"), v("Penta kill")], fe = { early: v("Laning phase"), mid: v("Mid game"), late: v("Late game") };
    function _e(t) {
      return t.kind === "dragon" && Z[t.sub] ? r(Z[t.sub]) : r(ue[t.kind]);
    }
    function ee(t) {
      return t.kind !== "tower" && t.kind !== "inhibitor" ? "" : [ke[t.lane], t.kind === "tower" ? he[t.sub] : ""].filter(Boolean).map((s) => r(s)).join(" · ");
    }
    const $ = (t) => {
      const s = D(t);
      return s ? I(s.championId) : "";
    }, R = (t) => Q(D(t)?.championId ?? 0), A = (t) => {
      const s = D(t);
      return s ? `${s.gameName || I(s.championId)} · ${I(s.championId)}` : "";
    }, te = (t) => t.first ? r("First blood") : t.multi >= 2 ? r(pe[t.multi]) : "";
    function P(t, s) {
      return f.value === "game" ? "game" : t.kind === "objective" ? t.obj.killer === s ? "took" : "context" : t.kill.killer === s ? "killer" : t.kill.victim === s ? "victim" : "assist";
    }
    const K = b(() => {
      const t = E.value?.participantId ?? -1, s = U.value, d = ce.value, u = s.events.filter((c) => f.value === "player" ? De(c, t) || He(c) : S.value === "kills" ? c.kind === "kill" : S.value === "objectives" ? c.kind === "objective" : !0), e = [];
      let m = null;
      for (const c of u) {
        const g = c.kind === "kill" ? c.fight : -1, L = m && (g === m.fight || c.kind === "objective" && c.t <= m.end + Le);
        if (m && L) {
          m.node.lines.push({ key: c.key, ev: c, role: P(c, t), offset: c.t - m.node.t, idx: 0 });
          continue;
        }
        if (m = null, g >= 0) {
          const j = s.fights[g], w = j.kills.get(N.value) ?? 0, x = j.kills.get(X.value) ?? 0, p = { key: `f${g}`, t: c.t, lines: [], fight: { ours: w, theirs: x, end: j.end, big: w + x >= 5 }, idx: 0 };
          p.lines.push({ key: c.key, ev: c, role: P(c, t), offset: 0, idx: 0 }), e.push(p), m = { node: p, fight: g, end: j.end };
        } else e.push({ key: c.key, t: c.t, lines: [{ key: c.key, ev: c, role: P(c, t), offset: 0, idx: 0 }], idx: 0 });
      }
      let z = 0;
      for (const c of e) {
        c.fight && (c.idx = Math.min(z++, 18));
        for (const g of c.lines) g.idx = Math.min(z++, 18);
      }
      return Ge.filter((c) => c.from < d).map((c) => {
        const g = Math.min(c.to, d), L = (p) => p >= c.from && (p < c.to || c.to === 1 / 0);
        let j = 0, w = 0;
        const x = [0, 0, 0];
        for (const p of s.events)
          p.kind !== "kill" || !L(p.t) || (p.team === N.value ? j++ : w++, p.kill.killer === t ? x[0]++ : p.kill.victim === t ? x[1]++ : p.kill.assists.includes(t) && x[2]++);
        return {
          id: c.id,
          from: c.from,
          to: g,
          nodes: e.filter((p) => L(p.t)),
          ours: j,
          theirs: w,
          kda: x,
          lead: Math.round(le(h.timeline.t, Y.value, g))
        };
      });
    }), ye = b(() => K.value.every((t) => !t.nodes.length)), H = C(null);
    function ge(t) {
      const s = Be(U.value, t.t);
      return {
        ours: s.get(N.value) ?? 0,
        theirs: s.get(X.value) ?? 0,
        lead: Math.round(le(h.timeline.t, Y.value, t.t))
      };
    }
    function ie(t) {
      if (t.ev.kind !== "kill") return [];
      const s = t.ev.kill, d = t.role === "assist" ? [s.killer, ...s.assists] : s.assists, u = t.role === "game" ? -1 : E.value?.participantId;
      return d.filter((e) => e && e !== u);
    }
    const be = (t) => t.kind === "kill", Ee = (t) => t.kind === "objective", O = C(null), V = C({ top: !1, bottom: !1 });
    function G() {
      const t = O.value;
      t && (V.value = { top: t.scrollTop > 4, bottom: t.scrollTop + t.clientHeight < t.scrollHeight - 4 });
    }
    let W;
    Te(() => {
      W = new ResizeObserver(G), O.value && W.observe(O.value), G();
    }), Re(() => W?.disconnect()), Ae([K, f], () => requestAnimationFrame(() => {
      O.value && (O.value.scrollTop = 0), G();
    }));
    const Ie = b(() => `${f.value}:${h.selected}:${S.value}`);
    return (t, s) => (n(), a("div", Ue, [
      i("header", Pe, [
        i("div", {
          class: "iv-evt-scope",
          role: "group",
          "aria-label": l(r)("Whose story")
        }, [
          i("button", {
            type: "button",
            class: _(["iv-evt-all", { on: f.value === "game" }]),
            "aria-pressed": f.value === "game",
            onClick: s[0] || (s[0] = (d) => f.value = "game")
          }, o(l(r)("Whole game")), 11, Ve),
          (n(!0), a(k, null, T(de.value, (d, u) => (n(), a("span", {
            key: u,
            class: _(["iv-evt-team", u ? "enemy" : "ally"])
          }, [
            (n(!0), a(k, null, T(d, ({ p: e, i: m }) => (n(), a("button", {
              key: e.participantId,
              type: "button",
              class: _({ on: f.value === "player" && m === F.selected }),
              title: `${e.gameName || l(I)(e.championId)} · ${l(I)(e.championId)}`,
              "aria-pressed": f.value === "player" && m === F.selected,
              onClick: (z) => ve(m)
            }, [
              i("img", {
                src: l(Q)(e.championId),
                alt: ""
              }, null, 8, ze)
            ], 10, We))), 128))
          ], 2))), 128))
        ], 8, Ke),
        f.value === "player" && E.value ? (n(), a("p", qe, [
          i("b", null, o(E.value.gameName || l(I)(E.value.championId)), 1),
          i("small", null, [
            B(o(l(I)(E.value.championId)), 1),
            E.value.position ? (n(), a(k, { key: 0 }, [
              B(" · " + o(l($e)(E.value.position, l(r))), 1)
            ], 64)) : y("", !0)
          ])
        ])) : (n(), a("div", Qe, [
          (n(), a(k, null, T(re, (d) => i("button", {
            key: d.id,
            type: "button",
            class: _({ on: S.value === d.id }),
            onClick: (u) => S.value = d.id
          }, o(l(r)(d.label)), 11, Xe)), 64))
        ]))
      ]),
      ye.value ? (n(), a("p", Je, o(l(r)("Nothing here")), 1)) : (n(), a("div", {
        ref_key: "feed",
        ref: O,
        key: Ie.value,
        class: _(["iv-evt-feed", { "fade-top": V.value.top, "fade-bottom": V.value.bottom }]),
        onScrollPassive: G
      }, [
        (n(!0), a(k, null, T(K.value, (d) => (n(), a("section", {
          key: d.id,
          class: "iv-evt-chapter"
        }, [
          i("h4", Ye, [
            i("span", Ze, o(l(r)(fe[d.id])), 1),
            i("span", et, o(l(M)(d.from)) + "–" + o(l(M)(d.to)), 1),
            i("span", tt, [
              f.value === "player" ? (n(), a("span", {
                key: 0,
                title: l(r)("Kills / deaths / assists in this phase")
              }, [
                i("b", null, o(d.kda[0]), 1),
                s[2] || (s[2] = i("i", null, "/", -1)),
                i("b", null, o(d.kda[1]), 1),
                s[3] || (s[3] = i("i", null, "/", -1)),
                i("b", null, o(d.kda[2]), 1)
              ], 8, it)) : (n(), a("span", {
                key: 1,
                title: l(r)("Kills in this phase")
              }, [
                i("b", lt, o(d.ours), 1),
                s[4] || (s[4] = i("i", null, "–", -1)),
                i("b", ot, o(d.theirs), 1),
                B(" " + o(l(r)("kills")), 1)
              ], 8, st)),
              i("span", {
                title: l(r)("Team gold lead at {time}", { time: l(M)(d.to) })
              }, [
                i("b", {
                  class: _(d.lead > 0 ? "ally" : d.lead < 0 ? "enemy" : "")
                }, o(d.lead === 0 ? l(r)("even") : l(q)(d.lead)), 3),
                B(" " + o(l(r)("gold")), 1)
              ], 8, nt)
            ])
          ]),
          d.nodes.length ? (n(), a("ol", rt, [
            (n(!0), a(k, null, T(d.nodes, (u) => (n(), a("li", {
              key: u.key,
              class: _(["iv-evt-node", { fight: u.fight }])
            }, [
              u.fight ? (n(), a("div", {
                key: 0,
                class: "iv-evt-row iv-evt-fight",
                style: se({ "--i": u.idx })
              }, [
                i("time", null, o(l(M)(u.t)), 1),
                i("i", {
                  class: _(["iv-evt-dot ring", u.fight.ours > u.fight.theirs ? "ally" : u.fight.ours < u.fight.theirs ? "enemy" : ""])
                }, null, 2),
                i("span", ct, [
                  i("b", null, o(u.fight.big ? l(r)("Teamfight") : l(r)("Skirmish")), 1),
                  i("span", dt, [
                    i("em", vt, o(u.fight.ours), 1),
                    s[5] || (s[5] = i("i", null, "–", -1)),
                    i("em", ut, o(u.fight.theirs), 1)
                  ]),
                  i("span", mt, o(u.fight.ours > u.fight.theirs ? l(r)("won") : u.fight.ours < u.fight.theirs ? l(r)("lost") : l(r)("traded")) + " · " + o(l(ae)(Math.max(1, u.fight.end - u.t))) + " s", 1)
                ])
              ], 4)) : y("", !0),
              (n(!0), a(k, null, T(u.lines, (e) => (n(), a("div", {
                key: e.key,
                class: _(["iv-evt-row", [{ nested: u.fight, context: e.role === "context", on: H.value === e.key }, `r-${e.role}`]]),
                style: se({ "--i": e.idx }),
                onMouseenter: (m) => H.value = e.key,
                onMouseleave: s[1] || (s[1] = (m) => H.value = null)
              }, [
                i("time", null, o(u.fight ? e.offset ? `+${e.offset}s` : "" : l(M)(e.ev.t)), 1),
                i("i", {
                  class: _(["iv-evt-dot", [J(e.ev.team), { hollow: e.role === "context" }]])
                }, null, 2),
                be(e.ev) ? (n(), a("span", ht, [
                  e.role === "killer" ? (n(), a(k, { key: 0 }, [
                    i("span", pt, o(l(r)("Killed")), 1),
                    i("span", ft, [
                      i("img", {
                        src: R(e.ev.kill.victim),
                        alt: "",
                        title: A(e.ev.kill.victim)
                      }, null, 8, _t)
                    ]),
                    i("b", null, o($(e.ev.kill.victim)), 1)
                  ], 64)) : e.role === "victim" ? (n(), a(k, { key: 1 }, [
                    i("span", yt, o(e.ev.kill.killer ? l(r)("Slain by") : l(r)("Executed")), 1),
                    e.ev.kill.killer ? (n(), a(k, { key: 0 }, [
                      i("span", gt, [
                        i("img", {
                          src: R(e.ev.kill.killer),
                          alt: "",
                          title: A(e.ev.kill.killer)
                        }, null, 8, bt)
                      ]),
                      i("b", null, o($(e.ev.kill.killer)), 1)
                    ], 64)) : y("", !0)
                  ], 64)) : e.role === "assist" ? (n(), a(k, { key: 2 }, [
                    i("span", Et, o(l(r)("Helped kill")), 1),
                    i("span", It, [
                      i("img", {
                        src: R(e.ev.kill.victim),
                        alt: "",
                        title: A(e.ev.kill.victim)
                      }, null, 8, Nt)
                    ]),
                    i("b", null, o($(e.ev.kill.victim)), 1)
                  ], 64)) : (n(), a(k, { key: 3 }, [
                    e.ev.kill.killer ? (n(), a(k, { key: 0 }, [
                      i("span", Tt, [
                        i("img", {
                          src: R(e.ev.kill.killer),
                          alt: "",
                          title: A(e.ev.kill.killer)
                        }, null, 8, Rt)
                      ]),
                      i("b", null, o($(e.ev.kill.killer)), 1)
                    ], 64)) : y("", !0),
                    i("span", At, o(e.ev.kill.killer ? l(r)("killed") : l(r)("Executed")), 1),
                    i("span", jt, [
                      i("img", {
                        src: R(e.ev.kill.victim),
                        alt: "",
                        title: A(e.ev.kill.victim)
                      }, null, 8, xt)
                    ]),
                    i("span", Ot, o($(e.ev.kill.victim)), 1)
                  ], 64)),
                  ie(e).length ? (n(), a("span", {
                    key: 4,
                    class: "iv-evt-stack",
                    title: l(r)("With")
                  }, [
                    (n(!0), a(k, null, T(ie(e), (m) => (n(), a("img", {
                      key: m,
                      src: R(m),
                      title: A(m),
                      alt: ""
                    }, null, 8, St))), 128))
                  ], 8, Mt)) : y("", !0),
                  te(e.ev) ? (n(), a("span", {
                    key: 5,
                    class: _(["iv-badge", { gold: !e.ev.first }])
                  }, o(te(e.ev)), 3)) : y("", !0)
                ])) : Ee(e.ev) ? (n(), a("span", $t, [
                  i("span", {
                    class: _(["iv-evt-obj", J(e.ev.team)]),
                    title: e.ev.team === N.value ? l(r)("Your team") : l(r)("Enemy team")
                  }, [
                    je(Fe, {
                      name: me[e.ev.obj.kind],
                      size: 15
                    }, null, 8, ["name"])
                  ], 10, wt),
                  e.role === "took" ? (n(), a("span", Ct, o(e.ev.obj.kind === "tower" || e.ev.obj.kind === "inhibitor" ? l(r)("Destroyed") : l(r)("Took")), 1)) : y("", !0),
                  i("b", null, o(_e(e.ev.obj)), 1),
                  e.ev.count > 1 ? (n(), a("span", Dt, "×" + o(e.ev.count), 1)) : y("", !0),
                  ee(e.ev.obj) ? (n(), a("span", Ht, o(ee(e.ev.obj)), 1)) : y("", !0),
                  e.role !== "took" && D(e.ev.obj.killer) ? (n(), a("span", {
                    key: 3,
                    class: "iv-evt-stack solo",
                    title: A(e.ev.obj.killer)
                  }, [
                    i("img", {
                      src: R(e.ev.obj.killer),
                      alt: ""
                    }, null, 8, Lt)
                  ], 8, Gt)) : y("", !0)
                ])) : y("", !0),
                H.value === e.key ? (n(), a("span", Bt, [
                  (n(!0), a(k, null, T([ge(e.ev)], (m) => (n(), a(k, {
                    key: m.lead
                  }, [
                    i("span", null, [
                      i("em", Ft, o(m.ours), 1),
                      s[6] || (s[6] = i("i", null, "–", -1)),
                      i("em", Ut, o(m.theirs), 1)
                    ]),
                    i("span", {
                      class: _(m.lead > 0 ? "ally" : m.lead < 0 ? "enemy" : "")
                    }, o(m.lead === 0 ? l(r)("even") : l(q)(m.lead)), 3)
                  ], 64))), 128))
                ])) : y("", !0)
              ], 46, kt))), 128))
            ], 2))), 128))
          ])) : (n(), a("p", at, o(f.value === "player" ? l(r)("Quiet for {name}", { name: l(I)(E.value?.championId ?? 0) }) : l(r)("Nothing here")), 1))
        ]))), 128))
      ], 34))
    ]));
  }
});
export {
  Zt as default
};
