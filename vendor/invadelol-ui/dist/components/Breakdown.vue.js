import '../styles/base.css';
import '../styles/detail.css';
import { defineComponent as be, computed as y, shallowRef as ge, openBlock as i, createElementBlock as r, unref as b, Fragment as p, renderList as D, createElementVNode as n, normalizeClass as h, toDisplayString as c, createCommentVNode as w, normalizeStyle as H, createBlock as U, createTextVNode as P } from "vue";
import { useInvadeUi as he, useFormat as ke, useNames as pe } from "../context.js";
import { provideStatGroups as _e } from "../fit.js";
import { relation as q } from "../logic/detail.js";
import { tk as $ } from "../logic/i18n.js";
import J from "./StatLabel.vue.js";
/* empty css                 */
/* empty css                   */
const ye = { class: "iv-brk" }, fe = ["aria-label"], xe = { class: "iv-brk-label" }, we = {
  key: 1,
  class: "iv-brk-duels"
}, Ie = {
  key: 0,
  class: "iv-brk-duel"
}, Me = { class: "iv-brk-duel-head" }, Te = { class: "iv-brk-side" }, Se = ["src"], $e = ["title"], Ce = { class: "iv-brk-vs" }, De = { class: "iv-brk-side right" }, Ne = ["title"], Pe = ["src"], Ae = { class: "iv-brk-rows" }, Ge = { class: "iv-brk-row-label" }, Oe = { class: "iv-brk-split" }, Be = {
  key: 0,
  class: "iv-brk-at15"
}, Ee = { key: 0 }, Le = { key: 1 }, Ve = { key: 2 }, ze = {
  key: 1,
  class: "iv-brk-duel"
}, Fe = { class: "iv-brk-duel-head" }, je = { class: "iv-brk-side" }, Ke = { class: "ally" }, We = { class: "iv-brk-vs" }, Re = { class: "iv-brk-side right" }, Xe = { class: "enemy" }, Ye = { class: "iv-brk-rows" }, He = { class: "iv-brk-row-label" }, Ue = { class: "iv-brk-split" }, qe = { class: "iv-brk-table-wrap" }, Je = {
  key: 0,
  class: "iv-brk-c-gap"
}, Qe = {
  key: 0,
  class: "iv-brk-teams"
}, Ze = ["colspan"], el = ["colspan"], ll = { class: "iv-brk-heads" }, al = { key: 0 }, tl = ["title", "aria-pressed", "onPointerenter", "onClick"], sl = ["src"], nl = { class: "iv-brk-section" }, ol = ["colspan"], il = ["title"], rl = {
  key: 0,
  class: "iv-brk-gap"
}, ul = ["onPointerenter", "onClick"], cl = { class: "iv-brk-v" }, dl = {
  key: 0,
  class: "iv-brk-bar"
}, yl = /* @__PURE__ */ be({
  __name: "Breakdown",
  props: {
    detail: {},
    selected: {},
    me: {}
  },
  emits: ["select"],
  setup(N, { emit: oe }) {
    const f = N, Q = oe, { t } = he();
    _e();
    const { compact: v, mmss: Z, num: I, ordinal: ee, pct: A, signedGold: G } = ke(), { champIcon: j, champName: O } = pe(), M = y(() => f.detail.players), B = y(() => M.value[f.selected]), ie = y(() => Math.max(1, f.detail.duration / 60)), E = y(() => f.me?.teamId ?? M.value[0]?.teamId ?? 100), re = y(() => M.value.some((l) => l.teamId !== E.value)), le = y(() => M.value.find((l) => l.participantId === B.value?.opponent)), K = (l) => l.mitigated === null ? null : l.damageTaken + l.mitigated, ue = [
      { id: "damage", label: $("damage to champions"), value: (l) => l.damage, figure: (l) => v(l), scope: "game" },
      { id: "share", label: $("of the team’s damage"), value: (l) => l.damageShare, figure: (l) => A(l), scope: "team" },
      { id: "kp", label: $("kill participation"), value: (l) => l.kp, figure: (l) => A(l), scope: "team" },
      { id: "csmin", label: $("CS per minute"), value: (l) => l.csMin, figure: (l) => I(l, 1), scope: "game" },
      { id: "vision", label: $("vision score"), value: (l) => l.vision, figure: (l) => I(l), scope: "game" },
      { id: "deaths", label: (l) => t(l === 1 ? "death" : "deaths"), value: (l) => l.deaths, figure: (l) => I(l), scope: "game", low: !0 },
      { id: "absorbed", label: $("damage absorbed"), value: K, figure: (l) => v(l), scope: "game", strengthOnly: !0 },
      { id: "objectives", label: $("damage to objectives"), value: (l) => l.objectiveDamage, figure: (l) => v(l), scope: "game", strengthOnly: !0 },
      { id: "cc", label: $("crowd control score"), value: (l) => l.ccTime, figure: (l) => I(l), scope: "game", strengthOnly: !0 },
      { id: "healing", label: $("healing"), value: (l) => l.healing, figure: (l) => v(l), scope: "game", strengthOnly: !0 }
    ];
    function ce(l, s, e, a) {
      return l === 1 ? t(e === "game" ? a ? "Fewest in the game" : "Most in the game" : a ? "Fewest on the team" : "Most on the team") : l === s ? t(e === "game" ? a ? "Most in the game" : "Fewest in the game" : a ? "Most on the team" : "Fewest on the team") : e === "game" ? t("{rank} in the game", { rank: ee(l) }) : t("{rank} on the team", { rank: ee(l) });
    }
    const ae = y(() => {
      const l = B.value;
      if (!l || f.detail.remake) return [];
      const s = [];
      for (const o of ue) {
        const m = o.scope === "game" ? M.value : M.value.filter((Y) => Y.teamId === l.teamId), T = o.value(l);
        if (m.length < 2 || T === null || !o.low && T <= 0) continue;
        const z = m.filter((Y) => {
          const ne = o.value(Y) ?? 0;
          return o.low ? ne < T : ne > T;
        }).length, S = z + 1, F = 1 - z / (m.length - 1);
        s.push({
          id: o.id,
          figure: o.figure(T),
          label: typeof o.label == "string" ? t(o.label) : o.label(T),
          rank: ce(S, m.length, o.scope, !!o.low),
          standing: o.scope === "team" ? F * 0.92 : F,
          strengthOnly: o.strengthOnly
        });
      }
      const e = le.value;
      e && l.gold15 !== null && Math.abs(l.gold15) >= 300 && s.push({
        id: "lane",
        figure: G(l.gold15),
        label: t("gold vs {name} at 15:00", { name: O(e.championId) }),
        rank: l.gold15 > 0 ? t("Won the lane") : t("Lost the lane"),
        standing: l.gold15 > 0 ? 0.6 + Math.min(0.4, l.gold15 / 3750) : 0.4 - Math.min(0.4, -l.gold15 / 3750),
        tone: q(l.teamId, f.me) === "ally" ? l.gold15 > 0 ? "ally" : "enemy" : l.gold15 > 0 ? "enemy" : "ally"
      });
      const a = s.filter((o) => o.standing >= 0.6).sort((o, m) => m.standing - o.standing), u = s.filter((o) => !o.strengthOnly && o.standing <= 0.15).sort((o, m) => o.standing - m.standing)[0], g = a.slice(0, u ? 3 : 4);
      return g.length < 3 && g.push(...s.filter((o) => !g.includes(o) && o !== u && o.standing > 0.3).sort((o, m) => m.standing - o.standing).slice(0, 3 - g.length)), u && g.push(u), g;
    }), k = (l, s, e, a, u) => ({ label: l, icon: u, a: s, b: e, aText: a(s), bText: a(e) }), x = (l) => l.a === l.b ? 0 : l.a > l.b != !!l.low ? 1 : -1, te = (l) => l.a + l.b > 0 ? l.a / (l.a + l.b) * 100 : 50, C = (l) => I(Math.round(l)), d = y(() => {
      const l = B.value, s = le.value;
      if (!l || !s) return null;
      const e = (m) => m.deaths ? (m.kills + m.assists) / m.deaths : m.kills + m.assists, [a, u] = [K(l), K(s)], g = [
        { ...k(t("KDA"), e(l), e(s), () => "", "kda"), aText: `${l.kills}/${l.deaths}/${l.assists}`, bText: `${s.kills}/${s.deaths}/${s.assists}` },
        k(t("Damage to champions"), l.damage, s.damage, v, "damage"),
        k(t("Gold"), l.gold, s.gold, v, "gold"),
        k(t("CS"), l.cs, s.cs, C, "cs"),
        ...a !== null && u !== null ? [k(t("Damage absorbed"), a, u, v, "taken")] : [],
        k(t("Vision score"), l.vision, s.vision, C, "vision")
      ], o = l.gold15 !== null || l.cs15 !== null || l.xp15 !== null ? { gold: l.gold15, cs: l.cs15, xp: l.xp15 } : null;
      return { a: l, b: s, rows: g, at15: o, bSide: q(s.teamId, f.me) };
    }), W = (l) => {
      const s = q(B.value?.teamId ?? 0, f.me) === "ally" ? l > 0 : l < 0;
      return l === 0 ? "" : s ? "ally" : "enemy";
    }, se = (l) => `${l > 0 ? "+" : l < 0 ? "−" : ""}${I(Math.abs(l))}`, L = y(() => {
      if (!re.value || f.detail.teams.length !== 2) return null;
      const l = f.detail.teams.find((a) => a.teamId === E.value), s = f.detail.teams.find((a) => a.teamId !== E.value);
      if (!l || !s) return null;
      const e = (a, u) => M.value.filter((g) => g.teamId === a).reduce((g, o) => g + u(o), 0);
      return {
        names: f.me ? [t("Your team"), t("Enemy team")] : [t("Blue side"), t("Red side")],
        rows: [
          k(t("Kills"), l.kills, s.kills, C, "kda"),
          k(t("Gold"), l.gold, s.gold, v, "gold"),
          k(t("Damage to champions"), l.damage, s.damage, v, "damage"),
          k(t("Damage taken"), e(l.teamId, (a) => a.damageTaken), e(s.teamId, (a) => a.damageTaken), v, "taken"),
          k(t("CS"), e(l.teamId, (a) => a.cs), e(s.teamId, (a) => a.cs), C, "cs"),
          k(t("Vision score"), e(l.teamId, (a) => a.vision), e(s.teamId, (a) => a.vision), C, "vision"),
          k(t("Turrets"), l.towers, s.towers, C),
          k(t("Dragons"), l.dragons, s.dragons, C),
          k(t("Barons"), l.barons, s.barons, C)
        ]
      };
    }), R = (l) => l / ie.value, de = y(() => {
      const l = M.value.some((e) => e.gold15 !== null), s = [
        {
          label: t("Combat"),
          icon: "kda",
          stats: [
            { label: t("KDA"), value: (e) => e.deaths ? (e.kills + e.assists) / e.deaths : e.kills + e.assists + 0.01, text: (e) => `${e.kills}/${e.deaths}/${e.assists}` },
            { label: t("Kill participation"), value: (e) => e.kp, text: (e, a) => A(a) },
            { label: t("Largest killing spree"), value: (e) => e.largestSpree },
            { label: t("Largest multi-kill"), value: (e) => e.largestMulti },
            { label: t("Crowd control score"), value: (e) => e.ccTime }
          ]
        },
        {
          label: t("Damage dealt"),
          icon: "damage",
          stats: [
            { label: t("To champions"), value: (e) => e.damage, text: (e, a) => v(a) },
            { label: t("Per minute"), value: (e) => R(e.damage), text: (e, a) => I(Math.round(a)) },
            { label: t("Share of team"), value: (e) => e.damageShare, text: (e, a) => A(a) },
            { label: t("Physical"), value: (e) => e.physical, text: (e, a) => v(a) },
            { label: t("Magic"), value: (e) => e.magic, text: (e, a) => v(a) },
            { label: t("True"), value: (e) => e.trueDamage, text: (e, a) => v(a) },
            { label: t("To objectives"), value: (e) => e.objectiveDamage, text: (e, a) => v(a) },
            { label: t("To turrets"), value: (e) => e.turretDamage, text: (e, a) => v(a) }
          ]
        },
        {
          label: t("Damage taken and healed"),
          icon: "taken",
          stats: [
            { label: t("Taken"), value: (e) => e.damageTaken, text: (e, a) => v(a) },
            { label: t("Mitigated"), value: (e) => e.mitigated, text: (e, a) => v(a) },
            { label: t("Healing"), value: (e) => e.healing, text: (e, a) => v(a) }
          ]
        },
        {
          label: t("Economy"),
          icon: "gold",
          stats: [
            { label: t("Gold"), value: (e) => e.gold, text: (e, a) => v(a) },
            { label: t("Gold per minute"), value: (e) => R(e.gold), text: (e, a) => I(Math.round(a)) },
            { label: t("Gold share"), value: (e) => e.goldShare, text: (e, a) => A(a) },
            { label: t("CS"), value: (e) => e.cs },
            { label: t("CS per minute"), value: (e) => e.csMin, text: (e, a) => I(a, 1) },
            { label: t("Level"), value: (e) => e.level }
          ]
        }
      ];
      return l && s.push({
        label: t("Lane at {time}", { time: Z(900) }),
        stats: [
          { label: t("Gold lead"), value: (e) => e.gold15, text: (e, a) => G(a), signed: !0 },
          { label: t("CS lead"), value: (e) => e.cs15, text: (e, a) => se(a), signed: !0 },
          { label: t("XP lead"), value: (e) => e.xp15, text: (e, a) => G(a), signed: !0 }
        ]
      }), s.push({
        label: t("Vision"),
        icon: "vision",
        stats: [
          { label: t("Vision score"), value: (e) => e.vision },
          { label: t("Per minute"), value: (e) => R(e.vision), text: (e, a) => I(a, 2) },
          { label: t("Wards placed"), value: (e) => e.wardsPlaced },
          { label: t("Wards destroyed"), value: (e) => e.wardsKilled },
          { label: t("Control wards"), value: (e) => e.controlWards }
        ]
      }), s;
    }), _ = y(() => {
      const l = M.value.map((a, u) => ({ p: a, i: u })), s = l.filter((a) => a.p.teamId === E.value), e = l.filter((a) => a.p.teamId !== E.value);
      return { mine: s, rest: e, all: [...s, ...e] };
    }), me = y(
      () => de.value.map((l) => ({
        label: l.label,
        icon: l.icon,
        rows: l.stats.flatMap((s) => {
          const e = _.value.all.map(({ p: m }) => s.value(m)), a = e.filter((m) => m !== null);
          if (!a.length) return [];
          const u = a.length ? s.low ? Math.min(...a) : Math.max(...a) : null, g = Math.max(0, ...a), o = _.value.all.map(({ p: m, i: T }, z) => {
            const S = e[z];
            return S === null ? { i: T, text: "–", best: !1, zero: !0, bar: null } : {
              i: T,
              text: s.text ? s.text(m, S) : I(Math.round(S)),
              best: u !== null && S === u && (s.low || S > 0) && a.filter((F) => F === u).length < a.length,
              zero: Math.abs(S) < 1e-9,
              bar: s.signed || g <= 0 ? null : Math.max(0, S) / g
            };
          });
          return [{ label: s.label, cells: [...o.slice(0, _.value.mine.length), null, ...o.slice(_.value.mine.length)] }];
        })
      }))
    ), ve = y(() => _.value.all.length + (_.value.rest.length ? 2 : 1)), V = ge(null), X = (l) => `${l.gameName || O(l.championId)} · ${O(l.championId)}`;
    return (l, s) => (i(), r("div", ye, [
      ae.value.length && B.value ? (i(), r("section", {
        key: 0,
        class: "iv-brk-facts",
        "aria-label": b(t)("What stood out")
      }, [
        (i(!0), r(p, null, D(ae.value, (e) => (i(), r("div", {
          key: e.id,
          class: "iv-brk-fact"
        }, [
          n("b", {
            class: h(["iv-brk-fig", e.tone])
          }, c(e.figure), 3),
          n("span", xe, c(e.label), 1),
          n("span", {
            class: h(["iv-brk-rank", { low: e.standing <= 0.15 }])
          }, c(e.rank), 3)
        ]))), 128))
      ], 8, fe)) : w("", !0),
      d.value || L.value ? (i(), r("div", we, [
        d.value ? (i(), r("section", Ie, [
          n("header", Me, [
            n("span", Te, [
              n("img", {
                src: b(j)(d.value.a.championId),
                alt: "",
                class: "self"
              }, null, 8, Se),
              n("b", {
                title: X(d.value.a)
              }, c(d.value.a.gameName || b(O)(d.value.a.championId)), 9, $e)
            ]),
            n("span", Ce, c(b(t)("vs")), 1),
            n("span", De, [
              n("b", {
                title: X(d.value.b)
              }, c(d.value.b.gameName || b(O)(d.value.b.championId)), 9, Ne),
              n("img", {
                src: b(j)(d.value.b.championId),
                alt: "",
                class: h(d.value.bSide)
              }, null, 10, Pe)
            ])
          ]),
          n("ul", Ae, [
            (i(!0), r(p, null, D(d.value.rows, (e) => (i(), r("li", {
              key: e.label,
              class: "iv-brk-row",
              style: H({ "--a": `${te(e)}%` })
            }, [
              n("span", {
                class: h(["iv-brk-n", { win: x(e) > 0 }])
              }, c(e.aText), 3),
              n("span", Ge, [
                e.icon ? (i(), U(J, {
                  key: 0,
                  stat: e.icon,
                  label: e.label,
                  group: "duel"
                }, null, 8, ["stat", "label"])) : (i(), r(p, { key: 1 }, [
                  P(c(e.label), 1)
                ], 64))
              ]),
              n("span", {
                class: h(["iv-brk-n right", { win: x(e) < 0 }])
              }, c(e.bText), 3),
              n("span", Oe, [
                n("i", {
                  class: h(["a self", { "iv-brk-ahead": x(e) > 0, "iv-brk-even": !x(e) }])
                }, null, 2),
                n("i", {
                  class: h(["b", [d.value.bSide, { "iv-brk-ahead": x(e) < 0, "iv-brk-even": !x(e) }]])
                }, null, 2)
              ])
            ], 4))), 128))
          ]),
          d.value.at15 ? (i(), r("p", Be, [
            n("span", null, c(b(t)("At {time}", { time: b(Z)(900) })), 1),
            d.value.at15.gold !== null ? (i(), r("span", Ee, [
              n("b", {
                class: h(W(d.value.at15.gold))
              }, c(b(G)(d.value.at15.gold)), 3),
              P(" " + c(b(t)("gold")), 1)
            ])) : w("", !0),
            d.value.at15.cs !== null ? (i(), r("span", Le, [
              n("b", {
                class: h(W(d.value.at15.cs))
              }, c(se(d.value.at15.cs)), 3),
              P(" " + c(b(t)("CS")), 1)
            ])) : w("", !0),
            d.value.at15.xp !== null ? (i(), r("span", Ve, [
              n("b", {
                class: h(W(d.value.at15.xp))
              }, c(b(G)(d.value.at15.xp)), 3),
              P(" " + c(b(t)("XP")), 1)
            ])) : w("", !0)
          ])) : w("", !0)
        ])) : w("", !0),
        L.value ? (i(), r("section", ze, [
          n("header", Fe, [
            n("span", je, [
              n("b", Ke, c(L.value.names[0]), 1)
            ]),
            n("span", We, c(b(t)("vs")), 1),
            n("span", Re, [
              n("b", Xe, c(L.value.names[1]), 1)
            ])
          ]),
          n("ul", Ye, [
            (i(!0), r(p, null, D(L.value.rows, (e) => (i(), r("li", {
              key: e.label,
              class: "iv-brk-row",
              style: H({ "--a": `${te(e)}%` })
            }, [
              n("span", {
                class: h(["iv-brk-n", { win: x(e) > 0 }])
              }, c(e.aText), 3),
              n("span", He, [
                e.icon ? (i(), U(J, {
                  key: 0,
                  stat: e.icon,
                  label: e.label,
                  group: "duel"
                }, null, 8, ["stat", "label"])) : (i(), r(p, { key: 1 }, [
                  P(c(e.label), 1)
                ], 64))
              ]),
              n("span", {
                class: h(["iv-brk-n right", { win: x(e) < 0 }])
              }, c(e.bText), 3),
              n("span", Ue, [
                n("i", {
                  class: h(["a ally", { "iv-brk-ahead": x(e) > 0, "iv-brk-even": !x(e) }])
                }, null, 2),
                n("i", {
                  class: h(["b enemy", { "iv-brk-ahead": x(e) < 0, "iv-brk-even": !x(e) }])
                }, null, 2)
              ])
            ], 4))), 128))
          ])
        ])) : w("", !0)
      ])) : w("", !0),
      n("div", qe, [
        n("table", {
          class: "iv-brk-table",
          onPointerleave: s[0] || (s[0] = (e) => V.value = null)
        }, [
          n("colgroup", null, [
            s[1] || (s[1] = n("col", { class: "iv-brk-c-label" }, null, -1)),
            (i(!0), r(p, null, D(_.value.all, (e, a) => (i(), r(p, {
              key: e.i
            }, [
              a === _.value.mine.length ? (i(), r("col", Je)) : w("", !0),
              n("col", {
                class: h(["iv-brk-c", { on: e.i === N.selected, hover: e.i === V.value }])
              }, null, 2)
            ], 64))), 128))
          ]),
          n("thead", null, [
            _.value.rest.length ? (i(), r("tr", Qe, [
              s[2] || (s[2] = n("th", null, null, -1)),
              n("th", {
                colspan: _.value.mine.length,
                class: "ally"
              }, c(N.me ? b(t)("Your team") : b(t)("Blue side")), 9, Ze),
              s[3] || (s[3] = n("th", null, null, -1)),
              n("th", {
                colspan: _.value.rest.length,
                class: "enemy"
              }, c(N.me ? b(t)("Enemy team") : b(t)("Red side")), 9, el)
            ])) : w("", !0),
            n("tr", ll, [
              s[4] || (s[4] = n("th", null, null, -1)),
              (i(!0), r(p, null, D(_.value.all, (e, a) => (i(), r(p, {
                key: e.i
              }, [
                a === _.value.mine.length ? (i(), r("th", al)) : w("", !0),
                n("th", null, [
                  n("button", {
                    type: "button",
                    class: h(["iv-brk-pick", { on: e.i === N.selected }]),
                    title: X(e.p),
                    "aria-pressed": e.i === N.selected,
                    onPointerenter: (u) => V.value = e.i,
                    onClick: (u) => Q("select", e.i)
                  }, [
                    n("img", {
                      src: b(j)(e.p.championId),
                      alt: ""
                    }, null, 8, sl)
                  ], 42, tl)
                ])
              ], 64))), 128))
            ])
          ]),
          (i(!0), r(p, null, D(me.value, (e) => (i(), r("tbody", {
            key: e.label
          }, [
            n("tr", nl, [
              n("th", { colspan: ve.value }, [
                e.icon ? (i(), U(J, {
                  key: 0,
                  stat: e.icon,
                  label: e.label
                }, null, 8, ["stat", "label"])) : (i(), r(p, { key: 1 }, [
                  P(c(e.label), 1)
                ], 64))
              ], 8, ol)
            ]),
            (i(!0), r(p, null, D(e.rows, (a) => (i(), r("tr", {
              key: a.label
            }, [
              n("th", {
                scope: "row",
                title: a.label
              }, c(a.label), 9, il),
              (i(!0), r(p, null, D(a.cells, (u, g) => (i(), r(p, { key: g }, [
                u ? (i(), r("td", {
                  key: 1,
                  class: h({ best: u.best, zero: u.zero, on: u.i === N.selected }),
                  onPointerenter: (o) => V.value = u.i,
                  onClick: (o) => Q("select", u.i)
                }, [
                  n("span", cl, c(u.text), 1),
                  u.bar !== null ? (i(), r("span", dl, [
                    n("i", {
                      style: H({ width: `${u.bar * 100}%` })
                    }, null, 4)
                  ])) : w("", !0)
                ], 42, ul)) : (i(), r("td", rl))
              ], 64))), 128))
            ]))), 128))
          ]))), 128))
        ], 32)
      ])
    ]));
  }
});
export {
  yl as default
};
