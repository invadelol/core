import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
import { defineComponent as us, computed as p, shallowRef as ms, watch as bs, useId as _s, openBlock as n, createElementBlock as o, createElementVNode as l, toDisplayString as i, unref as s, createVNode as u, Fragment as b, renderList as y, normalizeClass as f, createCommentVNode as v, createBlock as hs, createTextVNode as _, withCtx as vs, normalizeStyle as j } from "vue";
import { useInvadeUi as gs, useFormat as ks, useNames as ps } from "../context.js";
import { hideBroken as g } from "../dom.js";
import { teamsOf as ys, riotId as fs, side as F } from "../logic/detail.js";
import { positionName as ws, topBadges as Is, BADGES as D } from "../logic/labels.js";
import { provideStatGroups as $s } from "../fit.js";
import { detailTeamRating as Ns } from "../logic/team.js";
import xs from "./Icon.vue.js";
import Cs from "./Link.vue.js";
import Ds from "./ObjectiveIcon.vue.js";
import Ss from "./PerfDial.vue.js";
/* empty css              */
import Bs from "./PlayerDetail.vue.js";
import h from "./StatLabel.vue.js";
import Ts from "./TeamBadge.vue.js";
/* empty css               */
/* empty css                 */
/* empty css                       */
/* empty css                   */
const zs = { class: "iv-sb-wrap" }, Es = { class: "iv-table iv-sb" }, Gs = { colspan: "2" }, Vs = { class: "num" }, Rs = { class: "num" }, Ms = { class: "num iv-sb-taken" }, Ks = { class: "num" }, Ls = { class: "num" }, Ps = { class: "num iv-sb-vis" }, As = ["title"], js = { class: "iv-sb-team" }, Fs = { colspan: "11" }, Hs = { class: "iv-sb-team-line" }, Os = {
  key: 0,
  class: "iv-sb-side"
}, Us = { class: "iv-sb-obj" }, Ws = ["title"], Ys = ["title"], qs = ["src", "alt", "title"], Js = { class: "iv-sb-tot" }, Qs = ["title"], Xs = ["onClick"], Zs = { class: "iv-sb-who" }, st = ["title"], tt = { class: "iv-sb-art" }, lt = ["src"], et = { class: "iv-sb-load" }, at = ["src", "alt", "title"], it = ["src", "title"], nt = { key: 1 }, ot = ["src", "title"], dt = { class: "iv-sb-name" }, ct = { class: "iv-sb-line" }, rt = { key: 0 }, ut = {
  key: 0,
  class: "iv-badge brand"
}, mt = { class: "iv-sb-line iv-sb-sub" }, bt = ["title"], _t = ["title"], ht = { class: "num iv-sb-kda" }, vt = ["title"], gt = { class: "iv-sb-share" }, kt = { class: "iv-sb-bar" }, pt = ["title"], yt = { class: "iv-sb-bar taken" }, ft = ["title"], wt = { class: "num iv-sb-cs" }, It = ["title"], $t = { class: "iv-sb-itd" }, Nt = { class: "iv-sb-items" }, xt = ["src", "alt", "title"], Ct = { class: "num iv-sb-score" }, Dt = {
  key: 0,
  class: "iv-sb-perf"
}, St = ["title"], Bt = ["title"], Tt = { key: 2 }, zt = {
  key: 1,
  class: "iv-pf-dim"
}, Et = { class: "iv-sb-more" }, Gt = ["aria-expanded", "aria-controls", "aria-label", "onClick"], Vt = {
  key: 0,
  class: "iv-sb-detail"
}, Rt = ["id"], Mt = { class: "iv-sb-detail-in" }, el = /* @__PURE__ */ us({
  __name: "Scoreboard",
  props: {
    detail: {},
    puuid: {}
  },
  setup($) {
    const m = $, T = gs(), { t: e } = T, { compact: C, kdaRatio: H, num: w, ordinal: z, pct: N, score100: O, signedGold: U } = ks(), { champIcon: E, champName: k, itemIcon: W, itemName: G, runeIcon: Y, runeName: q, spellIcon: J, spellName: V, styleIcon: Q, styleName: X } = ps();
    $s();
    const S = p(() => m.detail.players.find((a) => a.puuid === m.puuid)), Z = p(() => ys(m.detail, S.value)), R = p(() => Ns(m.detail, m.puuid)), ss = p(() => Math.max(1, ...m.detail.players.map((a) => a.damage))), ts = p(() => Math.max(1, ...m.detail.players.map((a) => a.damageTaken))), M = p(() => Math.max(1, m.detail.duration / 60)), ls = (a) => {
      const d = (r) => N(r / Math.max(1, a.damage));
      return `${w(a.damage)} · ${e("{share} of the team", { share: N(a.damageShare) })} · ${e("{physical} physical · {magic} magic · {true} true", { physical: d(a.physical), magic: d(a.magic), true: d(a.trueDamage) })}`;
    }, es = p(() => m.detail.players.some((a) => a.placement > 0));
    function as(a) {
      return [
        { id: "tower", label: e("Towers"), n: a.towers },
        { id: "dragon", label: e("Dragons"), n: a.dragons },
        { id: "baron", label: e("Barons"), n: a.barons },
        { id: "grubs", label: e("Voidgrubs"), n: a.grubs },
        { id: "herald", label: e("Rift Herald"), n: a.heralds },
        { id: "inhib", label: e("Inhibitors"), n: a.inhibitors }
      ].filter((r) => r.n !== null);
    }
    const is = (a, d) => es.value && d ? e("{place} place", { place: z(d) }) : m.detail.remake ? e("Remake") : a.win ? e("Victory") : e("Defeat"), K = (a) => F(a) === "blue" ? e("Blue side") : F(a) === "red" ? e("Red side") : "", L = (a) => a.bans.filter((d) => d > 0), ns = (a) => a >= 1e3 ? "iv-up" : a <= -1e3 ? "iv-down" : "", I = ms(null);
    bs(() => m.detail, () => I.value = null);
    const P = (a) => I.value = I.value === a.participantId ? null : a.participantId, os = (a, d) => {
      a.target.closest("a, button") || P(d);
    }, A = _s(), ds = (a) => a.puuid && a.puuid !== m.puuid ? { kind: "player", puuid: a.puuid, gameName: a.gameName, tagLine: a.tagLine } : null;
    return (a, d) => (n(), o("div", zs, [
      l("table", Es, [
        d[8] || (d[8] = l("colgroup", null, [
          l("col", { class: "iv-sb-c-who" }),
          l("col", { class: "iv-sb-c-name" }),
          l("col", { class: "iv-sb-c-kda" }),
          l("col", { class: "iv-sb-c-dmg" }),
          l("col", { class: "iv-sb-c-taken iv-sb-taken" }),
          l("col", { class: "iv-sb-c-gold" }),
          l("col", { class: "iv-sb-c-cs" }),
          l("col", { class: "iv-sb-c-vis" }),
          l("col", { class: "iv-sb-c-items" }),
          l("col", { class: "iv-sb-c-score" }),
          l("col", { class: "iv-sb-c-more" })
        ], -1)),
        l("thead", null, [
          l("tr", null, [
            l("th", Gs, i(s(e)("Player")), 1),
            l("th", Vs, [
              u(h, {
                stat: "kda",
                label: s(e)("KDA"),
                group: "head"
              }, null, 8, ["label"])
            ]),
            l("th", Rs, [
              u(h, {
                stat: "damage",
                label: s(e)("Damage"),
                group: "head"
              }, null, 8, ["label"])
            ]),
            l("th", Ms, [
              u(h, {
                stat: "taken",
                label: s(e)("Taken"),
                group: "head"
              }, null, 8, ["label"])
            ]),
            l("th", Ks, [
              u(h, {
                stat: "gold",
                label: s(e)("Gold"),
                group: "head"
              }, null, 8, ["label"])
            ]),
            l("th", Ls, [
              u(h, {
                stat: "cs",
                label: s(e)("CS"),
                group: "head"
              }, null, 8, ["label"])
            ]),
            l("th", Ps, [
              u(h, {
                stat: "vision",
                label: s(e)("Vision"),
                group: "head"
              }, null, 8, ["label"])
            ]),
            l("th", null, i(s(e)("Items")), 1),
            l("th", {
              class: "num",
              title: s(e)("Invade score")
            }, i(s(e)("Score")), 9, As),
            d[4] || (d[4] = l("th", null, null, -1))
          ])
        ]),
        (n(!0), o(b, null, y(Z.value, ({ team: r, players: cs, placement: rs }) => (n(), o("tbody", {
          key: r.teamId,
          class: f(r.win ? "won" : "lost")
        }, [
          l("tr", js, [
            l("td", Fs, [
              l("div", Hs, [
                l("b", {
                  class: f(["iv-sb-res", $.detail.remake ? "" : r.win ? "win" : "loss"])
                }, i(is(r, rs)), 3),
                K(r.teamId) ? (n(), o("span", Os, i(K(r.teamId)), 1)) : v("", !0),
                R.value && r.teamId === S.value?.teamId ? (n(), hs(Ts, {
                  key: 1,
                  verdict: R.value,
                  win: r.win
                }, null, 8, ["verdict", "win"])) : v("", !0),
                l("span", Us, [
                  (n(!0), o(b, null, y(as(r), (t) => (n(), o("span", {
                    key: t.id,
                    title: t.label,
                    class: f({ none: !t.n })
                  }, [
                    u(Ds, {
                      name: t.id,
                      size: 14
                    }, null, 8, ["name"]),
                    _(i(t.n), 1)
                  ], 10, Ws))), 128))
                ]),
                L(r).length ? (n(), o("span", {
                  key: 2,
                  class: "iv-sb-bans",
                  title: s(e)("Bans")
                }, [
                  (n(!0), o(b, null, y(L(r), (t, c) => (n(), o("img", {
                    key: c,
                    src: s(E)(t),
                    alt: s(k)(t),
                    title: s(e)("Banned: {champion}", { champion: s(k)(t) })
                  }, null, 8, qs))), 128))
                ], 8, Ys)) : v("", !0),
                l("span", Js, [
                  l("span", null, [
                    u(h, {
                      stat: "kda",
                      label: s(e)("KDA"),
                      bare: ""
                    }, null, 8, ["label"]),
                    _(i(r.kills) + " / " + i(r.deaths) + " / " + i(r.assists), 1)
                  ]),
                  l("span", {
                    title: s(w)(r.gold)
                  }, [
                    u(h, {
                      stat: "gold",
                      label: s(e)("Gold"),
                      bare: ""
                    }, null, 8, ["label"]),
                    _(i(s(C)(r.gold)), 1)
                  ], 8, Qs)
                ])
              ])
            ])
          ]),
          (n(!0), o(b, null, y(cs, (t) => (n(), o(b, {
            key: t.participantId
          }, [
            l("tr", {
              class: f(["iv-sb-row", { self: t.puuid === $.puuid, open: I.value === t.participantId }]),
              onClick: (c) => os(c, t)
            }, [
              l("td", Zs, [
                l("span", {
                  class: "iv-sb-portrait",
                  title: s(k)(t.championId)
                }, [
                  l("span", tt, [
                    l("img", {
                      src: s(E)(t.championId),
                      alt: ""
                    }, null, 8, lt)
                  ]),
                  l("em", null, i(t.level), 1)
                ], 8, st),
                l("span", et, [
                  (n(!0), o(b, null, y(t.spells, (c, x) => (n(), o("img", {
                    key: x,
                    src: s(J)(c),
                    alt: s(V)(c),
                    title: s(V)(c),
                    onError: d[0] || (d[0] = //@ts-ignore
                    (...B) => s(g) && s(g)(...B))
                  }, null, 40, at))), 128)),
                  t.perks[0] ? (n(), o("img", {
                    key: 0,
                    src: s(Y)(t.perks[0]),
                    title: s(q)(t.perks[0]),
                    alt: "",
                    class: "key",
                    onError: d[1] || (d[1] = //@ts-ignore
                    (...c) => s(g) && s(g)(...c))
                  }, null, 40, it)) : (n(), o("i", nt)),
                  t.styles[1] ? (n(), o("img", {
                    key: 2,
                    src: s(Q)(t.styles[1]),
                    title: s(X)(t.styles[1]),
                    alt: "",
                    class: "sub",
                    onError: d[2] || (d[2] = //@ts-ignore
                    (...c) => s(g) && s(g)(...c))
                  }, null, 40, ot)) : v("", !0)
                ])
              ]),
              l("td", dt, [
                l("span", ct, [
                  u(Cs, {
                    class: "iv-sb-link",
                    to: ds(t),
                    title: s(fs)(t) || s(k)(t.championId)
                  }, {
                    default: vs(() => [
                      _(i(t.gameName || s(k)(t.championId)), 1),
                      t.tagLine ? (n(), o("small", rt, "#" + i(t.tagLine), 1)) : v("", !0)
                    ]),
                    _: 2
                  }, 1032, ["to", "title"]),
                  t.puuid && t.puuid === s(T).viewer.value && t.puuid !== $.puuid ? (n(), o("span", ut, i(s(e)("You")), 1)) : v("", !0)
                ]),
                l("span", mt, [
                  l("small", null, [
                    t.position ? (n(), o(b, { key: 0 }, [
                      _(i(s(ws)(t.position, s(e))), 1)
                    ], 64)) : (n(), o(b, { key: 1 }, [
                      _(i(s(k)(t.championId)), 1)
                    ], 64)),
                    t.gold15 !== null ? (n(), o(b, { key: 2 }, [
                      d[5] || (d[5] = _(" · ", -1)),
                      l("span", {
                        class: f(ns(t.gold15)),
                        title: s(e)("Gold lead over the lane opponent at 15 minutes")
                      }, i(s(e)("{gold} gold @15", { gold: s(U)(t.gold15) })), 11, bt)
                    ], 64)) : v("", !0)
                  ]),
                  (n(!0), o(b, null, y(s(Is)(t.badges), (c) => (n(), o("span", {
                    key: c,
                    class: "iv-badge",
                    title: s(e)(s(D)[c].tip)
                  }, i(s(e)(s(D)[c].label)), 9, _t))), 128))
                ])
              ]),
              l("td", ht, [
                l("b", null, [
                  _(i(t.kills), 1),
                  d[6] || (d[6] = l("i", null, "/", -1)),
                  _(i(t.deaths), 1),
                  d[7] || (d[7] = l("i", null, "/", -1)),
                  _(i(t.assists), 1)
                ]),
                l("small", null, i(s(H)(t.kills, t.deaths, t.assists)) + " · " + i(s(N)(t.kp)) + " " + i(s(e)("KP")), 1)
              ]),
              l("td", {
                class: "num iv-sb-dmg",
                title: ls(t)
              }, [
                u(h, {
                  class: "iv-sb-tag",
                  stat: "damage",
                  label: s(e)("Damage"),
                  size: 12,
                  bare: ""
                }, null, 8, ["label"]),
                l("b", null, [
                  l("small", gt, i(s(N)(t.damageShare)), 1),
                  _(i(s(C)(t.damage)), 1)
                ]),
                l("i", kt, [
                  l("em", {
                    style: j({ width: `${t.damage / ss.value * 100}%` })
                  }, null, 4)
                ])
              ], 8, vt),
              l("td", {
                class: "num iv-sb-dmg iv-sb-taken",
                title: s(w)(t.damageTaken)
              }, [
                l("b", null, i(s(C)(t.damageTaken)), 1),
                l("i", yt, [
                  l("em", {
                    style: j({ width: `${t.damageTaken / ts.value * 100}%` })
                  }, null, 4)
                ])
              ], 8, pt),
              l("td", {
                class: "num iv-sb-gold",
                title: `${s(e)("{share} of the team", { share: s(N)(t.goldShare) })} · ${s(e)("Gold per minute")}: ${s(w)(t.gold / M.value)}`
              }, [
                u(h, {
                  class: "iv-sb-tag",
                  stat: "gold",
                  label: s(e)("Gold"),
                  size: 12,
                  bare: ""
                }, null, 8, ["label"]),
                l("b", null, i(s(C)(t.gold)), 1),
                l("small", null, i(s(w)(t.gold / M.value)), 1)
              ], 8, ft),
              l("td", wt, [
                u(h, {
                  class: "iv-sb-tag",
                  stat: "cs",
                  label: s(e)("CS"),
                  size: 12,
                  bare: ""
                }, null, 8, ["label"]),
                l("b", null, i(t.cs), 1),
                l("small", null, i(s(w)(t.csMin, 1)), 1)
              ]),
              l("td", {
                class: "num iv-sb-vis",
                title: s(e)("{placed} placed · {killed} destroyed · {control} control wards", { placed: t.wardsPlaced, killed: t.wardsKilled, control: t.controlWards })
              }, [
                l("b", null, i(t.vision), 1),
                l("small", null, i(t.wardsPlaced) + " / " + i(t.wardsKilled), 1)
              ], 8, It),
              l("td", $t, [
                l("span", Nt, [
                  (n(!0), o(b, null, y(t.items, (c, x) => (n(), o(b, { key: x }, [
                    c ? (n(), o("img", {
                      key: 0,
                      src: s(W)(c),
                      alt: s(G)(c),
                      title: s(G)(c),
                      class: f({ trinket: x === 6 }),
                      onError: d[3] || (d[3] = //@ts-ignore
                      (...B) => s(g) && s(g)(...B))
                    }, null, 42, xt)) : (n(), o("i", {
                      key: 1,
                      class: f({ trinket: x === 6 })
                    }, null, 2))
                  ], 64))), 128))
                ])
              ]),
              l("td", Ct, [
                t.score !== null ? (n(), o("span", Dt, [
                  t.badges.includes("mvp") ? (n(), o("span", {
                    key: 0,
                    class: "iv-badge gold",
                    title: s(e)(s(D).mvp.tip)
                  }, i(s(e)("MVP")), 9, St)) : t.badges.includes("ace") ? (n(), o("span", {
                    key: 1,
                    class: "iv-badge",
                    title: s(e)(s(D).ace.tip)
                  }, i(s(e)("ACE")), 9, Bt)) : (n(), o("small", Tt, i(s(z)(t.rank)), 1)),
                  u(Ss, {
                    score: s(O)(t.score),
                    rank: t.rank,
                    size: "sm"
                  }, null, 8, ["score", "rank"])
                ])) : (n(), o("span", zt, "–"))
              ]),
              l("td", Et, [
                l("button", {
                  type: "button",
                  class: "iv-sb-toggle",
                  "aria-expanded": I.value === t.participantId,
                  "aria-controls": `${s(A)}-${t.participantId}`,
                  "aria-label": s(e)("Details of {name}", { name: t.gameName || s(k)(t.championId) }),
                  onClick: (c) => P(t)
                }, [
                  u(xs, {
                    name: "down",
                    size: 14
                  })
                ], 8, Gt)
              ])
            ], 10, Xs),
            I.value === t.participantId ? (n(), o("tr", Vt, [
              l("td", {
                id: `${s(A)}-${t.participantId}`,
                colspan: "11"
              }, [
                l("div", Mt, [
                  u(Bs, {
                    detail: $.detail,
                    player: t,
                    me: S.value
                  }, null, 8, ["detail", "player", "me"])
                ])
              ], 8, Rt)
            ])) : v("", !0)
          ], 64))), 128))
        ], 2))), 128))
      ])
    ]));
  }
});
export {
  el as default
};
