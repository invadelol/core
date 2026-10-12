import { defineComponent as ts, computed as p, openBlock as o, createElementBlock as n, createElementVNode as e, toDisplayString as i, unref as s, Fragment as u, renderList as h, normalizeClass as v, createCommentVNode as g, createVNode as E, createTextVNode as m, withCtx as es, normalizeStyle as ls } from "vue";
import { useInvadeUi as is, useFormat as os, useNames as ns } from "../context.js";
import { hideBroken as b } from "../dom.js";
import { teamsOf as as, riotId as ds, side as z } from "../logic/detail.js";
import { positionName as cs, topBadges as rs, BADGES as w } from "../logic/labels.js";
import us from "./Link.vue.js";
import ms from "./ObjectiveIcon.vue.js";
import _s from "./PerfDial.vue.js";
/* empty css              */
const bs = { class: "iv-sb-wrap" }, hs = { class: "iv-table iv-sb" }, vs = { colspan: "2" }, gs = { class: "num" }, ks = { class: "num" }, ys = { class: "num" }, ps = { class: "num" }, fs = { class: "num iv-sb-vis" }, ws = ["title"], Is = { class: "iv-sb-team" }, Ns = { colspan: "9" }, Bs = { class: "iv-sb-team-line" }, Es = {
  key: 0,
  class: "iv-sb-side"
}, Ss = {
  key: 1,
  class: "iv-sb-obj"
}, Vs = ["title"], Cs = ["title"], Ds = ["src", "alt", "title"], xs = { class: "iv-sb-tot" }, $s = { class: "iv-sb-who" }, Ls = ["title"], zs = { class: "iv-sb-art" }, Gs = ["src"], Ps = { class: "iv-sb-load" }, Rs = ["src", "alt", "title"], As = ["src", "title"], Ks = { key: 1 }, Ms = ["src", "title"], js = { class: "iv-sb-name" }, Fs = { class: "iv-sb-line" }, Ts = { key: 0 }, Hs = {
  key: 0,
  class: "iv-badge brand"
}, Os = { class: "iv-sb-line iv-sb-sub" }, Us = ["title"], Ws = ["title"], Ys = { class: "num iv-sb-kda" }, qs = ["title"], Js = { class: "iv-sb-bar" }, Qs = ["title"], Xs = { class: "num" }, Zs = ["title"], st = { class: "iv-sb-items" }, tt = ["src"], et = { class: "num iv-sb-score" }, lt = {
  key: 0,
  class: "iv-sb-perf"
}, it = ["title"], ot = ["title"], nt = { key: 2 }, at = {
  key: 1,
  class: "iv-pf-dim"
}, gt = /* @__PURE__ */ ts({
  __name: "Scoreboard",
  props: {
    detail: {},
    puuid: {}
  },
  setup(f) {
    const _ = f, S = is(), { t: l } = S, { compact: I, kdaRatio: G, num: V, ordinal: C, pct: N, score100: P, signedGold: R } = os(), { champIcon: D, champName: k, itemIcon: A, runeIcon: K, runeName: M, spellIcon: j, spellName: x, styleIcon: F, styleName: T } = ns(), H = p(() => _.detail.players.find((a) => a.puuid === _.puuid)), O = p(() => as(_.detail, H.value)), U = p(() => Math.max(1, ..._.detail.players.map((a) => a.damage))), W = p(() => _.detail.mapId === 11), Y = p(() => _.detail.players.some((a) => a.placement > 0));
    function q(a) {
      return [
        { id: "tower", label: l("Towers"), n: a.towers },
        { id: "dragon", label: l("Dragons"), n: a.dragons },
        { id: "baron", label: l("Barons"), n: a.barons },
        { id: "grubs", label: l("Voidgrubs"), n: a.grubs },
        { id: "herald", label: l("Rift Herald"), n: a.heralds },
        { id: "inhib", label: l("Inhibitors"), n: a.inhibitors }
      ].filter((r) => r.n !== null);
    }
    const J = (a, d) => Y.value && d ? l("{place} place", { place: C(d) }) : _.detail.remake ? l("Remake") : a.win ? l("Victory") : l("Defeat"), $ = (a) => z(a) === "blue" ? l("Blue side") : z(a) === "red" ? l("Red side") : "", L = (a) => a.bans.filter((d) => d > 0), Q = (a) => a >= 1e3 ? "iv-up" : a <= -1e3 ? "iv-down" : "", X = (a) => a.puuid && a.puuid !== _.puuid ? { kind: "player", puuid: a.puuid, gameName: a.gameName, tagLine: a.tagLine } : null;
    return (a, d) => (o(), n("div", bs, [
      e("table", hs, [
        d[8] || (d[8] = e("colgroup", null, [
          e("col", { class: "iv-sb-c-who" }),
          e("col", { class: "iv-sb-c-name" }),
          e("col", { class: "iv-sb-c-kda" }),
          e("col", { class: "iv-sb-c-dmg" }),
          e("col", { class: "iv-sb-c-gold" }),
          e("col", { class: "iv-sb-c-cs" }),
          e("col", { class: "iv-sb-c-vis" }),
          e("col", { class: "iv-sb-c-items" }),
          e("col", { class: "iv-sb-c-score" })
        ], -1)),
        e("thead", null, [
          e("tr", null, [
            e("th", vs, i(s(l)("Player")), 1),
            e("th", gs, i(s(l)("KDA")), 1),
            e("th", ks, i(s(l)("Damage")), 1),
            e("th", ys, i(s(l)("Gold")), 1),
            e("th", ps, i(s(l)("CS")), 1),
            e("th", fs, i(s(l)("Vision")), 1),
            e("th", null, i(s(l)("Items")), 1),
            e("th", {
              class: "num",
              title: s(l)("Invade score")
            }, i(s(l)("Score")), 9, ws)
          ])
        ]),
        (o(!0), n(u, null, h(O.value, ({ team: r, players: Z, placement: ss }) => (o(), n("tbody", {
          key: r.teamId,
          class: v(r.win ? "won" : "lost")
        }, [
          e("tr", Is, [
            e("td", Ns, [
              e("div", Bs, [
                e("b", {
                  class: v(["iv-sb-res", f.detail.remake ? "" : r.win ? "win" : "loss"])
                }, i(J(r, ss)), 3),
                $(r.teamId) ? (o(), n("span", Es, i($(r.teamId)), 1)) : g("", !0),
                W.value ? (o(), n("span", Ss, [
                  (o(!0), n(u, null, h(q(r), (t) => (o(), n("span", {
                    key: t.id,
                    title: t.label,
                    class: v({ none: !t.n })
                  }, [
                    E(ms, {
                      name: t.id,
                      size: 14
                    }, null, 8, ["name"]),
                    m(i(t.n), 1)
                  ], 10, Vs))), 128))
                ])) : g("", !0),
                L(r).length ? (o(), n("span", {
                  key: 2,
                  class: "iv-sb-bans",
                  title: s(l)("Bans")
                }, [
                  (o(!0), n(u, null, h(L(r), (t, c) => (o(), n("img", {
                    key: c,
                    src: s(D)(t),
                    alt: s(k)(t),
                    title: s(l)("Banned: {champion}", { champion: s(k)(t) })
                  }, null, 8, Ds))), 128))
                ], 8, Cs)) : g("", !0),
                e("span", xs, [
                  m(i(r.kills) + " / " + i(r.deaths) + " / " + i(r.assists) + " ", 1),
                  d[4] || (d[4] = e("span", { class: "iv-sb-dot" }, "·", -1)),
                  m(" " + i(s(l)("{gold} gold", { gold: s(I)(r.gold) })), 1)
                ])
              ])
            ])
          ]),
          (o(!0), n(u, null, h(Z, (t) => (o(), n("tr", {
            key: t.participantId,
            class: v({ self: t.puuid === f.puuid })
          }, [
            e("td", $s, [
              e("span", {
                class: "iv-sb-portrait",
                title: s(k)(t.championId)
              }, [
                e("span", zs, [
                  e("img", {
                    src: s(D)(t.championId),
                    alt: ""
                  }, null, 8, Gs)
                ]),
                e("em", null, i(t.level), 1)
              ], 8, Ls),
              e("span", Ps, [
                (o(!0), n(u, null, h(t.spells, (c, y) => (o(), n("img", {
                  key: y,
                  src: s(j)(c),
                  alt: s(x)(c),
                  title: s(x)(c),
                  onError: d[0] || (d[0] = //@ts-ignore
                  (...B) => s(b) && s(b)(...B))
                }, null, 40, Rs))), 128)),
                t.perks[0] ? (o(), n("img", {
                  key: 0,
                  src: s(K)(t.perks[0]),
                  title: s(M)(t.perks[0]),
                  alt: "",
                  class: "key",
                  onError: d[1] || (d[1] = //@ts-ignore
                  (...c) => s(b) && s(b)(...c))
                }, null, 40, As)) : (o(), n("i", Ks)),
                t.styles[1] ? (o(), n("img", {
                  key: 2,
                  src: s(F)(t.styles[1]),
                  title: s(T)(t.styles[1]),
                  alt: "",
                  class: "sub",
                  onError: d[2] || (d[2] = //@ts-ignore
                  (...c) => s(b) && s(b)(...c))
                }, null, 40, Ms)) : g("", !0)
              ])
            ]),
            e("td", js, [
              e("span", Fs, [
                E(us, {
                  class: "iv-sb-link",
                  to: X(t),
                  title: s(ds)(t) || s(k)(t.championId)
                }, {
                  default: es(() => [
                    m(i(t.gameName || s(k)(t.championId)), 1),
                    t.tagLine ? (o(), n("small", Ts, "#" + i(t.tagLine), 1)) : g("", !0)
                  ]),
                  _: 2
                }, 1032, ["to", "title"]),
                t.puuid && t.puuid === s(S).viewer.value && t.puuid !== f.puuid ? (o(), n("span", Hs, i(s(l)("You")), 1)) : g("", !0)
              ]),
              e("span", Os, [
                e("small", null, [
                  t.position ? (o(), n(u, { key: 0 }, [
                    m(i(s(cs)(t.position, s(l))), 1)
                  ], 64)) : (o(), n(u, { key: 1 }, [
                    m(i(s(k)(t.championId)), 1)
                  ], 64)),
                  t.gold15 !== null ? (o(), n(u, { key: 2 }, [
                    d[5] || (d[5] = m(" · ", -1)),
                    e("span", {
                      class: v(Q(t.gold15)),
                      title: s(l)("Gold lead over the lane opponent at 15 minutes")
                    }, i(s(l)("{gold} gold @15", { gold: s(R)(t.gold15) })), 11, Us)
                  ], 64)) : g("", !0)
                ]),
                (o(!0), n(u, null, h(s(rs)(t.badges), (c) => (o(), n("span", {
                  key: c,
                  class: "iv-badge",
                  title: s(l)(s(w)[c].tip)
                }, i(s(l)(s(w)[c].label)), 9, Ws))), 128))
              ])
            ]),
            e("td", Ys, [
              e("b", null, [
                m(i(t.kills), 1),
                d[6] || (d[6] = e("i", null, "/", -1)),
                m(i(t.deaths), 1),
                d[7] || (d[7] = e("i", null, "/", -1)),
                m(i(t.assists), 1)
              ]),
              e("small", null, i(s(G)(t.kills, t.deaths, t.assists)) + " · " + i(s(N)(t.kp)) + " " + i(s(l)("KP")), 1)
            ]),
            e("td", {
              class: "num iv-sb-dmg",
              title: `${s(V)(t.damage)} · ${s(l)("{share} of the team", { share: s(N)(t.damageShare) })}`
            }, [
              e("b", null, i(s(I)(t.damage)), 1),
              e("i", Js, [
                e("em", {
                  style: ls({ width: `${t.damage / U.value * 100}%` })
                }, null, 4)
              ])
            ], 8, qs),
            e("td", {
              class: "num",
              title: s(l)("{share} of the team", { share: s(N)(t.goldShare) })
            }, [
              e("b", null, i(s(I)(t.gold)), 1)
            ], 8, Qs),
            e("td", Xs, [
              e("b", null, i(t.cs), 1),
              e("small", null, i(s(V)(t.csMin, 1)), 1)
            ]),
            e("td", {
              class: "num iv-sb-vis",
              title: s(l)("{placed} placed · {killed} destroyed · {control} control wards", { placed: t.wardsPlaced, killed: t.wardsKilled, control: t.controlWards })
            }, [
              e("b", null, i(t.vision), 1)
            ], 8, Zs),
            e("td", null, [
              e("span", st, [
                (o(!0), n(u, null, h(t.items, (c, y) => (o(), n(u, { key: y }, [
                  c ? (o(), n("img", {
                    key: 0,
                    src: s(A)(c),
                    alt: "",
                    class: v({ trinket: y === 6 }),
                    onError: d[3] || (d[3] = //@ts-ignore
                    (...B) => s(b) && s(b)(...B))
                  }, null, 42, tt)) : (o(), n("i", {
                    key: 1,
                    class: v({ trinket: y === 6 })
                  }, null, 2))
                ], 64))), 128))
              ])
            ]),
            e("td", et, [
              t.score !== null ? (o(), n("span", lt, [
                t.badges.includes("mvp") ? (o(), n("span", {
                  key: 0,
                  class: "iv-badge gold",
                  title: s(l)(s(w).mvp.tip)
                }, i(s(l)("MVP")), 9, it)) : t.badges.includes("ace") ? (o(), n("span", {
                  key: 1,
                  class: "iv-badge",
                  title: s(l)(s(w).ace.tip)
                }, i(s(l)("ACE")), 9, ot)) : (o(), n("small", nt, i(s(C)(t.rank)), 1)),
                E(_s, {
                  score: s(P)(t.score),
                  rank: t.rank,
                  size: "sm"
                }, null, 8, ["score", "rank"])
              ])) : (o(), n("span", at, "–"))
            ])
          ], 2))), 128))
        ], 2))), 128))
      ])
    ]));
  }
});
export {
  gt as default
};
