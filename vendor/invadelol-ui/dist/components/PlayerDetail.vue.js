import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
import { defineComponent as ne, computed as h, openBlock as n, createElementBlock as o, createElementVNode as l, toDisplayString as r, unref as s, Fragment as v, renderList as _, normalizeClass as k, createCommentVNode as p, createTextVNode as N, createVNode as oe, normalizeStyle as P, createBlock as ie } from "vue";
import { useInvadeUi as re, useFormat as ue, useNames as ce } from "../context.js";
import { hideBroken as m } from "../dom.js";
import { skillMatrix as de, skillPriority as ve, relation as F, laneLead as pe, PINGS as K, SCORE_PARTS as me } from "../logic/detail.js";
import { positionName as _e } from "../logic/labels.js";
import he from "./PerfDial.vue.js";
/* empty css              */
import be from "./RoleIcon.vue.js";
/* empty css                 */
/* empty css                       */
/* empty css                   */
const ke = { class: "iv-pd" }, ge = { class: "iv-pd-grid" }, ye = { class: "iv-pd-col" }, we = { class: "iv-label" }, fe = { class: "iv-pd-items" }, Ie = ["src", "alt", "title"], Se = { class: "iv-pd-kit" }, Ne = { class: "iv-label" }, Ce = { class: "iv-pd-spells" }, De = ["src", "alt", "title"], Ee = { key: 0 }, je = { class: "iv-label" }, xe = { class: "iv-pd-prio" }, Pe = { key: 0 }, Te = {
  key: 0,
  class: "iv-pd-block"
}, $e = { class: "iv-label" }, Me = { class: "iv-pd-skills" }, Ve = {
  key: 1,
  class: "iv-pd-block iv-pd-runes"
}, Be = { class: "iv-pd-tree" }, Ge = ["src"], Oe = { class: "iv-pd-rune key" }, Le = ["src"], We = ["src"], ze = { key: 0 }, Re = { class: "iv-pd-tree" }, Ae = ["src"], Fe = ["src"], Ke = {
  key: 0,
  class: "iv-pd-shards"
}, Je = ["src", "alt", "title"], Ue = { class: "iv-pd-col" }, Xe = {
  key: 0,
  class: "iv-pd-score"
}, qe = { key: 0 }, He = {
  key: 1,
  class: "iv-pd-parts"
}, Qe = { class: "iv-pd-meter" }, Ye = ["title"], Ze = { class: "iv-label" }, el = { class: "iv-pd-stats" }, ll = {
  key: 0,
  class: "iv-pd-meter"
}, sl = {
  key: 0,
  class: "iv-pd-col"
}, tl = { key: 0 }, al = { class: "iv-label" }, nl = { class: "iv-pd-vs" }, ol = { class: "iv-pd-who" }, il = ["src"], rl = ["title"], ul = { class: "iv-brk-vs" }, cl = { class: "iv-pd-who right" }, dl = ["title"], vl = ["src"], pl = { class: "iv-brk-rows" }, ml = { class: "iv-brk-row-label" }, _l = { class: "iv-brk-split" }, hl = { class: "iv-pd-after" }, bl = {
  key: 0,
  class: "iv-pd-block iv-pd-rule"
}, kl = { class: "iv-label" }, gl = { class: "iv-pd-check" }, yl = { class: "iv-label" }, wl = {
  key: 0,
  class: "iv-pd-stats"
}, fl = { class: "iv-pd-meter" }, Il = {
  key: 1,
  class: "iv-pf-note"
}, Vl = /* @__PURE__ */ ne({
  __name: "PlayerDetail",
  props: {
    detail: {},
    player: {},
    me: {}
  },
  setup(M) {
    const g = M, { t: i } = re(), { compact: b, num: y, ordinal: J, score100: U, signedGold: V } = ue(), { champIcon: B, champName: T, itemIcon: X, itemName: G, runeIcon: E, runeName: D, spellIcon: q, spellName: O, styleIcon: L, styleName: W } = ce(), c = h(() => g.player), w = h(() => g.detail.players.find((a) => a.participantId === c.value.opponent)), H = h(() => Math.max(g.detail.duration / 60, 1)), Q = h(() => c.value.badges.includes("mvp") ? "mvp" : c.value.badges.includes("ace") ? "ace" : ""), Y = h(() => de(c.value.skills)), z = h(() => ve(c.value.skills)), f = h(() => {
      const [a, t] = c.value.styles, [e, ...u] = c.value.perks.filter(Boolean);
      return { primary: a, keystone: e, minor: u.slice(0, 3), secondary: t, picks: u.slice(3) };
    }), Z = (a) => Math.max(1, ...g.detail.players.map(a)), I = (a) => a(c.value) / Z(a) * 100, ee = h(() => {
      const a = c.value;
      return [
        {
          title: i("Combat"),
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
          rows: [
            { label: i("Gold"), value: b(a.gold), bar: I((t) => t.gold) },
            { label: i("Gold per minute"), value: y(a.gold / H.value) },
            { label: i("CS"), value: y(a.cs), bar: I((t) => t.cs) },
            { label: i("CS per minute"), value: y(a.csMin, 1) },
            { label: i("Lane minions"), value: y(a.cs - a.jungleCs) },
            { label: i("Jungle monsters"), value: y(a.jungleCs) }
          ]
        }
      ];
    }), le = h(() => {
      const a = c.value, t = w.value;
      if (!t) return [];
      const e = (d, S, x, A) => ({
        label: d,
        mine: A(S),
        theirs: A(x),
        lead: Math.sign(S - x),
        share: S + x > 0 ? S / (S + x) * 100 : 50
      }), u = (d) => y(d);
      return [
        e(i("Damage"), a.damage, t.damage, b),
        e(i("Taken"), a.damageTaken, t.damageTaken, b),
        e(i("Gold"), a.gold, t.gold, b),
        e(i("CS"), a.cs, t.cs, u),
        e(i("Vision"), a.vision, t.vision, u),
        e(i("Objectives"), a.objectiveDamage, t.objectiveDamage, b)
      ];
    }), se = h(() => w.value ? F(w.value.teamId, g.me) : "enemy"), te = h(() => g.me && c.value.participantId === g.me.participantId ? "self" : F(c.value.teamId, g.me)), R = h(() => {
      const a = g.detail.timeline, t = w.value;
      if (!a || !t) return [];
      const e = g.detail.players.indexOf(c.value), u = g.detail.players.indexOf(t);
      return [10, 15].flatMap((d) => pe(a, e, u, d) ?? []);
    }), $ = (a) => a > 0 ? "iv-up" : a < 0 ? "iv-down" : "", ae = (a) => `${a > 0 ? "+" : ""}${y(a)}`, C = h(() => {
      const a = c.value.pings;
      if (!a) return null;
      const t = Object.keys(K).filter((u) => a[u] > 0).map((u) => ({ label: i(K[u]), n: a[u] }));
      return { total: t.reduce((u, d) => u + d.n, 0), rows: t.sort((u, d) => d.n - u.n) };
    }), j = (a) => a.gameName || T(a.championId);
    return (a, t) => (n(), o("div", ke, [
      l("div", ge, [
        l("section", ye, [
          l("h4", we, r(s(i)("Build")), 1),
          l("span", fe, [
            (n(!0), o(v, null, _(c.value.items, (e, u) => (n(), o(v, { key: u }, [
              e ? (n(), o("img", {
                key: 0,
                src: s(X)(e),
                alt: s(G)(e),
                title: s(G)(e),
                class: k({ trinket: u === 6 }),
                onError: t[0] || (t[0] = //@ts-ignore
                (...d) => s(m) && s(m)(...d))
              }, null, 42, Ie)) : (n(), o("i", {
                key: 1,
                class: k({ trinket: u === 6 })
              }, null, 2))
            ], 64))), 128))
          ]),
          l("div", Se, [
            l("div", null, [
              l("h4", Ne, r(s(i)("Spells")), 1),
              l("span", Ce, [
                (n(!0), o(v, null, _(c.value.spells, (e, u) => (n(), o("img", {
                  key: u,
                  src: s(q)(e),
                  alt: s(O)(e),
                  title: s(O)(e),
                  onError: t[1] || (t[1] = //@ts-ignore
                  (...d) => s(m) && s(m)(...d))
                }, null, 40, De))), 128))
              ])
            ]),
            z.value.length ? (n(), o("div", Ee, [
              l("h4", je, r(s(i)("Skill priority")), 1),
              l("span", xe, [
                (n(!0), o(v, null, _(z.value, (e, u) => (n(), o(v, { key: e }, [
                  u ? (n(), o("i", Pe, "›")) : p("", !0),
                  l("b", null, r(e), 1)
                ], 64))), 128))
              ])
            ])) : p("", !0)
          ]),
          c.value.skills.length ? (n(), o("div", Te, [
            l("h4", $e, r(s(i)("Skill order")), 1),
            l("div", Me, [
              (n(!0), o(v, null, _(Y.value, (e, u) => (n(), o("div", {
                key: u,
                class: "iv-pd-skill-row"
              }, [
                l("span", null, r(u), 1),
                (n(!0), o(v, null, _(e, (d, S) => (n(), o("i", {
                  key: S,
                  class: k({ on: d, r: u === "R" })
                }, r(d), 3))), 128))
              ]))), 128))
            ])
          ])) : p("", !0),
          f.value.keystone ? (n(), o("div", Ve, [
            l("div", null, [
              l("h4", Be, [
                l("img", {
                  src: s(L)(f.value.primary),
                  alt: "",
                  onError: t[2] || (t[2] = //@ts-ignore
                  (...e) => s(m) && s(m)(...e))
                }, null, 40, Ge),
                N(r(s(W)(f.value.primary)), 1)
              ]),
              l("p", Oe, [
                l("img", {
                  src: s(E)(f.value.keystone),
                  alt: "",
                  onError: t[3] || (t[3] = //@ts-ignore
                  (...e) => s(m) && s(m)(...e))
                }, null, 40, Le),
                N(r(s(D)(f.value.keystone)), 1)
              ]),
              (n(!0), o(v, null, _(f.value.minor, (e) => (n(), o("p", {
                key: e,
                class: "iv-pd-rune"
              }, [
                l("img", {
                  src: s(E)(e),
                  alt: "",
                  onError: t[4] || (t[4] = //@ts-ignore
                  (...u) => s(m) && s(m)(...u))
                }, null, 40, We),
                N(r(s(D)(e)), 1)
              ]))), 128))
            ]),
            f.value.secondary ? (n(), o("div", ze, [
              l("h4", Re, [
                l("img", {
                  src: s(L)(f.value.secondary),
                  alt: "",
                  onError: t[5] || (t[5] = //@ts-ignore
                  (...e) => s(m) && s(m)(...e))
                }, null, 40, Ae),
                N(r(s(W)(f.value.secondary)), 1)
              ]),
              (n(!0), o(v, null, _(f.value.picks, (e) => (n(), o("p", {
                key: e,
                class: "iv-pd-rune"
              }, [
                l("img", {
                  src: s(E)(e),
                  alt: "",
                  onError: t[6] || (t[6] = //@ts-ignore
                  (...u) => s(m) && s(m)(...u))
                }, null, 40, Fe),
                N(r(s(D)(e)), 1)
              ]))), 128)),
              c.value.shards ? (n(), o("p", Ke, [
                (n(!0), o(v, null, _(c.value.shards, (e, u) => (n(), o("img", {
                  key: u,
                  src: s(E)(e),
                  alt: s(D)(e),
                  title: s(D)(e),
                  onError: t[7] || (t[7] = //@ts-ignore
                  (...d) => s(m) && s(m)(...d))
                }, null, 40, Je))), 128))
              ])) : p("", !0)
            ])) : p("", !0)
          ])) : p("", !0)
        ]),
        l("section", Ue, [
          c.value.score !== null ? (n(), o("div", Xe, [
            oe(he, {
              score: s(U)(c.value.score),
              rank: c.value.rank,
              tag: Q.value
            }, null, 8, ["score", "rank", "tag"]),
            l("span", null, [
              l("b", null, r(s(i)("Score")), 1),
              c.value.rank ? (n(), o("small", qe, r(s(i)("{place} of {n} in this game", { place: s(J)(c.value.rank), n: M.detail.players.length })), 1)) : p("", !0)
            ])
          ])) : p("", !0),
          c.value.parts.length ? (n(), o("ul", He, [
            (n(!0), o(v, null, _(c.value.parts, (e) => (n(), o("li", {
              key: e.key
            }, [
              l("span", null, r(s(i)(s(me)[e.key])), 1),
              l("i", Qe, [
                l("em", {
                  style: P({ width: `${e.value}%` })
                }, null, 4)
              ]),
              l("b", null, r(e.value), 1),
              l("small", {
                title: s(i)("{n}% of the score for this role", { n: e.weight })
              }, "×" + r(e.weight) + "%", 9, Ye)
            ]))), 128))
          ])) : p("", !0),
          (n(!0), o(v, null, _(ee.value, (e) => (n(), o("div", {
            key: e.title,
            class: "iv-pd-block"
          }, [
            l("h4", Ze, r(e.title), 1),
            l("ul", el, [
              (n(!0), o(v, null, _(e.rows, (u) => (n(), o("li", {
                key: u.label
              }, [
                l("span", null, [
                  u.dot ? (n(), o("i", {
                    key: 0,
                    class: k(["iv-pd-dot", `d${u.dot}`])
                  }, null, 2)) : p("", !0),
                  N(r(u.label), 1)
                ]),
                l("b", null, r(u.value), 1),
                u.bar !== void 0 ? (n(), o("i", ll, [
                  l("em", {
                    style: P({ width: `${u.bar}%` })
                  }, null, 4)
                ])) : p("", !0)
              ]))), 128))
            ])
          ]))), 128))
        ]),
        w.value || C.value ? (n(), o("section", sl, [
          w.value ? (n(), o("div", tl, [
            l("h4", al, r(s(i)("Lane matchup")), 1),
            l("header", nl, [
              l("span", ol, [
                l("img", {
                  src: s(B)(c.value.championId),
                  alt: ""
                }, null, 8, il),
                l("span", null, [
                  l("b", {
                    title: j(c.value)
                  }, r(j(c.value)), 9, rl),
                  l("small", null, [
                    c.value.position ? (n(), ie(be, {
                      key: 0,
                      lane: c.value.position,
                      size: 11
                    }, null, 8, ["lane"])) : p("", !0),
                    N(r(c.value.position ? s(_e)(c.value.position, s(i)) : s(T)(c.value.championId)), 1)
                  ])
                ])
              ]),
              l("span", ul, r(s(i)("vs")), 1),
              l("span", cl, [
                l("span", null, [
                  l("b", {
                    title: j(w.value)
                  }, r(j(w.value)), 9, dl),
                  l("small", null, r(s(T)(w.value.championId)), 1)
                ]),
                l("img", {
                  src: s(B)(w.value.championId),
                  alt: ""
                }, null, 8, vl)
              ])
            ]),
            l("ul", pl, [
              (n(!0), o(v, null, _(le.value, (e) => (n(), o("li", {
                key: e.label,
                class: "iv-brk-row",
                style: P({ "--a": `${e.share}%` })
              }, [
                l("span", {
                  class: k(["iv-brk-n", { win: e.lead > 0 }])
                }, r(e.mine), 3),
                l("span", ml, r(e.label), 1),
                l("span", {
                  class: k(["iv-brk-n right", { win: e.lead < 0 }])
                }, r(e.theirs), 3),
                l("span", _l, [
                  l("i", {
                    class: k(["a", [te.value, { "iv-brk-ahead": e.lead > 0, "iv-brk-even": !e.lead }]])
                  }, null, 2),
                  l("i", {
                    class: k(["b", [se.value, { "iv-brk-ahead": e.lead < 0, "iv-brk-even": !e.lead }]])
                  }, null, 2)
                ])
              ], 4))), 128))
            ])
          ])) : p("", !0),
          l("div", hl, [
            R.value.length ? (n(), o("div", bl, [
              l("h4", kl, r(s(i)("Lane checkpoints")), 1),
              l("div", gl, [
                l("span", null, r(s(i)("At")), 1),
                l("span", null, r(s(i)("Gold")), 1),
                l("span", null, r(s(i)("CS")), 1),
                l("span", null, r(s(i)("XP")), 1),
                (n(!0), o(v, null, _(R.value, (e) => (n(), o(v, {
                  key: e.minute
                }, [
                  l("b", null, r(s(i)("{n} min", { n: e.minute })), 1),
                  l("b", {
                    class: k($(e.gold))
                  }, r(s(V)(e.gold)), 3),
                  l("b", {
                    class: k($(e.cs))
                  }, r(ae(e.cs)), 3),
                  l("b", {
                    class: k($(e.xp))
                  }, r(s(V)(e.xp)), 3)
                ], 64))), 128))
              ])
            ])) : p("", !0),
            C.value ? (n(), o("div", {
              key: 1,
              class: k(["iv-pd-block", { "iv-pd-rule": w.value }])
            }, [
              l("h4", yl, r(s(i)("Pings")) + " · " + r(C.value.total), 1),
              C.value.rows.length ? (n(), o("ul", wl, [
                (n(!0), o(v, null, _(C.value.rows, (e) => (n(), o("li", {
                  key: e.label
                }, [
                  l("span", null, r(e.label), 1),
                  l("b", null, r(e.n), 1),
                  l("i", fl, [
                    l("em", {
                      style: P({ width: `${e.n / C.value.total * 100}%` })
                    }, null, 4)
                  ])
                ]))), 128))
              ])) : (n(), o("p", Il, r(s(i)("No pings this game.")), 1))
            ], 2)) : p("", !0)
          ])
        ])) : p("", !0)
      ])
    ]));
  }
});
export {
  Vl as default
};
