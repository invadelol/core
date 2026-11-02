import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
import { defineComponent as ue, computed as h, openBlock as o, createElementBlock as n, createElementVNode as l, toDisplayString as u, unref as s, Fragment as v, renderList as _, normalizeClass as k, createCommentVNode as p, createTextVNode as S, createVNode as F, normalizeStyle as $, createBlock as K } from "vue";
import { useInvadeUi as ce, useFormat as de, useNames as ve } from "../context.js";
import { hideBroken as m } from "../dom.js";
import { provideStatGroups as pe } from "../fit.js";
import { skillMatrix as me, skillPriority as _e, relation as J, laneLead as he, PINGS as U, SCORE_PARTS as be } from "../logic/detail.js";
import { positionName as ke } from "../logic/labels.js";
import ge from "./PerfDial.vue.js";
/* empty css              */
import ye from "./RoleIcon.vue.js";
import X from "./StatLabel.vue.js";
/* empty css                 */
/* empty css                       */
/* empty css                   */
const fe = { class: "iv-pd" }, we = { class: "iv-pd-grid" }, Ie = { class: "iv-pd-col" }, Se = { class: "iv-label" }, Ne = { class: "iv-pd-items" }, Ce = ["src", "alt", "title"], De = { class: "iv-pd-kit" }, Ee = { class: "iv-label" }, je = { class: "iv-pd-spells" }, xe = ["src", "alt", "title"], $e = { key: 0 }, Pe = { class: "iv-label" }, Te = { class: "iv-pd-prio" }, Ge = { key: 0 }, Me = {
  key: 0,
  class: "iv-pd-block"
}, Ve = { class: "iv-label" }, Be = { class: "iv-pd-skills" }, Oe = {
  key: 1,
  class: "iv-pd-block iv-pd-runes"
}, Le = { class: "iv-pd-tree" }, ze = ["src"], We = { class: "iv-pd-rune key" }, Re = ["src"], Ae = ["src"], Fe = { key: 0 }, Ke = { class: "iv-pd-tree" }, Je = ["src"], Ue = ["src"], Xe = {
  key: 0,
  class: "iv-pd-shards"
}, qe = ["src", "alt", "title"], He = { class: "iv-pd-col" }, Qe = {
  key: 0,
  class: "iv-pd-score"
}, Ye = { key: 0 }, Ze = {
  key: 1,
  class: "iv-pd-parts"
}, el = { class: "iv-pd-meter" }, ll = ["title"], sl = { class: "iv-label" }, tl = { class: "iv-pd-stats" }, al = {
  key: 0,
  class: "iv-pd-meter"
}, ol = {
  key: 0,
  class: "iv-pd-col"
}, nl = { key: 0 }, il = { class: "iv-label" }, rl = { class: "iv-pd-vs" }, ul = { class: "iv-pd-who" }, cl = ["src"], dl = ["title"], vl = { class: "iv-brk-vs" }, pl = { class: "iv-pd-who right" }, ml = ["title"], _l = ["src"], hl = { class: "iv-brk-rows" }, bl = { class: "iv-brk-row-label" }, kl = { class: "iv-brk-split" }, gl = { class: "iv-pd-after" }, yl = {
  key: 0,
  class: "iv-pd-block iv-pd-rule"
}, fl = { class: "iv-label" }, wl = { class: "iv-pd-check" }, Il = { class: "iv-label" }, Sl = {
  key: 0,
  class: "iv-pd-stats"
}, Nl = { class: "iv-pd-meter" }, Cl = {
  key: 1,
  class: "iv-pf-note"
}, zl = /* @__PURE__ */ ue({
  __name: "PlayerDetail",
  props: {
    detail: {},
    player: {},
    me: {}
  },
  setup(G) {
    const g = G, { t: i } = ce(), { compact: b, num: y, ordinal: q, score100: H, signedGold: M } = de(), { champIcon: V, champName: P, itemIcon: Q, itemName: B, runeIcon: E, runeName: D, spellIcon: Y, spellName: O, styleIcon: L, styleName: z } = ve();
    pe();
    const c = h(() => g.player), f = h(() => g.detail.players.find((a) => a.participantId === c.value.opponent)), Z = h(() => Math.max(g.detail.duration / 60, 1)), ee = h(() => c.value.badges.includes("mvp") ? "mvp" : c.value.badges.includes("ace") ? "ace" : ""), le = h(() => me(c.value.skills)), W = h(() => _e(c.value.skills)), w = h(() => {
      const [a, t] = c.value.styles, [e, ...r] = c.value.perks.filter(Boolean);
      return { primary: a, keystone: e, minor: r.slice(0, 3), secondary: t, picks: r.slice(3) };
    }), se = (a) => Math.max(1, ...g.detail.players.map(a)), I = (a) => a(c.value) / se(a) * 100, te = h(() => {
      const a = c.value;
      return [
        {
          title: i("Combat"),
          icon: "damage",
          rows: [
            { label: i("Damage to champions"), value: b(a.damage), bar: I((t) => t.damage) },
            { label: i("Damage taken"), value: b(a.damageTaken), bar: I((t) => t.damageTaken) },
            { label: i("Physical"), value: b(a.physical), dot: 1 },
            { label: i("Magic"), value: b(a.magic), dot: 2 },
            { label: i("True"), value: b(a.trueDamage), dot: 3 }
          ]
        },
        {
          title: i("Vision & objectives"),
          icon: "vision",
          rows: [
            { label: i("Vision score"), value: y(a.vision), bar: I((t) => t.vision) },
            { label: i("Wards placed"), value: y(a.wardsPlaced), bar: I((t) => t.wardsPlaced) },
            { label: i("Wards destroyed"), value: y(a.wardsKilled), bar: I((t) => t.wardsKilled) },
            { label: i("Control wards"), value: y(a.controlWards), bar: I((t) => t.controlWards) },
            { label: i("Objective damage"), value: b(a.objectiveDamage), bar: I((t) => t.objectiveDamage) },
            { label: i("Turret damage"), value: b(a.turretDamage), bar: I((t) => t.turretDamage) }
          ]
        },
        {
          title: i("Economy"),
          icon: "gold",
          rows: [
            { label: i("Gold"), value: b(a.gold), bar: I((t) => t.gold) },
            { label: i("Gold per minute"), value: y(a.gold / Z.value) },
            { label: i("CS"), value: y(a.cs), bar: I((t) => t.cs) },
            { label: i("CS per minute"), value: y(a.csMin, 1) },
            { label: i("Lane minions"), value: y(a.cs - a.jungleCs) },
            { label: i("Jungle monsters"), value: y(a.jungleCs) }
          ]
        }
      ];
    }), ae = h(() => {
      const a = c.value, t = f.value;
      if (!t) return [];
      const e = (d, N, x, A, re) => ({
        label: d,
        icon: re,
        mine: A(N),
        theirs: A(x),
        lead: Math.sign(N - x),
        share: N + x > 0 ? N / (N + x) * 100 : 50
      }), r = (d) => y(d);
      return [
        e(i("Damage"), a.damage, t.damage, b, "damage"),
        e(i("Taken"), a.damageTaken, t.damageTaken, b, "taken"),
        e(i("Gold"), a.gold, t.gold, b, "gold"),
        e(i("CS"), a.cs, t.cs, r, "cs"),
        e(i("Vision"), a.vision, t.vision, r, "vision"),
        e(i("Objectives"), a.objectiveDamage, t.objectiveDamage, b)
      ];
    }), oe = h(() => f.value ? J(f.value.teamId, g.me) : "enemy"), ne = h(() => g.me && c.value.participantId === g.me.participantId ? "self" : J(c.value.teamId, g.me)), R = h(() => {
      const a = g.detail.timeline, t = f.value;
      if (!a || !t) return [];
      const e = g.detail.players.indexOf(c.value), r = g.detail.players.indexOf(t);
      return [10, 15].flatMap((d) => he(a, e, r, d) ?? []);
    }), T = (a) => a > 0 ? "iv-up" : a < 0 ? "iv-down" : "", ie = (a) => `${a > 0 ? "+" : ""}${y(a)}`, C = h(() => {
      const a = c.value.pings;
      if (!a) return null;
      const t = Object.keys(U).filter((r) => a[r] > 0).map((r) => ({ label: i(U[r]), n: a[r] }));
      return { total: t.reduce((r, d) => r + d.n, 0), rows: t.sort((r, d) => d.n - r.n) };
    }), j = (a) => a.gameName || P(a.championId);
    return (a, t) => (o(), n("div", fe, [
      l("div", we, [
        l("section", Ie, [
          l("h4", Se, u(s(i)("Build")), 1),
          l("span", Ne, [
            (o(!0), n(v, null, _(c.value.items, (e, r) => (o(), n(v, { key: r }, [
              e ? (o(), n("img", {
                key: 0,
                src: s(Q)(e),
                alt: s(B)(e),
                title: s(B)(e),
                class: k({ trinket: r === 6 }),
                onError: t[0] || (t[0] = //@ts-ignore
                (...d) => s(m) && s(m)(...d))
              }, null, 42, Ce)) : (o(), n("i", {
                key: 1,
                class: k({ trinket: r === 6 })
              }, null, 2))
            ], 64))), 128))
          ]),
          l("div", De, [
            l("div", null, [
              l("h4", Ee, u(s(i)("Spells")), 1),
              l("span", je, [
                (o(!0), n(v, null, _(c.value.spells, (e, r) => (o(), n("img", {
                  key: r,
                  src: s(Y)(e),
                  alt: s(O)(e),
                  title: s(O)(e),
                  onError: t[1] || (t[1] = //@ts-ignore
                  (...d) => s(m) && s(m)(...d))
                }, null, 40, xe))), 128))
              ])
            ]),
            W.value.length ? (o(), n("div", $e, [
              l("h4", Pe, u(s(i)("Skill priority")), 1),
              l("span", Te, [
                (o(!0), n(v, null, _(W.value, (e, r) => (o(), n(v, { key: e }, [
                  r ? (o(), n("i", Ge, "›")) : p("", !0),
                  l("b", null, u(e), 1)
                ], 64))), 128))
              ])
            ])) : p("", !0)
          ]),
          c.value.skills.length ? (o(), n("div", Me, [
            l("h4", Ve, u(s(i)("Skill order")), 1),
            l("div", Be, [
              (o(!0), n(v, null, _(le.value, (e, r) => (o(), n("div", {
                key: r,
                class: "iv-pd-skill-row"
              }, [
                l("span", null, u(r), 1),
                (o(!0), n(v, null, _(e, (d, N) => (o(), n("i", {
                  key: N,
                  class: k({ on: d, r: r === "R" })
                }, u(d), 3))), 128))
              ]))), 128))
            ])
          ])) : p("", !0),
          w.value.keystone ? (o(), n("div", Oe, [
            l("div", null, [
              l("h4", Le, [
                l("img", {
                  src: s(L)(w.value.primary),
                  alt: "",
                  onError: t[2] || (t[2] = //@ts-ignore
                  (...e) => s(m) && s(m)(...e))
                }, null, 40, ze),
                S(u(s(z)(w.value.primary)), 1)
              ]),
              l("p", We, [
                l("img", {
                  src: s(E)(w.value.keystone),
                  alt: "",
                  onError: t[3] || (t[3] = //@ts-ignore
                  (...e) => s(m) && s(m)(...e))
                }, null, 40, Re),
                S(u(s(D)(w.value.keystone)), 1)
              ]),
              (o(!0), n(v, null, _(w.value.minor, (e) => (o(), n("p", {
                key: e,
                class: "iv-pd-rune"
              }, [
                l("img", {
                  src: s(E)(e),
                  alt: "",
                  onError: t[4] || (t[4] = //@ts-ignore
                  (...r) => s(m) && s(m)(...r))
                }, null, 40, Ae),
                S(u(s(D)(e)), 1)
              ]))), 128))
            ]),
            w.value.secondary ? (o(), n("div", Fe, [
              l("h4", Ke, [
                l("img", {
                  src: s(L)(w.value.secondary),
                  alt: "",
                  onError: t[5] || (t[5] = //@ts-ignore
                  (...e) => s(m) && s(m)(...e))
                }, null, 40, Je),
                S(u(s(z)(w.value.secondary)), 1)
              ]),
              (o(!0), n(v, null, _(w.value.picks, (e) => (o(), n("p", {
                key: e,
                class: "iv-pd-rune"
              }, [
                l("img", {
                  src: s(E)(e),
                  alt: "",
                  onError: t[6] || (t[6] = //@ts-ignore
                  (...r) => s(m) && s(m)(...r))
                }, null, 40, Ue),
                S(u(s(D)(e)), 1)
              ]))), 128)),
              c.value.shards ? (o(), n("p", Xe, [
                (o(!0), n(v, null, _(c.value.shards, (e, r) => (o(), n("img", {
                  key: r,
                  src: s(E)(e),
                  alt: s(D)(e),
                  title: s(D)(e),
                  onError: t[7] || (t[7] = //@ts-ignore
                  (...d) => s(m) && s(m)(...d))
                }, null, 40, qe))), 128))
              ])) : p("", !0)
            ])) : p("", !0)
          ])) : p("", !0)
        ]),
        l("section", He, [
          c.value.score !== null ? (o(), n("div", Qe, [
            F(ge, {
              score: s(H)(c.value.score),
              rank: c.value.rank,
              tag: ee.value
            }, null, 8, ["score", "rank", "tag"]),
            l("span", null, [
              l("b", null, u(s(i)("Score")), 1),
              c.value.rank ? (o(), n("small", Ye, u(s(i)("{place} of {n} in this game", { place: s(q)(c.value.rank), n: G.detail.players.length })), 1)) : p("", !0)
            ])
          ])) : p("", !0),
          c.value.parts.length ? (o(), n("ul", Ze, [
            (o(!0), n(v, null, _(c.value.parts, (e) => (o(), n("li", {
              key: e.key
            }, [
              l("span", null, u(s(i)(s(be)[e.key])), 1),
              l("i", el, [
                l("em", {
                  style: $({ width: `${e.value}%` })
                }, null, 4)
              ]),
              l("b", null, u(e.value), 1),
              l("small", {
                title: s(i)("{n}% of the score for this role", { n: e.weight })
              }, "×" + u(e.weight) + "%", 9, ll)
            ]))), 128))
          ])) : p("", !0),
          (o(!0), n(v, null, _(te.value, (e) => (o(), n("div", {
            key: e.title,
            class: "iv-pd-block"
          }, [
            l("h4", sl, [
              F(X, {
                stat: e.icon,
                label: e.title,
                size: 13
              }, null, 8, ["stat", "label"])
            ]),
            l("ul", tl, [
              (o(!0), n(v, null, _(e.rows, (r) => (o(), n("li", {
                key: r.label
              }, [
                l("span", null, [
                  r.dot ? (o(), n("i", {
                    key: 0,
                    class: k(["iv-pd-dot", `d${r.dot}`])
                  }, null, 2)) : p("", !0),
                  S(u(r.label), 1)
                ]),
                l("b", null, u(r.value), 1),
                r.bar !== void 0 ? (o(), n("i", al, [
                  l("em", {
                    style: $({ width: `${r.bar}%` })
                  }, null, 4)
                ])) : p("", !0)
              ]))), 128))
            ])
          ]))), 128))
        ]),
        f.value || C.value ? (o(), n("section", ol, [
          f.value ? (o(), n("div", nl, [
            l("h4", il, u(s(i)("Lane matchup")), 1),
            l("header", rl, [
              l("span", ul, [
                l("img", {
                  src: s(V)(c.value.championId),
                  alt: ""
                }, null, 8, cl),
                l("span", null, [
                  l("b", {
                    title: j(c.value)
                  }, u(j(c.value)), 9, dl),
                  l("small", null, [
                    c.value.position ? (o(), K(ye, {
                      key: 0,
                      lane: c.value.position,
                      size: 11
                    }, null, 8, ["lane"])) : p("", !0),
                    S(u(c.value.position ? s(ke)(c.value.position, s(i)) : s(P)(c.value.championId)), 1)
                  ])
                ])
              ]),
              l("span", vl, u(s(i)("vs")), 1),
              l("span", pl, [
                l("span", null, [
                  l("b", {
                    title: j(f.value)
                  }, u(j(f.value)), 9, ml),
                  l("small", null, u(s(P)(f.value.championId)), 1)
                ]),
                l("img", {
                  src: s(V)(f.value.championId),
                  alt: ""
                }, null, 8, _l)
              ])
            ]),
            l("ul", hl, [
              (o(!0), n(v, null, _(ae.value, (e) => (o(), n("li", {
                key: e.label,
                class: "iv-brk-row",
                style: $({ "--a": `${e.share}%` })
              }, [
                l("span", {
                  class: k(["iv-brk-n", { win: e.lead > 0 }])
                }, u(e.mine), 3),
                l("span", bl, [
                  e.icon ? (o(), K(X, {
                    key: 0,
                    stat: e.icon,
                    label: e.label,
                    group: "duel"
                  }, null, 8, ["stat", "label"])) : (o(), n(v, { key: 1 }, [
                    S(u(e.label), 1)
                  ], 64))
                ]),
                l("span", {
                  class: k(["iv-brk-n right", { win: e.lead < 0 }])
                }, u(e.theirs), 3),
                l("span", kl, [
                  l("i", {
                    class: k(["a", [ne.value, { "iv-brk-ahead": e.lead > 0, "iv-brk-even": !e.lead }]])
                  }, null, 2),
                  l("i", {
                    class: k(["b", [oe.value, { "iv-brk-ahead": e.lead < 0, "iv-brk-even": !e.lead }]])
                  }, null, 2)
                ])
              ], 4))), 128))
            ])
          ])) : p("", !0),
          l("div", gl, [
            R.value.length ? (o(), n("div", yl, [
              l("h4", fl, u(s(i)("Lane checkpoints")), 1),
              l("div", wl, [
                l("span", null, u(s(i)("At")), 1),
                l("span", null, u(s(i)("Gold")), 1),
                l("span", null, u(s(i)("CS")), 1),
                l("span", null, u(s(i)("XP")), 1),
                (o(!0), n(v, null, _(R.value, (e) => (o(), n(v, {
                  key: e.minute
                }, [
                  l("b", null, u(s(i)("{n} min", { n: e.minute })), 1),
                  l("b", {
                    class: k(T(e.gold))
                  }, u(s(M)(e.gold)), 3),
                  l("b", {
                    class: k(T(e.cs))
                  }, u(ie(e.cs)), 3),
                  l("b", {
                    class: k(T(e.xp))
                  }, u(s(M)(e.xp)), 3)
                ], 64))), 128))
              ])
            ])) : p("", !0),
            C.value ? (o(), n("div", {
              key: 1,
              class: k(["iv-pd-block", { "iv-pd-rule": f.value }])
            }, [
              l("h4", Il, u(s(i)("Pings")) + " · " + u(C.value.total), 1),
              C.value.rows.length ? (o(), n("ul", Sl, [
                (o(!0), n(v, null, _(C.value.rows, (e) => (o(), n("li", {
                  key: e.label
                }, [
                  l("span", null, u(e.label), 1),
                  l("b", null, u(e.n), 1),
                  l("i", Nl, [
                    l("em", {
                      style: $({ width: `${e.n / C.value.total * 100}%` })
                    }, null, 4)
                  ])
                ]))), 128))
              ])) : (o(), n("p", Cl, u(s(i)("No pings this game.")), 1))
            ], 2)) : p("", !0)
          ])
        ])) : p("", !0)
      ])
    ]));
  }
});
export {
  zl as default
};
