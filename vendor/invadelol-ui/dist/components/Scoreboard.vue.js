import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
import { defineComponent as us, computed as p, shallowRef as ms, watch as bs, useId as _s, openBlock as n, createElementBlock as o, createElementVNode as l, toDisplayString as i, unref as t, createVNode as u, Fragment as b, renderList as I, normalizeClass as y, createCommentVNode as v, createBlock as hs, createTextVNode as _, withCtx as vs, normalizeStyle as A } from "vue";
import { useInvadeUi as gs, useFormat as ks, useNames as ps } from "../context.js";
import { hideBroken as g } from "../dom.js";
import { teamsOf as ys, riotId as fs, side as j } from "../logic/detail.js";
import { positionName as ws, BADGES as F } from "../logic/labels.js";
import Is from "./MatchTags.vue.js";
/* empty css               */
import { provideStatGroups as $s } from "../fit.js";
import { detailTeamRating as Ns } from "../logic/team.js";
import xs from "./Icon.vue.js";
import Cs from "./Link.vue.js";
import Ds from "./ObjectiveIcon.vue.js";
import Ss from "./PerfDial.vue.js";
/* empty css              */
import Ts from "./PlayerDetail.vue.js";
import h from "./StatLabel.vue.js";
import Bs from "./TeamBadge.vue.js";
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
}, mt = { class: "iv-sb-line iv-sb-sub" }, bt = ["title"], _t = { class: "num iv-sb-kda" }, ht = ["title"], vt = { class: "iv-sb-share" }, gt = { class: "iv-sb-bar" }, kt = ["title"], pt = { class: "iv-sb-bar taken" }, yt = ["title"], ft = { class: "num iv-sb-cs" }, wt = ["title"], It = { class: "iv-sb-itd" }, $t = { class: "iv-sb-items" }, Nt = ["src", "alt", "title"], xt = { class: "num iv-sb-score" }, Ct = {
  key: 0,
  class: "iv-sb-perf"
}, Dt = ["title"], St = ["title"], Tt = { key: 2 }, Bt = {
  key: 1,
  class: "iv-pf-dim"
}, zt = { class: "iv-sb-more" }, Et = ["aria-expanded", "aria-controls", "aria-label", "onClick"], Gt = {
  key: 0,
  class: "iv-sb-detail"
}, Vt = ["id"], Rt = { class: "iv-sb-detail-in" }, al = /* @__PURE__ */ us({
  __name: "Scoreboard",
  props: {
    detail: {},
    puuid: {}
  },
  setup($) {
    const m = $, T = gs(), { t: e } = T, { compact: C, kdaRatio: H, num: f, ordinal: B, pct: N, score100: O, signedGold: U } = ks(), { champIcon: z, champName: k, itemIcon: W, itemName: E, runeIcon: Y, runeName: q, spellIcon: J, spellName: G, styleIcon: Q, styleName: X } = ps();
    $s();
    const D = p(() => m.detail.players.find((a) => a.puuid === m.puuid)), Z = p(() => ys(m.detail, D.value)), V = p(() => Ns(m.detail, m.puuid)), ss = p(() => Math.max(1, ...m.detail.players.map((a) => a.damage))), ts = p(() => Math.max(1, ...m.detail.players.map((a) => a.damageTaken))), R = p(() => Math.max(1, m.detail.duration / 60)), ls = (a) => {
      const d = (c) => N(c / Math.max(1, a.damage));
      return `${f(a.damage)} · ${e("{share} of the team", { share: N(a.damageShare) })} · ${e("{physical} physical · {magic} magic · {true} true", { physical: d(a.physical), magic: d(a.magic), true: d(a.trueDamage) })}`;
    }, es = p(() => m.detail.players.some((a) => a.placement > 0));
    function as(a) {
      return [
        { id: "tower", label: e("Towers"), n: a.towers },
        { id: "dragon", label: e("Dragons"), n: a.dragons },
        { id: "baron", label: e("Barons"), n: a.barons },
        { id: "grubs", label: e("Voidgrubs"), n: a.grubs },
        { id: "herald", label: e("Rift Herald"), n: a.heralds },
        { id: "inhib", label: e("Inhibitors"), n: a.inhibitors }
      ].filter((c) => c.n !== null);
    }
    const is = (a, d) => es.value && d ? e("{place} place", { place: B(d) }) : m.detail.remake ? e("Remake") : a.win ? e("Victory") : e("Defeat"), M = (a) => j(a) === "blue" ? e("Blue side") : j(a) === "red" ? e("Red side") : "", K = (a) => a.bans.filter((d) => d > 0), ns = (a) => a >= 1e3 ? "iv-up" : a <= -1e3 ? "iv-down" : "", w = ms(null);
    bs(() => m.detail, () => w.value = null);
    const L = (a) => w.value = w.value === a.participantId ? null : a.participantId, os = (a, d) => {
      a.target.closest("a, button") || L(d);
    }, P = _s(), ds = (a) => a.puuid && a.puuid !== m.puuid ? { kind: "player", puuid: a.puuid, gameName: a.gameName, tagLine: a.tagLine } : null;
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
            l("th", Gs, i(t(e)("Player")), 1),
            l("th", Vs, [
              u(h, {
                stat: "kda",
                label: t(e)("KDA"),
                group: "head"
              }, null, 8, ["label"])
            ]),
            l("th", Rs, [
              u(h, {
                stat: "damage",
                label: t(e)("Damage"),
                group: "head"
              }, null, 8, ["label"])
            ]),
            l("th", Ms, [
              u(h, {
                stat: "taken",
                label: t(e)("Taken"),
                group: "head"
              }, null, 8, ["label"])
            ]),
            l("th", Ks, [
              u(h, {
                stat: "gold",
                label: t(e)("Gold"),
                group: "head"
              }, null, 8, ["label"])
            ]),
            l("th", Ls, [
              u(h, {
                stat: "cs",
                label: t(e)("CS"),
                group: "head"
              }, null, 8, ["label"])
            ]),
            l("th", Ps, [
              u(h, {
                stat: "vision",
                label: t(e)("Vision"),
                group: "head"
              }, null, 8, ["label"])
            ]),
            l("th", null, i(t(e)("Items")), 1),
            l("th", {
              class: "num",
              title: t(e)("Invade score")
            }, i(t(e)("Score")), 9, As),
            d[4] || (d[4] = l("th", null, null, -1))
          ])
        ]),
        (n(!0), o(b, null, I(Z.value, ({ team: c, players: cs, placement: rs }) => (n(), o("tbody", {
          key: c.teamId,
          class: y(c.win ? "won" : "lost")
        }, [
          l("tr", js, [
            l("td", Fs, [
              l("div", Hs, [
                l("b", {
                  class: y(["iv-sb-res", $.detail.remake ? "" : c.win ? "win" : "loss"])
                }, i(is(c, rs)), 3),
                M(c.teamId) ? (n(), o("span", Os, i(M(c.teamId)), 1)) : v("", !0),
                V.value && c.teamId === D.value?.teamId ? (n(), hs(Bs, {
                  key: 1,
                  verdict: V.value,
                  win: c.win
                }, null, 8, ["verdict", "win"])) : v("", !0),
                l("span", Us, [
                  (n(!0), o(b, null, I(as(c), (s) => (n(), o("span", {
                    key: s.id,
                    title: s.label,
                    class: y({ none: !s.n })
                  }, [
                    u(Ds, {
                      name: s.id,
                      size: 16
                    }, null, 8, ["name"]),
                    _(i(s.n), 1)
                  ], 10, Ws))), 128))
                ]),
                K(c).length ? (n(), o("span", {
                  key: 2,
                  class: "iv-sb-bans",
                  title: t(e)("Bans")
                }, [
                  (n(!0), o(b, null, I(K(c), (s, r) => (n(), o("img", {
                    key: r,
                    src: t(z)(s),
                    alt: t(k)(s),
                    title: t(e)("Banned: {champion}", { champion: t(k)(s) })
                  }, null, 8, qs))), 128))
                ], 8, Ys)) : v("", !0),
                l("span", Js, [
                  l("span", null, [
                    u(h, {
                      stat: "kda",
                      label: t(e)("KDA"),
                      bare: ""
                    }, null, 8, ["label"]),
                    _(i(c.kills) + " / " + i(c.deaths) + " / " + i(c.assists), 1)
                  ]),
                  l("span", {
                    title: t(f)(c.gold)
                  }, [
                    u(h, {
                      stat: "gold",
                      label: t(e)("Gold"),
                      bare: ""
                    }, null, 8, ["label"]),
                    _(i(t(C)(c.gold)), 1)
                  ], 8, Qs)
                ])
              ])
            ])
          ]),
          (n(!0), o(b, null, I(cs, (s) => (n(), o(b, {
            key: s.participantId
          }, [
            l("tr", {
              class: y(["iv-sb-row", { self: s.puuid === $.puuid, open: w.value === s.participantId }]),
              onClick: (r) => os(r, s)
            }, [
              l("td", Zs, [
                l("span", {
                  class: "iv-sb-portrait",
                  title: t(k)(s.championId)
                }, [
                  l("span", tt, [
                    l("img", {
                      src: t(z)(s.championId),
                      alt: ""
                    }, null, 8, lt)
                  ]),
                  l("em", null, i(s.level), 1)
                ], 8, st),
                l("span", et, [
                  (n(!0), o(b, null, I(s.spells, (r, x) => (n(), o("img", {
                    key: x,
                    src: t(J)(r),
                    alt: t(G)(r),
                    title: t(G)(r),
                    onError: d[0] || (d[0] = //@ts-ignore
                    (...S) => t(g) && t(g)(...S))
                  }, null, 40, at))), 128)),
                  s.perks[0] ? (n(), o("img", {
                    key: 0,
                    src: t(Y)(s.perks[0]),
                    title: t(q)(s.perks[0]),
                    alt: "",
                    class: "key",
                    onError: d[1] || (d[1] = //@ts-ignore
                    (...r) => t(g) && t(g)(...r))
                  }, null, 40, it)) : (n(), o("i", nt)),
                  s.styles[1] ? (n(), o("img", {
                    key: 2,
                    src: t(Q)(s.styles[1]),
                    title: t(X)(s.styles[1]),
                    alt: "",
                    class: "sub",
                    onError: d[2] || (d[2] = //@ts-ignore
                    (...r) => t(g) && t(g)(...r))
                  }, null, 40, ot)) : v("", !0)
                ])
              ]),
              l("td", dt, [
                l("span", ct, [
                  u(Cs, {
                    class: "iv-sb-link",
                    to: ds(s),
                    title: t(fs)(s) || t(k)(s.championId)
                  }, {
                    default: vs(() => [
                      _(i(s.gameName || t(k)(s.championId)), 1),
                      s.tagLine ? (n(), o("small", rt, "#" + i(s.tagLine), 1)) : v("", !0)
                    ]),
                    _: 2
                  }, 1032, ["to", "title"]),
                  s.puuid && s.puuid === t(T).viewer.value && s.puuid !== $.puuid ? (n(), o("span", ut, i(t(e)("You")), 1)) : v("", !0)
                ]),
                l("span", mt, [
                  l("small", null, [
                    s.position ? (n(), o(b, { key: 0 }, [
                      _(i(t(ws)(s.position, t(e))), 1)
                    ], 64)) : (n(), o(b, { key: 1 }, [
                      _(i(t(k)(s.championId)), 1)
                    ], 64)),
                    s.gold15 !== null ? (n(), o(b, { key: 2 }, [
                      d[5] || (d[5] = _(" · ", -1)),
                      l("span", {
                        class: y(ns(s.gold15)),
                        title: t(e)("Gold lead over the lane opponent at 15 minutes")
                      }, i(t(e)("{gold} gold @15", { gold: t(U)(s.gold15) })), 11, bt)
                    ], 64)) : v("", !0)
                  ]),
                  u(Is, {
                    badges: s.badges,
                    max: 3
                  }, null, 8, ["badges"])
                ])
              ]),
              l("td", _t, [
                l("b", null, [
                  _(i(s.kills), 1),
                  d[6] || (d[6] = l("i", null, "/", -1)),
                  _(i(s.deaths), 1),
                  d[7] || (d[7] = l("i", null, "/", -1)),
                  _(i(s.assists), 1)
                ]),
                l("small", null, i(t(H)(s.kills, s.deaths, s.assists)) + " · " + i(t(N)(s.kp)) + " " + i(t(e)("KP")), 1)
              ]),
              l("td", {
                class: "num iv-sb-dmg",
                title: ls(s)
              }, [
                u(h, {
                  class: "iv-sb-tag",
                  stat: "damage",
                  label: t(e)("Damage"),
                  size: 12,
                  bare: ""
                }, null, 8, ["label"]),
                l("b", null, [
                  l("small", vt, i(t(N)(s.damageShare)), 1),
                  _(i(t(C)(s.damage)), 1)
                ]),
                l("i", gt, [
                  l("em", {
                    style: A({ width: `${s.damage / ss.value * 100}%` })
                  }, null, 4)
                ])
              ], 8, ht),
              l("td", {
                class: "num iv-sb-dmg iv-sb-taken",
                title: t(f)(s.damageTaken)
              }, [
                l("b", null, i(t(C)(s.damageTaken)), 1),
                l("i", pt, [
                  l("em", {
                    style: A({ width: `${s.damageTaken / ts.value * 100}%` })
                  }, null, 4)
                ])
              ], 8, kt),
              l("td", {
                class: "num iv-sb-gold",
                title: `${t(e)("{share} of the team", { share: t(N)(s.goldShare) })} · ${t(e)("Gold per minute")}: ${t(f)(s.gold / R.value)}`
              }, [
                u(h, {
                  class: "iv-sb-tag",
                  stat: "gold",
                  label: t(e)("Gold"),
                  size: 12,
                  bare: ""
                }, null, 8, ["label"]),
                l("b", null, i(t(C)(s.gold)), 1),
                l("small", null, i(t(f)(s.gold / R.value)), 1)
              ], 8, yt),
              l("td", ft, [
                u(h, {
                  class: "iv-sb-tag",
                  stat: "cs",
                  label: t(e)("CS"),
                  size: 12,
                  bare: ""
                }, null, 8, ["label"]),
                l("b", null, i(s.cs), 1),
                l("small", null, i(t(f)(s.csMin, 1)), 1)
              ]),
              l("td", {
                class: "num iv-sb-vis",
                title: t(e)("{placed} placed · {killed} destroyed · {control} control wards", { placed: s.wardsPlaced, killed: s.wardsKilled, control: s.controlWards })
              }, [
                l("b", null, i(s.vision), 1),
                l("small", null, i(s.wardsPlaced) + " / " + i(s.wardsKilled), 1)
              ], 8, wt),
              l("td", It, [
                l("span", $t, [
                  (n(!0), o(b, null, I(s.items, (r, x) => (n(), o(b, { key: x }, [
                    r ? (n(), o("img", {
                      key: 0,
                      src: t(W)(r),
                      alt: t(E)(r),
                      title: t(E)(r),
                      class: y({ trinket: x === 6 }),
                      onError: d[3] || (d[3] = //@ts-ignore
                      (...S) => t(g) && t(g)(...S))
                    }, null, 42, Nt)) : (n(), o("i", {
                      key: 1,
                      class: y({ trinket: x === 6 })
                    }, null, 2))
                  ], 64))), 128))
                ])
              ]),
              l("td", xt, [
                s.score !== null ? (n(), o("span", Ct, [
                  s.badges.includes("mvp") ? (n(), o("span", {
                    key: 0,
                    class: "iv-badge brand",
                    title: t(e)(t(F).mvp.tip)
                  }, i(t(e)("MVP")), 9, Dt)) : s.badges.includes("ace") ? (n(), o("span", {
                    key: 1,
                    class: "iv-badge",
                    title: t(e)(t(F).ace.tip)
                  }, i(t(e)("ACE")), 9, St)) : (n(), o("small", Tt, i(t(B)(s.rank)), 1)),
                  u(Ss, {
                    score: t(O)(s.score),
                    rank: s.rank,
                    size: "sm"
                  }, null, 8, ["score", "rank"])
                ])) : (n(), o("span", Bt, "–"))
              ]),
              l("td", zt, [
                l("button", {
                  type: "button",
                  class: "iv-sb-toggle",
                  "aria-expanded": w.value === s.participantId,
                  "aria-controls": `${t(P)}-${s.participantId}`,
                  "aria-label": t(e)("Details of {name}", { name: s.gameName || t(k)(s.championId) }),
                  onClick: (r) => L(s)
                }, [
                  u(xs, {
                    name: "down",
                    size: 14
                  })
                ], 8, Et)
              ])
            ], 10, Xs),
            w.value === s.participantId ? (n(), o("tr", Gt, [
              l("td", {
                id: `${t(P)}-${s.participantId}`,
                colspan: "11"
              }, [
                l("div", Rt, [
                  u(Ts, {
                    detail: $.detail,
                    player: s,
                    me: D.value
                  }, null, 8, ["detail", "player", "me"])
                ])
              ], 8, Vt)
            ])) : v("", !0)
          ], 64))), 128))
        ], 2))), 128))
      ])
    ]));
  }
});
export {
  al as default
};
