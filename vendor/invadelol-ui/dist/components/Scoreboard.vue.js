import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
import { defineComponent as rs, computed as g, shallowRef as us, watch as ms, useId as _s, openBlock as n, createElementBlock as o, createElementVNode as e, toDisplayString as i, unref as s, Fragment as m, renderList as k, normalizeClass as p, createCommentVNode as b, createBlock as bs, createVNode as N, createTextVNode as _, withCtx as vs, normalizeStyle as A } from "vue";
import { useInvadeUi as hs, useFormat as gs, useNames as ks } from "../context.js";
import { hideBroken as v } from "../dom.js";
import { teamsOf as ps, riotId as ys, side as j } from "../logic/detail.js";
import { positionName as fs, topBadges as ws, BADGES as C } from "../logic/labels.js";
import { detailTeamRating as Is } from "../logic/team.js";
import $s from "./Icon.vue.js";
import Ns from "./Link.vue.js";
import xs from "./ObjectiveIcon.vue.js";
import Cs from "./PerfDial.vue.js";
/* empty css              */
import Bs from "./PlayerDetail.vue.js";
import Ss from "./TeamBadge.vue.js";
/* empty css               */
/* empty css                 */
/* empty css                       */
/* empty css                   */
const Ts = { class: "iv-sb-wrap" }, Ds = { class: "iv-table iv-sb" }, Es = { colspan: "2" }, Vs = { class: "num" }, Rs = { class: "num" }, Ms = { class: "num iv-sb-taken" }, zs = { class: "num" }, Gs = { class: "num" }, Ls = { class: "num iv-sb-vis" }, Ps = ["title"], Ks = { class: "iv-sb-team" }, As = { colspan: "11" }, js = { class: "iv-sb-team-line" }, Fs = {
  key: 0,
  class: "iv-sb-side"
}, Hs = { class: "iv-sb-obj" }, Os = ["title"], Us = ["title"], Ws = ["src", "alt", "title"], Ys = { class: "iv-sb-tot" }, qs = ["onClick"], Js = { class: "iv-sb-who" }, Qs = ["title"], Xs = { class: "iv-sb-art" }, Zs = ["src"], st = { class: "iv-sb-load" }, tt = ["src", "alt", "title"], et = ["src", "title"], lt = { key: 1 }, at = ["src", "title"], it = { class: "iv-sb-name" }, nt = { class: "iv-sb-line" }, ot = { key: 0 }, dt = {
  key: 0,
  class: "iv-badge brand"
}, ct = { class: "iv-sb-line iv-sb-sub" }, rt = ["title"], ut = ["title"], mt = { class: "num iv-sb-kda" }, _t = ["title", "data-l"], bt = { class: "iv-sb-share" }, vt = { class: "iv-sb-bar" }, ht = ["title"], gt = { class: "iv-sb-bar taken" }, kt = ["title", "data-l"], pt = ["data-l"], yt = ["title"], ft = { class: "iv-sb-itd" }, wt = { class: "iv-sb-items" }, It = ["src", "alt", "title"], $t = { class: "num iv-sb-score" }, Nt = {
  key: 0,
  class: "iv-sb-perf"
}, xt = ["title"], Ct = ["title"], Bt = { key: 2 }, St = {
  key: 1,
  class: "iv-pf-dim"
}, Tt = { class: "iv-sb-more" }, Dt = ["aria-expanded", "aria-controls", "aria-label", "onClick"], Et = {
  key: 0,
  class: "iv-sb-detail"
}, Vt = ["id"], Rt = { class: "iv-sb-detail-in" }, Xt = /* @__PURE__ */ rs({
  __name: "Scoreboard",
  props: {
    detail: {},
    puuid: {}
  },
  setup(f) {
    const u = f, T = hs(), { t: l } = T, { compact: x, kdaRatio: F, num: w, ordinal: D, pct: I, score100: H, signedGold: O } = gs(), { champIcon: E, champName: h, itemIcon: U, itemName: V, runeIcon: W, runeName: Y, spellIcon: q, spellName: R, styleIcon: J, styleName: Q } = ks(), B = g(() => u.detail.players.find((a) => a.puuid === u.puuid)), X = g(() => ps(u.detail, B.value)), M = g(() => Is(u.detail, u.puuid)), Z = g(() => Math.max(1, ...u.detail.players.map((a) => a.damage))), ss = g(() => Math.max(1, ...u.detail.players.map((a) => a.damageTaken))), z = g(() => Math.max(1, u.detail.duration / 60)), ts = (a) => {
      const d = (r) => I(r / Math.max(1, a.damage));
      return `${w(a.damage)} · ${l("{share} of the team", { share: I(a.damageShare) })} · ${l("{physical} physical · {magic} magic · {true} true", { physical: d(a.physical), magic: d(a.magic), true: d(a.trueDamage) })}`;
    }, es = g(() => u.detail.players.some((a) => a.placement > 0));
    function ls(a) {
      return [
        { id: "tower", label: l("Towers"), n: a.towers },
        { id: "dragon", label: l("Dragons"), n: a.dragons },
        { id: "baron", label: l("Barons"), n: a.barons },
        { id: "grubs", label: l("Voidgrubs"), n: a.grubs },
        { id: "herald", label: l("Rift Herald"), n: a.heralds },
        { id: "inhib", label: l("Inhibitors"), n: a.inhibitors }
      ].filter((r) => r.n !== null);
    }
    const as = (a, d) => es.value && d ? l("{place} place", { place: D(d) }) : u.detail.remake ? l("Remake") : a.win ? l("Victory") : l("Defeat"), G = (a) => j(a) === "blue" ? l("Blue side") : j(a) === "red" ? l("Red side") : "", L = (a) => a.bans.filter((d) => d > 0), is = (a) => a >= 1e3 ? "iv-up" : a <= -1e3 ? "iv-down" : "", y = us(null);
    ms(() => u.detail, () => y.value = null);
    const P = (a) => y.value = y.value === a.participantId ? null : a.participantId, ns = (a, d) => {
      a.target.closest("a, button") || P(d);
    }, K = _s(), os = (a) => a.puuid && a.puuid !== u.puuid ? { kind: "player", puuid: a.puuid, gameName: a.gameName, tagLine: a.tagLine } : null;
    return (a, d) => (n(), o("div", Ts, [
      e("table", Ds, [
        d[9] || (d[9] = e("colgroup", null, [
          e("col", { class: "iv-sb-c-who" }),
          e("col", { class: "iv-sb-c-name" }),
          e("col", { class: "iv-sb-c-kda" }),
          e("col", { class: "iv-sb-c-dmg" }),
          e("col", { class: "iv-sb-c-taken iv-sb-taken" }),
          e("col", { class: "iv-sb-c-gold" }),
          e("col", { class: "iv-sb-c-cs" }),
          e("col", { class: "iv-sb-c-vis" }),
          e("col", { class: "iv-sb-c-items" }),
          e("col", { class: "iv-sb-c-score" }),
          e("col", { class: "iv-sb-c-more" })
        ], -1)),
        e("thead", null, [
          e("tr", null, [
            e("th", Es, i(s(l)("Player")), 1),
            e("th", Vs, i(s(l)("KDA")), 1),
            e("th", Rs, i(s(l)("Damage")), 1),
            e("th", Ms, i(s(l)("Taken")), 1),
            e("th", zs, i(s(l)("Gold")), 1),
            e("th", Gs, i(s(l)("CS")), 1),
            e("th", Ls, i(s(l)("Vision")), 1),
            e("th", null, i(s(l)("Items")), 1),
            e("th", {
              class: "num",
              title: s(l)("Invade score")
            }, i(s(l)("Score")), 9, Ps),
            d[4] || (d[4] = e("th", null, null, -1))
          ])
        ]),
        (n(!0), o(m, null, k(X.value, ({ team: r, players: ds, placement: cs }) => (n(), o("tbody", {
          key: r.teamId,
          class: p(r.win ? "won" : "lost")
        }, [
          e("tr", Ks, [
            e("td", As, [
              e("div", js, [
                e("b", {
                  class: p(["iv-sb-res", f.detail.remake ? "" : r.win ? "win" : "loss"])
                }, i(as(r, cs)), 3),
                G(r.teamId) ? (n(), o("span", Fs, i(G(r.teamId)), 1)) : b("", !0),
                M.value && r.teamId === B.value?.teamId ? (n(), bs(Ss, {
                  key: 1,
                  verdict: M.value,
                  win: r.win
                }, null, 8, ["verdict", "win"])) : b("", !0),
                e("span", Hs, [
                  (n(!0), o(m, null, k(ls(r), (t) => (n(), o("span", {
                    key: t.id,
                    title: t.label,
                    class: p({ none: !t.n })
                  }, [
                    N(xs, {
                      name: t.id,
                      size: 14
                    }, null, 8, ["name"]),
                    _(i(t.n), 1)
                  ], 10, Os))), 128))
                ]),
                L(r).length ? (n(), o("span", {
                  key: 2,
                  class: "iv-sb-bans",
                  title: s(l)("Bans")
                }, [
                  (n(!0), o(m, null, k(L(r), (t, c) => (n(), o("img", {
                    key: c,
                    src: s(E)(t),
                    alt: s(h)(t),
                    title: s(l)("Banned: {champion}", { champion: s(h)(t) })
                  }, null, 8, Ws))), 128))
                ], 8, Us)) : b("", !0),
                e("span", Ys, [
                  _(i(r.kills) + " / " + i(r.deaths) + " / " + i(r.assists) + " ", 1),
                  d[5] || (d[5] = e("span", { class: "iv-sb-dot" }, "·", -1)),
                  _(" " + i(s(l)("{gold} gold", { gold: s(x)(r.gold) })), 1)
                ])
              ])
            ])
          ]),
          (n(!0), o(m, null, k(ds, (t) => (n(), o(m, {
            key: t.participantId
          }, [
            e("tr", {
              class: p(["iv-sb-row", { self: t.puuid === f.puuid, open: y.value === t.participantId }]),
              onClick: (c) => ns(c, t)
            }, [
              e("td", Js, [
                e("span", {
                  class: "iv-sb-portrait",
                  title: s(h)(t.championId)
                }, [
                  e("span", Xs, [
                    e("img", {
                      src: s(E)(t.championId),
                      alt: ""
                    }, null, 8, Zs)
                  ]),
                  e("em", null, i(t.level), 1)
                ], 8, Qs),
                e("span", st, [
                  (n(!0), o(m, null, k(t.spells, (c, $) => (n(), o("img", {
                    key: $,
                    src: s(q)(c),
                    alt: s(R)(c),
                    title: s(R)(c),
                    onError: d[0] || (d[0] = //@ts-ignore
                    (...S) => s(v) && s(v)(...S))
                  }, null, 40, tt))), 128)),
                  t.perks[0] ? (n(), o("img", {
                    key: 0,
                    src: s(W)(t.perks[0]),
                    title: s(Y)(t.perks[0]),
                    alt: "",
                    class: "key",
                    onError: d[1] || (d[1] = //@ts-ignore
                    (...c) => s(v) && s(v)(...c))
                  }, null, 40, et)) : (n(), o("i", lt)),
                  t.styles[1] ? (n(), o("img", {
                    key: 2,
                    src: s(J)(t.styles[1]),
                    title: s(Q)(t.styles[1]),
                    alt: "",
                    class: "sub",
                    onError: d[2] || (d[2] = //@ts-ignore
                    (...c) => s(v) && s(v)(...c))
                  }, null, 40, at)) : b("", !0)
                ])
              ]),
              e("td", it, [
                e("span", nt, [
                  N(Ns, {
                    class: "iv-sb-link",
                    to: os(t),
                    title: s(ys)(t) || s(h)(t.championId)
                  }, {
                    default: vs(() => [
                      _(i(t.gameName || s(h)(t.championId)), 1),
                      t.tagLine ? (n(), o("small", ot, "#" + i(t.tagLine), 1)) : b("", !0)
                    ]),
                    _: 2
                  }, 1032, ["to", "title"]),
                  t.puuid && t.puuid === s(T).viewer.value && t.puuid !== f.puuid ? (n(), o("span", dt, i(s(l)("You")), 1)) : b("", !0)
                ]),
                e("span", ct, [
                  e("small", null, [
                    t.position ? (n(), o(m, { key: 0 }, [
                      _(i(s(fs)(t.position, s(l))), 1)
                    ], 64)) : (n(), o(m, { key: 1 }, [
                      _(i(s(h)(t.championId)), 1)
                    ], 64)),
                    t.gold15 !== null ? (n(), o(m, { key: 2 }, [
                      d[6] || (d[6] = _(" · ", -1)),
                      e("span", {
                        class: p(is(t.gold15)),
                        title: s(l)("Gold lead over the lane opponent at 15 minutes")
                      }, i(s(l)("{gold} gold @15", { gold: s(O)(t.gold15) })), 11, rt)
                    ], 64)) : b("", !0)
                  ]),
                  (n(!0), o(m, null, k(s(ws)(t.badges), (c) => (n(), o("span", {
                    key: c,
                    class: "iv-badge",
                    title: s(l)(s(C)[c].tip)
                  }, i(s(l)(s(C)[c].label)), 9, ut))), 128))
                ])
              ]),
              e("td", mt, [
                e("b", null, [
                  _(i(t.kills), 1),
                  d[7] || (d[7] = e("i", null, "/", -1)),
                  _(i(t.deaths), 1),
                  d[8] || (d[8] = e("i", null, "/", -1)),
                  _(i(t.assists), 1)
                ]),
                e("small", null, i(s(F)(t.kills, t.deaths, t.assists)) + " · " + i(s(I)(t.kp)) + " " + i(s(l)("KP")), 1)
              ]),
              e("td", {
                class: "num iv-sb-dmg",
                title: ts(t),
                "data-l": s(l)("dmg")
              }, [
                e("b", null, [
                  e("small", bt, i(s(I)(t.damageShare)), 1),
                  _(i(s(x)(t.damage)), 1)
                ]),
                e("i", vt, [
                  e("em", {
                    style: A({ width: `${t.damage / Z.value * 100}%` })
                  }, null, 4)
                ])
              ], 8, _t),
              e("td", {
                class: "num iv-sb-dmg iv-sb-taken",
                title: s(w)(t.damageTaken)
              }, [
                e("b", null, i(s(x)(t.damageTaken)), 1),
                e("i", gt, [
                  e("em", {
                    style: A({ width: `${t.damageTaken / ss.value * 100}%` })
                  }, null, 4)
                ])
              ], 8, ht),
              e("td", {
                class: "num iv-sb-gold",
                title: `${s(l)("{share} of the team", { share: s(I)(t.goldShare) })} · ${s(l)("Gold per minute")}: ${s(w)(t.gold / z.value)}`,
                "data-l": s(l)("gold")
              }, [
                e("b", null, i(s(x)(t.gold)), 1),
                e("small", null, i(s(w)(t.gold / z.value)), 1)
              ], 8, kt),
              e("td", {
                class: "num iv-sb-cs",
                "data-l": s(l)("CS")
              }, [
                e("b", null, i(t.cs), 1),
                e("small", null, i(s(w)(t.csMin, 1)), 1)
              ], 8, pt),
              e("td", {
                class: "num iv-sb-vis",
                title: s(l)("{placed} placed · {killed} destroyed · {control} control wards", { placed: t.wardsPlaced, killed: t.wardsKilled, control: t.controlWards })
              }, [
                e("b", null, i(t.vision), 1),
                e("small", null, i(t.wardsPlaced) + " / " + i(t.wardsKilled), 1)
              ], 8, yt),
              e("td", ft, [
                e("span", wt, [
                  (n(!0), o(m, null, k(t.items, (c, $) => (n(), o(m, { key: $ }, [
                    c ? (n(), o("img", {
                      key: 0,
                      src: s(U)(c),
                      alt: s(V)(c),
                      title: s(V)(c),
                      class: p({ trinket: $ === 6 }),
                      onError: d[3] || (d[3] = //@ts-ignore
                      (...S) => s(v) && s(v)(...S))
                    }, null, 42, It)) : (n(), o("i", {
                      key: 1,
                      class: p({ trinket: $ === 6 })
                    }, null, 2))
                  ], 64))), 128))
                ])
              ]),
              e("td", $t, [
                t.score !== null ? (n(), o("span", Nt, [
                  t.badges.includes("mvp") ? (n(), o("span", {
                    key: 0,
                    class: "iv-badge gold",
                    title: s(l)(s(C).mvp.tip)
                  }, i(s(l)("MVP")), 9, xt)) : t.badges.includes("ace") ? (n(), o("span", {
                    key: 1,
                    class: "iv-badge",
                    title: s(l)(s(C).ace.tip)
                  }, i(s(l)("ACE")), 9, Ct)) : (n(), o("small", Bt, i(s(D)(t.rank)), 1)),
                  N(Cs, {
                    score: s(H)(t.score),
                    rank: t.rank,
                    size: "sm"
                  }, null, 8, ["score", "rank"])
                ])) : (n(), o("span", St, "–"))
              ]),
              e("td", Tt, [
                e("button", {
                  type: "button",
                  class: "iv-sb-toggle",
                  "aria-expanded": y.value === t.participantId,
                  "aria-controls": `${s(K)}-${t.participantId}`,
                  "aria-label": s(l)("Details of {name}", { name: t.gameName || s(h)(t.championId) }),
                  onClick: (c) => P(t)
                }, [
                  N($s, {
                    name: "down",
                    size: 14
                  })
                ], 8, Dt)
              ])
            ], 10, qs),
            y.value === t.participantId ? (n(), o("tr", Et, [
              e("td", {
                id: `${s(K)}-${t.participantId}`,
                colspan: "11"
              }, [
                e("div", Rt, [
                  N(Bs, {
                    detail: f.detail,
                    player: t,
                    me: B.value
                  }, null, 8, ["detail", "player", "me"])
                ])
              ], 8, Vt)
            ])) : b("", !0)
          ], 64))), 128))
        ], 2))), 128))
      ])
    ]));
  }
});
export {
  Xt as default
};
