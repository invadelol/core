import '../styles/base.css';
import '../styles/detail.css';
import { defineComponent as ve, computed as _, shallowRef as me, openBlock as i, createElementBlock as r, unref as b, Fragment as I, renderList as D, createElementVNode as n, normalizeClass as g, toDisplayString as c, createCommentVNode as x, normalizeStyle as Y, createTextVNode as H } from "vue";
import { useInvadeUi as be, useFormat as he, useNames as ge } from "../context.js";
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
}, qe = ["colspan"], Je = ["colspan"], Qe = { class: "iv-brk-heads" }, Ze = { key: 0 }, el = ["title", "aria-pressed", "onPointerenter", "onClick"], ll = ["src"], tl = { class: "iv-brk-section" }, al = ["colspan"], sl = ["title"], nl = {
  key: 0,
  class: "iv-brk-gap"
}, ol = ["onPointerenter", "onClick"], il = { class: "iv-brk-v" }, rl = {
  key: 0,
  class: "iv-brk-bar"
}, hl = /* @__PURE__ */ ve({
  __name: "Breakdown",
  props: {
    detail: {},
    selected: {},
    me: {}
  },
  emits: ["select"],
  setup(N, { emit: se }) {
    const y = N, q = se, { t: a } = be(), { compact: m, mmss: J, num: w, ordinal: Q, pct: P, signedGold: A } = he(), { champIcon: F, champName: O } = ge(), M = _(() => y.detail.players), E = _(() => M.value[y.selected]), ne = _(() => Math.max(1, y.detail.duration / 60)), G = _(() => y.me?.teamId ?? M.value[0]?.teamId ?? 100), oe = _(() => M.value.some((l) => l.teamId !== G.value)), Z = _(() => M.value.find((l) => l.participantId === E.value?.opponent)), j = (l) => l.mitigated === null ? null : l.damageTaken + l.mitigated, ie = [
      { id: "damage", label: $("damage to champions"), value: (l) => l.damage, figure: (l) => m(l), scope: "game" },
      { id: "share", label: $("of the team’s damage"), value: (l) => l.damageShare, figure: (l) => P(l), scope: "team" },
      { id: "kp", label: $("kill participation"), value: (l) => l.kp, figure: (l) => P(l), scope: "team" },
      { id: "csmin", label: $("CS per minute"), value: (l) => l.csMin, figure: (l) => w(l, 1), scope: "game" },
      { id: "vision", label: $("vision score"), value: (l) => l.vision, figure: (l) => w(l), scope: "game" },
      { id: "deaths", label: (l) => a(l === 1 ? "death" : "deaths"), value: (l) => l.deaths, figure: (l) => w(l), scope: "game", low: !0 },
      { id: "absorbed", label: $("damage absorbed"), value: j, figure: (l) => m(l), scope: "game", strengthOnly: !0 },
      { id: "objectives", label: $("damage to objectives"), value: (l) => l.objectiveDamage, figure: (l) => m(l), scope: "game", strengthOnly: !0 },
      { id: "cc", label: $("crowd control score"), value: (l) => l.ccTime, figure: (l) => w(l), scope: "game", strengthOnly: !0 },
      { id: "healing", label: $("healing"), value: (l) => l.healing, figure: (l) => m(l), scope: "game", strengthOnly: !0 }
    ];
    function re(l, s, e, t) {
      return l === 1 ? a(e === "game" ? t ? "Fewest in the game" : "Most in the game" : t ? "Fewest on the team" : "Most on the team") : l === s ? a(e === "game" ? t ? "Most in the game" : "Fewest in the game" : t ? "Most on the team" : "Fewest on the team") : e === "game" ? a("{rank} in the game", { rank: Q(l) }) : a("{rank} on the team", { rank: Q(l) });
    }
    const ee = _(() => {
      const l = E.value;
      if (!l || y.detail.remake) return [];
      const s = [];
      for (const o of ie) {
        const v = o.scope === "game" ? M.value : M.value.filter((X) => X.teamId === l.teamId), T = o.value(l);
        if (v.length < 2 || T === null || !o.low && T <= 0) continue;
        const z = v.filter((X) => {
          const ae = o.value(X) ?? 0;
          return o.low ? ae < T : ae > T;
        }).length, S = z + 1, B = 1 - z / (v.length - 1);
        s.push({
          id: o.id,
          figure: o.figure(T),
          label: typeof o.label == "string" ? a(o.label) : o.label(T),
          rank: re(S, v.length, o.scope, !!o.low),
          standing: o.scope === "team" ? B * 0.92 : B,
          strengthOnly: o.strengthOnly
        });
      }
      const e = Z.value;
      e && l.gold15 !== null && Math.abs(l.gold15) >= 300 && s.push({
        id: "lane",
        figure: A(l.gold15),
        label: a("gold vs {name} at 15:00", { name: O(e.championId) }),
        rank: l.gold15 > 0 ? a("Won the lane") : a("Lost the lane"),
        standing: l.gold15 > 0 ? 0.6 + Math.min(0.4, l.gold15 / 3750) : 0.4 - Math.min(0.4, -l.gold15 / 3750),
        tone: U(l.teamId, y.me) === "ally" ? l.gold15 > 0 ? "ally" : "enemy" : l.gold15 > 0 ? "enemy" : "ally"
      });
      const t = s.filter((o) => o.standing >= 0.6).sort((o, v) => v.standing - o.standing), u = s.filter((o) => !o.strengthOnly && o.standing <= 0.15).sort((o, v) => o.standing - v.standing)[0], h = t.slice(0, u ? 3 : 4);
      return h.length < 3 && h.push(...s.filter((o) => !h.includes(o) && o !== u && o.standing > 0.3).sort((o, v) => v.standing - o.standing).slice(0, 3 - h.length)), u && h.push(u), h;
    }), k = (l, s, e, t, u = !1) => ({ label: l, a: s, b: e, aText: t(s), bText: t(e), low: u }), f = (l) => l.a === l.b ? 0 : l.a > l.b != !!l.low ? 1 : -1, le = (l) => l.a + l.b > 0 ? l.a / (l.a + l.b) * 100 : 50, C = (l) => w(Math.round(l)), d = _(() => {
      const l = E.value, s = Z.value;
      if (!l || !s) return null;
      const e = (v) => v.deaths ? (v.kills + v.assists) / v.deaths : v.kills + v.assists, [t, u] = [j(l), j(s)], h = [
        { ...k(a("KDA"), e(l), e(s), () => ""), aText: `${l.kills}/${l.deaths}/${l.assists}`, bText: `${s.kills}/${s.deaths}/${s.assists}` },
        k(a("Damage to champions"), l.damage, s.damage, m),
        k(a("Gold"), l.gold, s.gold, m),
        k(a("CS"), l.cs, s.cs, C),
        ...t !== null && u !== null ? [k(a("Damage absorbed"), t, u, m)] : [],
        k(a("Vision score"), l.vision, s.vision, C)
      ], o = l.gold15 !== null || l.cs15 !== null || l.xp15 !== null ? { gold: l.gold15, cs: l.cs15, xp: l.xp15 } : null;
      return { a: l, b: s, rows: h, at15: o, bSide: U(s.teamId, y.me) };
    }), K = (l) => {
      const s = U(E.value?.teamId ?? 0, y.me) === "ally" ? l > 0 : l < 0;
      return l === 0 ? "" : s ? "ally" : "enemy";
    }, te = (l) => `${l > 0 ? "+" : l < 0 ? "−" : ""}${w(Math.abs(l))}`, L = _(() => {
      if (!oe.value || y.detail.teams.length !== 2) return null;
      const l = y.detail.teams.find((t) => t.teamId === G.value), s = y.detail.teams.find((t) => t.teamId !== G.value);
      if (!l || !s) return null;
      const e = (t, u) => M.value.filter((h) => h.teamId === t).reduce((h, o) => h + u(o), 0);
      return {
        names: y.me ? [a("Your team"), a("Enemy team")] : [a("Blue side"), a("Red side")],
        rows: [
          k(a("Kills"), l.kills, s.kills, C),
          k(a("Gold"), l.gold, s.gold, m),
          k(a("Damage to champions"), l.damage, s.damage, m),
          k(a("CS"), e(l.teamId, (t) => t.cs), e(s.teamId, (t) => t.cs), C),
          k(a("Vision score"), e(l.teamId, (t) => t.vision), e(s.teamId, (t) => t.vision), C),
          k(a("Turrets"), l.towers, s.towers, C),
          k(a("Dragons"), l.dragons, s.dragons, C),
          k(a("Barons"), l.barons, s.barons, C)
        ]
      };
    }), W = (l) => l / ne.value, ue = _(() => {
      const l = M.value.some((e) => e.gold15 !== null), s = [
        {
          label: a("Combat"),
          stats: [
            { label: a("KDA"), value: (e) => e.deaths ? (e.kills + e.assists) / e.deaths : e.kills + e.assists + 0.01, text: (e) => `${e.kills}/${e.deaths}/${e.assists}` },
            { label: a("Kill participation"), value: (e) => e.kp, text: (e, t) => P(t) },
            { label: a("Largest killing spree"), value: (e) => e.largestSpree },
            { label: a("Largest multi-kill"), value: (e) => e.largestMulti },
            { label: a("Crowd control score"), value: (e) => e.ccTime }
          ]
        },
        {
          label: a("Damage dealt"),
          stats: [
            { label: a("To champions"), value: (e) => e.damage, text: (e, t) => m(t) },
            { label: a("Per minute"), value: (e) => W(e.damage), text: (e, t) => w(Math.round(t)) },
            { label: a("Share of team"), value: (e) => e.damageShare, text: (e, t) => P(t) },
            { label: a("Physical"), value: (e) => e.physical, text: (e, t) => m(t) },
            { label: a("Magic"), value: (e) => e.magic, text: (e, t) => m(t) },
            { label: a("True"), value: (e) => e.trueDamage, text: (e, t) => m(t) },
            { label: a("To objectives"), value: (e) => e.objectiveDamage, text: (e, t) => m(t) },
            { label: a("To turrets"), value: (e) => e.turretDamage, text: (e, t) => m(t) }
          ]
        },
        {
          label: a("Damage taken and healed"),
          stats: [
            { label: a("Taken"), value: (e) => e.damageTaken, text: (e, t) => m(t) },
            { label: a("Mitigated"), value: (e) => e.mitigated, text: (e, t) => m(t) },
            { label: a("Healing"), value: (e) => e.healing, text: (e, t) => m(t) }
          ]
        },
        {
          label: a("Economy"),
          stats: [
            { label: a("Gold"), value: (e) => e.gold, text: (e, t) => m(t) },
            { label: a("Gold per minute"), value: (e) => W(e.gold), text: (e, t) => w(Math.round(t)) },
            { label: a("Gold share"), value: (e) => e.goldShare, text: (e, t) => P(t) },
            { label: a("CS"), value: (e) => e.cs },
            { label: a("CS per minute"), value: (e) => e.csMin, text: (e, t) => w(t, 1) },
            { label: a("Level"), value: (e) => e.level }
          ]
        }
      ];
      return l && s.push({
        label: a("Lane at {time}", { time: J(900) }),
        stats: [
          { label: a("Gold lead"), value: (e) => e.gold15, text: (e, t) => A(t), signed: !0 },
          { label: a("CS lead"), value: (e) => e.cs15, text: (e, t) => te(t), signed: !0 },
          { label: a("XP lead"), value: (e) => e.xp15, text: (e, t) => A(t), signed: !0 }
        ]
      }), s.push({
        label: a("Vision"),
        stats: [
          { label: a("Vision score"), value: (e) => e.vision },
          { label: a("Per minute"), value: (e) => W(e.vision), text: (e, t) => w(t, 2) },
          { label: a("Wards placed"), value: (e) => e.wardsPlaced },
          { label: a("Wards destroyed"), value: (e) => e.wardsKilled },
          { label: a("Control wards"), value: (e) => e.controlWards }
        ]
      }), s;
    }), p = _(() => {
      const l = M.value.map((t, u) => ({ p: t, i: u })), s = l.filter((t) => t.p.teamId === G.value), e = l.filter((t) => t.p.teamId !== G.value);
      return { mine: s, rest: e, all: [...s, ...e] };
    }), ce = _(
      () => ue.value.map((l) => ({
        label: l.label,
        rows: l.stats.flatMap((s) => {
          const e = p.value.all.map(({ p: v }) => s.value(v)), t = e.filter((v) => v !== null);
          if (!t.length) return [];
          const u = t.length ? s.low ? Math.min(...t) : Math.max(...t) : null, h = Math.max(0, ...t), o = p.value.all.map(({ p: v, i: T }, z) => {
            const S = e[z];
            return S === null ? { i: T, text: "–", best: !1, zero: !0, bar: null } : {
              i: T,
              text: s.text ? s.text(v, S) : w(Math.round(S)),
              best: u !== null && S === u && (s.low || S > 0) && t.filter((B) => B === u).length < t.length,
              zero: Math.abs(S) < 1e-9,
              bar: s.signed || h <= 0 ? null : Math.max(0, S) / h
            };
          });
          return [{ label: s.label, cells: [...o.slice(0, p.value.mine.length), null, ...o.slice(p.value.mine.length)] }];
        })
      }))
    ), de = _(() => p.value.all.length + (p.value.rest.length ? 2 : 1)), V = me(null), R = (l) => `${l.gameName || O(l.championId)} · ${O(l.championId)}`;
    return (l, s) => (i(), r("div", ke, [
      ee.value.length && E.value ? (i(), r("section", {
        key: 0,
        class: "iv-brk-facts",
        "aria-label": b(a)("What stood out")
      }, [
        (i(!0), r(I, null, D(ee.value, (e) => (i(), r("div", {
          key: e.id,
          class: "iv-brk-fact"
        }, [
          n("b", {
            class: g(["iv-brk-fig", e.tone])
          }, c(e.figure), 3),
          n("span", _e, c(e.label), 1),
          n("span", {
            class: g(["iv-brk-rank", { low: e.standing <= 0.15 }])
          }, c(e.rank), 3)
        ]))), 128))
      ], 8, pe)) : x("", !0),
      d.value || L.value ? (i(), r("div", ye, [
        d.value ? (i(), r("section", fe, [
          n("header", xe, [
            n("span", we, [
              n("img", {
                src: b(F)(d.value.a.championId),
                alt: "",
                class: "self"
              }, null, 8, Ie),
              n("b", {
                title: R(d.value.a)
              }, c(d.value.a.gameName || b(O)(d.value.a.championId)), 9, Me)
            ]),
            n("span", Te, c(b(a)("vs")), 1),
            n("span", Se, [
              n("b", {
                title: R(d.value.b)
              }, c(d.value.b.gameName || b(O)(d.value.b.championId)), 9, $e),
              n("img", {
                src: b(F)(d.value.b.championId),
                alt: "",
                class: g(d.value.bSide)
              }, null, 10, Ce)
            ])
          ]),
          n("ul", De, [
            (i(!0), r(I, null, D(d.value.rows, (e) => (i(), r("li", {
              key: e.label,
              class: "iv-brk-row",
              style: Y({ "--a": `${le(e)}%` })
            }, [
              n("span", {
                class: g(["iv-brk-n", { win: f(e) > 0 }])
              }, c(e.aText), 3),
              n("span", Ne, c(e.label), 1),
              n("span", {
                class: g(["iv-brk-n right", { win: f(e) < 0 }])
              }, c(e.bText), 3),
              n("span", Pe, [
                n("i", {
                  class: g(["a self", { "iv-brk-ahead": f(e) > 0, "iv-brk-even": !f(e) }])
                }, null, 2),
                n("i", {
                  class: g(["b", [d.value.bSide, { "iv-brk-ahead": f(e) < 0, "iv-brk-even": !f(e) }]])
                }, null, 2)
              ])
            ], 4))), 128))
          ]),
          d.value.at15 ? (i(), r("p", Ae, [
            n("span", null, c(b(a)("At {time}", { time: b(J)(900) })), 1),
            d.value.at15.gold !== null ? (i(), r("span", Oe, [
              n("b", {
                class: g(K(d.value.at15.gold))
              }, c(b(A)(d.value.at15.gold)), 3),
              H(" " + c(b(a)("gold")), 1)
            ])) : x("", !0),
            d.value.at15.cs !== null ? (i(), r("span", Ee, [
              n("b", {
                class: g(K(d.value.at15.cs))
              }, c(te(d.value.at15.cs)), 3),
              H(" " + c(b(a)("CS")), 1)
            ])) : x("", !0),
            d.value.at15.xp !== null ? (i(), r("span", Ge, [
              n("b", {
                class: g(K(d.value.at15.xp))
              }, c(b(A)(d.value.at15.xp)), 3),
              H(" " + c(b(a)("XP")), 1)
            ])) : x("", !0)
          ])) : x("", !0)
        ])) : x("", !0),
        L.value ? (i(), r("section", Le, [
          n("header", Ve, [
            n("span", ze, [
              n("b", Be, c(L.value.names[0]), 1)
            ]),
            n("span", Fe, c(b(a)("vs")), 1),
            n("span", je, [
              n("b", Ke, c(L.value.names[1]), 1)
            ])
          ]),
          n("ul", We, [
            (i(!0), r(I, null, D(L.value.rows, (e) => (i(), r("li", {
              key: e.label,
              class: "iv-brk-row",
              style: Y({ "--a": `${le(e)}%` })
            }, [
              n("span", {
                class: g(["iv-brk-n", { win: f(e) > 0 }])
              }, c(e.aText), 3),
              n("span", Re, c(e.label), 1),
              n("span", {
                class: g(["iv-brk-n right", { win: f(e) < 0 }])
              }, c(e.bText), 3),
              n("span", Xe, [
                n("i", {
                  class: g(["a ally", { "iv-brk-ahead": f(e) > 0, "iv-brk-even": !f(e) }])
                }, null, 2),
                n("i", {
                  class: g(["b enemy", { "iv-brk-ahead": f(e) < 0, "iv-brk-even": !f(e) }])
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
            (i(!0), r(I, null, D(p.value.all, (e, t) => (i(), r(I, {
              key: e.i
            }, [
              t === p.value.mine.length ? (i(), r("col", He)) : x("", !0),
              n("col", {
                class: g(["iv-brk-c", { on: e.i === N.selected, hover: e.i === V.value }])
              }, null, 2)
            ], 64))), 128))
          ]),
          n("thead", null, [
            p.value.rest.length ? (i(), r("tr", Ue, [
              s[2] || (s[2] = n("th", null, null, -1)),
              n("th", {
                colspan: p.value.mine.length,
                class: "ally"
              }, c(N.me ? b(a)("Your team") : b(a)("Blue side")), 9, qe),
              s[3] || (s[3] = n("th", null, null, -1)),
              n("th", {
                colspan: p.value.rest.length,
                class: "enemy"
              }, c(N.me ? b(a)("Enemy team") : b(a)("Red side")), 9, Je)
            ])) : x("", !0),
            n("tr", Qe, [
              s[4] || (s[4] = n("th", null, null, -1)),
              (i(!0), r(I, null, D(p.value.all, (e, t) => (i(), r(I, {
                key: e.i
              }, [
                t === p.value.mine.length ? (i(), r("th", Ze)) : x("", !0),
                n("th", null, [
                  n("button", {
                    type: "button",
                    class: g(["iv-brk-pick", { on: e.i === N.selected }]),
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
          (i(!0), r(I, null, D(ce.value, (e) => (i(), r("tbody", {
            key: e.label
          }, [
            n("tr", tl, [
              n("th", { colspan: de.value }, c(e.label), 9, al)
            ]),
            (i(!0), r(I, null, D(e.rows, (t) => (i(), r("tr", {
              key: t.label
            }, [
              n("th", {
                scope: "row",
                title: t.label
              }, c(t.label), 9, sl),
              (i(!0), r(I, null, D(t.cells, (u, h) => (i(), r(I, { key: h }, [
                u ? (i(), r("td", {
                  key: 1,
                  class: g({ best: u.best, zero: u.zero, on: u.i === N.selected }),
                  onPointerenter: (o) => V.value = u.i,
                  onClick: (o) => q("select", u.i)
                }, [
                  n("span", il, c(u.text), 1),
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
  hl as default
};
