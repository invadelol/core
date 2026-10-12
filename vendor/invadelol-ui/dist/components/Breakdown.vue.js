import '../styles/base.css';
import '../styles/detail.css';
import { defineComponent as ve, computed as _, shallowRef as me, openBlock as i, createElementBlock as r, unref as b, Fragment as I, renderList as D, createElementVNode as n, normalizeClass as h, toDisplayString as d, createCommentVNode as x, normalizeStyle as Y, createTextVNode as H } from "vue";
import { useInvadeUi as be, useFormat as ge, useNames as he } from "../context.js";
import { relation as U } from "../logic/detail.js";
import { tk as $ } from "../logic/i18n.js";
/* empty css                 */
/* empty css                   */
const ke = { class: "iv-brk" }, pe = ["aria-label"], _e = { class: "iv-brk-label" }, ye = {
  key: 1,
  class: "iv-brk-duels"
}, fe = {
  key: 0,
  class: "iv-brk-duel"
}, xe = { class: "iv-brk-duel-head" }, we = { class: "iv-brk-side" }, Ie = ["src"], Me = ["title"], Te = { class: "iv-brk-vs" }, Se = { class: "iv-brk-side right" }, $e = ["title"], Ce = ["src"], De = { class: "iv-brk-rows" }, Ne = { class: "iv-brk-row-label" }, Pe = { class: "iv-brk-split" }, Ae = {
  key: 0,
  class: "iv-brk-at15"
}, Oe = { key: 0 }, Ee = { key: 1 }, Ge = { key: 2 }, Le = {
  key: 1,
  class: "iv-brk-duel"
}, Ve = { class: "iv-brk-duel-head" }, ze = { class: "iv-brk-side" }, Be = { class: "ally" }, Fe = { class: "iv-brk-vs" }, je = { class: "iv-brk-side right" }, Ke = { class: "enemy" }, We = { class: "iv-brk-rows" }, Re = { class: "iv-brk-row-label" }, Xe = { class: "iv-brk-split" }, Ye = { class: "iv-brk-table-wrap" }, He = {
  key: 0,
  class: "iv-brk-c-gap"
}, Ue = {
  key: 0,
  class: "iv-brk-teams"
}, qe = ["colspan"], Je = ["colspan"], Qe = { class: "iv-brk-heads" }, Ze = { key: 0 }, el = ["title", "aria-pressed", "onPointerenter", "onClick"], ll = ["src"], al = { class: "iv-brk-section" }, tl = ["colspan"], sl = ["title"], nl = {
  key: 0,
  class: "iv-brk-gap"
}, ol = ["onPointerenter", "onClick"], il = { class: "iv-brk-v" }, rl = {
  key: 0,
  class: "iv-brk-bar"
}, gl = /* @__PURE__ */ ve({
  __name: "Breakdown",
  props: {
    detail: {},
    selected: {},
    me: {}
  },
  emits: ["select"],
  setup(N, { emit: se }) {
    const y = N, q = se, { t } = be(), { compact: m, mmss: J, num: w, ordinal: Q, pct: P, signedGold: A } = ge(), { champIcon: F, champName: O } = he(), M = _(() => y.detail.players), E = _(() => M.value[y.selected]), ne = _(() => Math.max(1, y.detail.duration / 60)), G = _(() => y.me?.teamId ?? M.value[0]?.teamId ?? 100), oe = _(() => M.value.some((l) => l.teamId !== G.value)), Z = _(() => M.value.find((l) => l.participantId === E.value?.opponent)), j = (l) => l.mitigated === null ? null : l.damageTaken + l.mitigated, ie = [
      { id: "damage", label: $("damage to champions"), value: (l) => l.damage, figure: (l) => m(l), scope: "game" },
      { id: "share", label: $("of the team’s damage"), value: (l) => l.damageShare, figure: (l) => P(l), scope: "team" },
      { id: "kp", label: $("kill participation"), value: (l) => l.kp, figure: (l) => P(l), scope: "team" },
      { id: "csmin", label: $("CS per minute"), value: (l) => l.csMin, figure: (l) => w(l, 1), scope: "game" },
      { id: "vision", label: $("vision score"), value: (l) => l.vision, figure: (l) => w(l), scope: "game" },
      { id: "deaths", label: (l) => t(l === 1 ? "death" : "deaths"), value: (l) => l.deaths, figure: (l) => w(l), scope: "game", low: !0 },
      { id: "absorbed", label: $("damage absorbed"), value: j, figure: (l) => m(l), scope: "game", strengthOnly: !0 },
      { id: "objectives", label: $("damage to objectives"), value: (l) => l.objectiveDamage, figure: (l) => m(l), scope: "game", strengthOnly: !0 },
      { id: "cc", label: $("crowd control score"), value: (l) => l.ccTime, figure: (l) => w(l), scope: "game", strengthOnly: !0 },
      { id: "healing", label: $("healing"), value: (l) => l.healing, figure: (l) => m(l), scope: "game", strengthOnly: !0 }
    ];
    function re(l, s, e, a) {
      return l === 1 ? t(e === "game" ? a ? "Fewest in the game" : "Most in the game" : a ? "Fewest on the team" : "Most on the team") : l === s ? t(e === "game" ? a ? "Most in the game" : "Fewest in the game" : a ? "Most on the team" : "Fewest on the team") : e === "game" ? t("{rank} in the game", { rank: Q(l) }) : t("{rank} on the team", { rank: Q(l) });
    }
    const ee = _(() => {
      const l = E.value;
      if (!l || y.detail.remake) return [];
      const s = [];
      for (const o of ie) {
        const v = o.scope === "game" ? M.value : M.value.filter((X) => X.teamId === l.teamId), T = o.value(l);
        if (v.length < 2 || T === null || !o.low && T <= 0) continue;
        const z = v.filter((X) => {
          const te = o.value(X) ?? 0;
          return o.low ? te < T : te > T;
        }).length, S = z + 1, B = 1 - z / (v.length - 1);
        s.push({
          id: o.id,
          figure: o.figure(T),
          label: typeof o.label == "string" ? t(o.label) : o.label(T),
          rank: re(S, v.length, o.scope, !!o.low),
          standing: o.scope === "team" ? B * 0.92 : B,
          strengthOnly: o.strengthOnly
        });
      }
      const e = Z.value;
      e && l.gold15 !== null && Math.abs(l.gold15) >= 300 && s.push({
        id: "lane",
        figure: A(l.gold15),
        label: t("gold vs {name} at 15:00", { name: O(e.championId) }),
        rank: l.gold15 > 0 ? t("Won the lane") : t("Lost the lane"),
        standing: l.gold15 > 0 ? 0.6 + Math.min(0.4, l.gold15 / 3750) : 0.4 - Math.min(0.4, -l.gold15 / 3750),
        tone: U(l.teamId, y.me) === "ally" ? l.gold15 > 0 ? "ally" : "enemy" : l.gold15 > 0 ? "enemy" : "ally"
      });
      const a = s.filter((o) => o.standing >= 0.6).sort((o, v) => v.standing - o.standing), u = s.filter((o) => !o.strengthOnly && o.standing <= 0.15).sort((o, v) => o.standing - v.standing)[0], g = a.slice(0, u ? 3 : 4);
      return g.length < 3 && g.push(...s.filter((o) => !g.includes(o) && o !== u && o.standing > 0.3).sort((o, v) => v.standing - o.standing).slice(0, 3 - g.length)), u && g.push(u), g;
    }), k = (l, s, e, a, u = !1) => ({ label: l, a: s, b: e, aText: a(s), bText: a(e), low: u }), f = (l) => l.a === l.b ? 0 : l.a > l.b != !!l.low ? 1 : -1, le = (l) => l.a + l.b > 0 ? l.a / (l.a + l.b) * 100 : 50, C = (l) => w(Math.round(l)), c = _(() => {
      const l = E.value, s = Z.value;
      if (!l || !s) return null;
      const e = (v) => v.deaths ? (v.kills + v.assists) / v.deaths : v.kills + v.assists, [a, u] = [j(l), j(s)], g = [
        { ...k(t("KDA"), e(l), e(s), () => ""), aText: `${l.kills}/${l.deaths}/${l.assists}`, bText: `${s.kills}/${s.deaths}/${s.assists}` },
        k(t("Damage to champions"), l.damage, s.damage, m),
        k(t("Gold"), l.gold, s.gold, m),
        k(t("CS"), l.cs, s.cs, C),
        ...a !== null && u !== null ? [k(t("Damage absorbed"), a, u, m)] : [],
        k(t("Vision score"), l.vision, s.vision, C)
      ], o = l.gold15 !== null || l.cs15 !== null || l.xp15 !== null ? { gold: l.gold15, cs: l.cs15, xp: l.xp15 } : null;
      return { a: l, b: s, rows: g, at15: o, bSide: U(s.teamId, y.me) };
    }), K = (l) => {
      const s = U(E.value?.teamId ?? 0, y.me) === "ally" ? l > 0 : l < 0;
      return l === 0 ? "" : s ? "ally" : "enemy";
    }, ae = (l) => `${l > 0 ? "+" : l < 0 ? "−" : ""}${w(Math.abs(l))}`, L = _(() => {
      if (!oe.value || y.detail.teams.length !== 2) return null;
      const l = y.detail.teams.find((a) => a.teamId === G.value), s = y.detail.teams.find((a) => a.teamId !== G.value);
      if (!l || !s) return null;
      const e = (a, u) => M.value.filter((g) => g.teamId === a).reduce((g, o) => g + u(o), 0);
      return {
        names: y.me ? [t("Your team"), t("Enemy team")] : [t("Blue side"), t("Red side")],
        rows: [
          k(t("Kills"), l.kills, s.kills, C),
          k(t("Gold"), l.gold, s.gold, m),
          k(t("Damage to champions"), l.damage, s.damage, m),
          k(t("Damage taken"), e(l.teamId, (a) => a.damageTaken), e(s.teamId, (a) => a.damageTaken), m),
          k(t("CS"), e(l.teamId, (a) => a.cs), e(s.teamId, (a) => a.cs), C),
          k(t("Vision score"), e(l.teamId, (a) => a.vision), e(s.teamId, (a) => a.vision), C),
          k(t("Turrets"), l.towers, s.towers, C),
          k(t("Dragons"), l.dragons, s.dragons, C),
          k(t("Barons"), l.barons, s.barons, C)
        ]
      };
    }), W = (l) => l / ne.value, ue = _(() => {
      const l = M.value.some((e) => e.gold15 !== null), s = [
        {
          label: t("Combat"),
          stats: [
            { label: t("KDA"), value: (e) => e.deaths ? (e.kills + e.assists) / e.deaths : e.kills + e.assists + 0.01, text: (e) => `${e.kills}/${e.deaths}/${e.assists}` },
            { label: t("Kill participation"), value: (e) => e.kp, text: (e, a) => P(a) },
            { label: t("Largest killing spree"), value: (e) => e.largestSpree },
            { label: t("Largest multi-kill"), value: (e) => e.largestMulti },
            { label: t("Crowd control score"), value: (e) => e.ccTime }
          ]
        },
        {
          label: t("Damage dealt"),
          stats: [
            { label: t("To champions"), value: (e) => e.damage, text: (e, a) => m(a) },
            { label: t("Per minute"), value: (e) => W(e.damage), text: (e, a) => w(Math.round(a)) },
            { label: t("Share of team"), value: (e) => e.damageShare, text: (e, a) => P(a) },
            { label: t("Physical"), value: (e) => e.physical, text: (e, a) => m(a) },
            { label: t("Magic"), value: (e) => e.magic, text: (e, a) => m(a) },
            { label: t("True"), value: (e) => e.trueDamage, text: (e, a) => m(a) },
            { label: t("To objectives"), value: (e) => e.objectiveDamage, text: (e, a) => m(a) },
            { label: t("To turrets"), value: (e) => e.turretDamage, text: (e, a) => m(a) }
          ]
        },
        {
          label: t("Damage taken and healed"),
          stats: [
            { label: t("Taken"), value: (e) => e.damageTaken, text: (e, a) => m(a) },
            { label: t("Mitigated"), value: (e) => e.mitigated, text: (e, a) => m(a) },
            { label: t("Healing"), value: (e) => e.healing, text: (e, a) => m(a) }
          ]
        },
        {
          label: t("Economy"),
          stats: [
            { label: t("Gold"), value: (e) => e.gold, text: (e, a) => m(a) },
            { label: t("Gold per minute"), value: (e) => W(e.gold), text: (e, a) => w(Math.round(a)) },
            { label: t("Gold share"), value: (e) => e.goldShare, text: (e, a) => P(a) },
            { label: t("CS"), value: (e) => e.cs },
            { label: t("CS per minute"), value: (e) => e.csMin, text: (e, a) => w(a, 1) },
            { label: t("Level"), value: (e) => e.level }
          ]
        }
      ];
      return l && s.push({
        label: t("Lane at {time}", { time: J(900) }),
        stats: [
          { label: t("Gold lead"), value: (e) => e.gold15, text: (e, a) => A(a), signed: !0 },
          { label: t("CS lead"), value: (e) => e.cs15, text: (e, a) => ae(a), signed: !0 },
          { label: t("XP lead"), value: (e) => e.xp15, text: (e, a) => A(a), signed: !0 }
        ]
      }), s.push({
        label: t("Vision"),
        stats: [
          { label: t("Vision score"), value: (e) => e.vision },
          { label: t("Per minute"), value: (e) => W(e.vision), text: (e, a) => w(a, 2) },
          { label: t("Wards placed"), value: (e) => e.wardsPlaced },
          { label: t("Wards destroyed"), value: (e) => e.wardsKilled },
          { label: t("Control wards"), value: (e) => e.controlWards }
        ]
      }), s;
    }), p = _(() => {
      const l = M.value.map((a, u) => ({ p: a, i: u })), s = l.filter((a) => a.p.teamId === G.value), e = l.filter((a) => a.p.teamId !== G.value);
      return { mine: s, rest: e, all: [...s, ...e] };
    }), de = _(
      () => ue.value.map((l) => ({
        label: l.label,
        rows: l.stats.flatMap((s) => {
          const e = p.value.all.map(({ p: v }) => s.value(v)), a = e.filter((v) => v !== null);
          if (!a.length) return [];
          const u = a.length ? s.low ? Math.min(...a) : Math.max(...a) : null, g = Math.max(0, ...a), o = p.value.all.map(({ p: v, i: T }, z) => {
            const S = e[z];
            return S === null ? { i: T, text: "–", best: !1, zero: !0, bar: null } : {
              i: T,
              text: s.text ? s.text(v, S) : w(Math.round(S)),
              best: u !== null && S === u && (s.low || S > 0) && a.filter((B) => B === u).length < a.length,
              zero: Math.abs(S) < 1e-9,
              bar: s.signed || g <= 0 ? null : Math.max(0, S) / g
            };
          });
          return [{ label: s.label, cells: [...o.slice(0, p.value.mine.length), null, ...o.slice(p.value.mine.length)] }];
        })
      }))
    ), ce = _(() => p.value.all.length + (p.value.rest.length ? 2 : 1)), V = me(null), R = (l) => `${l.gameName || O(l.championId)} · ${O(l.championId)}`;
    return (l, s) => (i(), r("div", ke, [
      ee.value.length && E.value ? (i(), r("section", {
        key: 0,
        class: "iv-brk-facts",
        "aria-label": b(t)("What stood out")
      }, [
        (i(!0), r(I, null, D(ee.value, (e) => (i(), r("div", {
          key: e.id,
          class: "iv-brk-fact"
        }, [
          n("b", {
            class: h(["iv-brk-fig", e.tone])
          }, d(e.figure), 3),
          n("span", _e, d(e.label), 1),
          n("span", {
            class: h(["iv-brk-rank", { low: e.standing <= 0.15 }])
          }, d(e.rank), 3)
        ]))), 128))
      ], 8, pe)) : x("", !0),
      c.value || L.value ? (i(), r("div", ye, [
        c.value ? (i(), r("section", fe, [
          n("header", xe, [
            n("span", we, [
              n("img", {
                src: b(F)(c.value.a.championId),
                alt: "",
                class: "self"
              }, null, 8, Ie),
              n("b", {
                title: R(c.value.a)
              }, d(c.value.a.gameName || b(O)(c.value.a.championId)), 9, Me)
            ]),
            n("span", Te, d(b(t)("vs")), 1),
            n("span", Se, [
              n("b", {
                title: R(c.value.b)
              }, d(c.value.b.gameName || b(O)(c.value.b.championId)), 9, $e),
              n("img", {
                src: b(F)(c.value.b.championId),
                alt: "",
                class: h(c.value.bSide)
              }, null, 10, Ce)
            ])
          ]),
          n("ul", De, [
            (i(!0), r(I, null, D(c.value.rows, (e) => (i(), r("li", {
              key: e.label,
              class: "iv-brk-row",
              style: Y({ "--a": `${le(e)}%` })
            }, [
              n("span", {
                class: h(["iv-brk-n", { win: f(e) > 0 }])
              }, d(e.aText), 3),
              n("span", Ne, d(e.label), 1),
              n("span", {
                class: h(["iv-brk-n right", { win: f(e) < 0 }])
              }, d(e.bText), 3),
              n("span", Pe, [
                n("i", {
                  class: h(["a self", { "iv-brk-ahead": f(e) > 0, "iv-brk-even": !f(e) }])
                }, null, 2),
                n("i", {
                  class: h(["b", [c.value.bSide, { "iv-brk-ahead": f(e) < 0, "iv-brk-even": !f(e) }]])
                }, null, 2)
              ])
            ], 4))), 128))
          ]),
          c.value.at15 ? (i(), r("p", Ae, [
            n("span", null, d(b(t)("At {time}", { time: b(J)(900) })), 1),
            c.value.at15.gold !== null ? (i(), r("span", Oe, [
              n("b", {
                class: h(K(c.value.at15.gold))
              }, d(b(A)(c.value.at15.gold)), 3),
              H(" " + d(b(t)("gold")), 1)
            ])) : x("", !0),
            c.value.at15.cs !== null ? (i(), r("span", Ee, [
              n("b", {
                class: h(K(c.value.at15.cs))
              }, d(ae(c.value.at15.cs)), 3),
              H(" " + d(b(t)("CS")), 1)
            ])) : x("", !0),
            c.value.at15.xp !== null ? (i(), r("span", Ge, [
              n("b", {
                class: h(K(c.value.at15.xp))
              }, d(b(A)(c.value.at15.xp)), 3),
              H(" " + d(b(t)("XP")), 1)
            ])) : x("", !0)
          ])) : x("", !0)
        ])) : x("", !0),
        L.value ? (i(), r("section", Le, [
          n("header", Ve, [
            n("span", ze, [
              n("b", Be, d(L.value.names[0]), 1)
            ]),
            n("span", Fe, d(b(t)("vs")), 1),
            n("span", je, [
              n("b", Ke, d(L.value.names[1]), 1)
            ])
          ]),
          n("ul", We, [
            (i(!0), r(I, null, D(L.value.rows, (e) => (i(), r("li", {
              key: e.label,
              class: "iv-brk-row",
              style: Y({ "--a": `${le(e)}%` })
            }, [
              n("span", {
                class: h(["iv-brk-n", { win: f(e) > 0 }])
              }, d(e.aText), 3),
              n("span", Re, d(e.label), 1),
              n("span", {
                class: h(["iv-brk-n right", { win: f(e) < 0 }])
              }, d(e.bText), 3),
              n("span", Xe, [
                n("i", {
                  class: h(["a ally", { "iv-brk-ahead": f(e) > 0, "iv-brk-even": !f(e) }])
                }, null, 2),
                n("i", {
                  class: h(["b enemy", { "iv-brk-ahead": f(e) < 0, "iv-brk-even": !f(e) }])
                }, null, 2)
              ])
            ], 4))), 128))
          ])
        ])) : x("", !0)
      ])) : x("", !0),
      n("div", Ye, [
        n("table", {
          class: "iv-brk-table",
          onPointerleave: s[0] || (s[0] = (e) => V.value = null)
        }, [
          n("colgroup", null, [
            s[1] || (s[1] = n("col", { class: "iv-brk-c-label" }, null, -1)),
            (i(!0), r(I, null, D(p.value.all, (e, a) => (i(), r(I, {
              key: e.i
            }, [
              a === p.value.mine.length ? (i(), r("col", He)) : x("", !0),
              n("col", {
                class: h(["iv-brk-c", { on: e.i === N.selected, hover: e.i === V.value }])
              }, null, 2)
            ], 64))), 128))
          ]),
          n("thead", null, [
            p.value.rest.length ? (i(), r("tr", Ue, [
              s[2] || (s[2] = n("th", null, null, -1)),
              n("th", {
                colspan: p.value.mine.length,
                class: "ally"
              }, d(N.me ? b(t)("Your team") : b(t)("Blue side")), 9, qe),
              s[3] || (s[3] = n("th", null, null, -1)),
              n("th", {
                colspan: p.value.rest.length,
                class: "enemy"
              }, d(N.me ? b(t)("Enemy team") : b(t)("Red side")), 9, Je)
            ])) : x("", !0),
            n("tr", Qe, [
              s[4] || (s[4] = n("th", null, null, -1)),
              (i(!0), r(I, null, D(p.value.all, (e, a) => (i(), r(I, {
                key: e.i
              }, [
                a === p.value.mine.length ? (i(), r("th", Ze)) : x("", !0),
                n("th", null, [
                  n("button", {
                    type: "button",
                    class: h(["iv-brk-pick", { on: e.i === N.selected }]),
                    title: R(e.p),
                    "aria-pressed": e.i === N.selected,
                    onPointerenter: (u) => V.value = e.i,
                    onClick: (u) => q("select", e.i)
                  }, [
                    n("img", {
                      src: b(F)(e.p.championId),
                      alt: ""
                    }, null, 8, ll)
                  ], 42, el)
                ])
              ], 64))), 128))
            ])
          ]),
          (i(!0), r(I, null, D(de.value, (e) => (i(), r("tbody", {
            key: e.label
          }, [
            n("tr", al, [
              n("th", { colspan: ce.value }, d(e.label), 9, tl)
            ]),
            (i(!0), r(I, null, D(e.rows, (a) => (i(), r("tr", {
              key: a.label
            }, [
              n("th", {
                scope: "row",
                title: a.label
              }, d(a.label), 9, sl),
              (i(!0), r(I, null, D(a.cells, (u, g) => (i(), r(I, { key: g }, [
                u ? (i(), r("td", {
                  key: 1,
                  class: h({ best: u.best, zero: u.zero, on: u.i === N.selected }),
                  onPointerenter: (o) => V.value = u.i,
                  onClick: (o) => q("select", u.i)
                }, [
                  n("span", il, d(u.text), 1),
                  u.bar !== null ? (i(), r("span", rl, [
                    n("i", {
                      style: Y({ width: `${u.bar * 100}%` })
                    }, null, 4)
                  ])) : x("", !0)
                ], 42, ol)) : (i(), r("td", nl))
              ], 64))), 128))
            ]))), 128))
          ]))), 128))
        ], 32)
      ])
    ]));
  }
});
export {
  gl as default
};
