import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
import { defineComponent as is, computed as w, shallowRef as os, watch as ns, useId as as, openBlock as n, createElementBlock as a, createElementVNode as e, toDisplayString as i, unref as t, Fragment as u, renderList as v, normalizeClass as g, createCommentVNode as k, createVNode as I, createTextVNode as m, withCtx as ds, normalizeStyle as cs } from "vue";
import { useInvadeUi as rs, useFormat as us, useNames as ms } from "../context.js";
import { hideBroken as b } from "../dom.js";
import { teamsOf as _s, riotId as bs, side as A } from "../logic/detail.js";
import { positionName as hs, topBadges as vs, BADGES as N } from "../logic/labels.js";
import gs from "./Icon.vue.js";
import ks from "./Link.vue.js";
import ps from "./ObjectiveIcon.vue.js";
import ys from "./PerfDial.vue.js";
/* empty css              */
import fs from "./PlayerDetail.vue.js";
/* empty css                 */
/* empty css                       */
/* empty css                   */
const Is = { class: "iv-sb-wrap" }, ws = { class: "iv-table iv-sb" }, Ns = { colspan: "2" }, $s = { class: "num" }, Cs = { class: "num" }, Bs = { class: "num" }, xs = { class: "num" }, Ds = { class: "num iv-sb-vis" }, Es = ["title"], Ss = { class: "iv-sb-team" }, Vs = { colspan: "10" }, Rs = { class: "iv-sb-team-line" }, zs = {
  key: 0,
  class: "iv-sb-side"
}, Ls = { class: "iv-sb-obj" }, Gs = ["title"], Ps = ["title"], As = ["src", "alt", "title"], Ks = { class: "iv-sb-tot" }, Ms = ["onClick"], js = { class: "iv-sb-who" }, Fs = ["title"], Ts = { class: "iv-sb-art" }, Hs = ["src"], Os = { class: "iv-sb-load" }, Us = ["src", "alt", "title"], Ws = ["src", "title"], Ys = { key: 1 }, qs = ["src", "title"], Js = { class: "iv-sb-name" }, Qs = { class: "iv-sb-line" }, Xs = { key: 0 }, Zs = {
  key: 0,
  class: "iv-badge brand"
}, st = { class: "iv-sb-line iv-sb-sub" }, tt = ["title"], et = ["title"], lt = { class: "num iv-sb-kda" }, it = ["title"], ot = { class: "iv-sb-bar" }, nt = ["title"], at = { class: "num" }, dt = ["title"], ct = { class: "iv-sb-items" }, rt = ["src"], ut = { class: "num iv-sb-score" }, mt = {
  key: 0,
  class: "iv-sb-perf"
}, _t = ["title"], bt = ["title"], ht = { key: 2 }, vt = {
  key: 1,
  class: "iv-pf-dim"
}, gt = { class: "iv-sb-more" }, kt = ["aria-expanded", "aria-controls", "aria-label", "onClick"], pt = {
  key: 0,
  class: "iv-sb-detail"
}, yt = ["id"], ft = { class: "iv-sb-detail-in" }, Gt = /* @__PURE__ */ is({
  __name: "Scoreboard",
  props: {
    detail: {},
    puuid: {}
  },
  setup(y) {
    const _ = y, x = rs(), { t: l } = x, { compact: $, kdaRatio: K, num: D, ordinal: E, pct: C, score100: M, signedGold: j } = us(), { champIcon: S, champName: h, itemIcon: F, runeIcon: T, runeName: H, spellIcon: O, spellName: V, styleIcon: U, styleName: W } = ms(), R = w(() => _.detail.players.find((o) => o.puuid === _.puuid)), Y = w(() => _s(_.detail, R.value)), q = w(() => Math.max(1, ..._.detail.players.map((o) => o.damage))), J = w(() => _.detail.players.some((o) => o.placement > 0));
    function Q(o) {
      return [
        { id: "tower", label: l("Towers"), n: o.towers },
        { id: "dragon", label: l("Dragons"), n: o.dragons },
        { id: "baron", label: l("Barons"), n: o.barons },
        { id: "grubs", label: l("Voidgrubs"), n: o.grubs },
        { id: "herald", label: l("Rift Herald"), n: o.heralds },
        { id: "inhib", label: l("Inhibitors"), n: o.inhibitors }
      ].filter((r) => r.n !== null);
    }
    const X = (o, d) => J.value && d ? l("{place} place", { place: E(d) }) : _.detail.remake ? l("Remake") : o.win ? l("Victory") : l("Defeat"), z = (o) => A(o) === "blue" ? l("Blue side") : A(o) === "red" ? l("Red side") : "", L = (o) => o.bans.filter((d) => d > 0), Z = (o) => o >= 1e3 ? "iv-up" : o <= -1e3 ? "iv-down" : "", p = os(null);
    ns(() => _.detail, () => p.value = null);
    const G = (o) => p.value = p.value === o.participantId ? null : o.participantId, ss = (o, d) => {
      o.target.closest("a, button") || G(d);
    }, P = as(), ts = (o) => o.puuid && o.puuid !== _.puuid ? { kind: "player", puuid: o.puuid, gameName: o.gameName, tagLine: o.tagLine } : null;
    return (o, d) => (n(), a("div", Is, [
      e("table", ws, [
        d[9] || (d[9] = e("colgroup", null, [
          e("col", { class: "iv-sb-c-who" }),
          e("col", { class: "iv-sb-c-name" }),
          e("col", { class: "iv-sb-c-kda" }),
          e("col", { class: "iv-sb-c-dmg" }),
          e("col", { class: "iv-sb-c-gold" }),
          e("col", { class: "iv-sb-c-cs" }),
          e("col", { class: "iv-sb-c-vis" }),
          e("col", { class: "iv-sb-c-items" }),
          e("col", { class: "iv-sb-c-score" }),
          e("col", { class: "iv-sb-c-more" })
        ], -1)),
        e("thead", null, [
          e("tr", null, [
            e("th", Ns, i(t(l)("Player")), 1),
            e("th", $s, i(t(l)("KDA")), 1),
            e("th", Cs, i(t(l)("Damage")), 1),
            e("th", Bs, i(t(l)("Gold")), 1),
            e("th", xs, i(t(l)("CS")), 1),
            e("th", Ds, i(t(l)("Vision")), 1),
            e("th", null, i(t(l)("Items")), 1),
            e("th", {
              class: "num",
              title: t(l)("Invade score")
            }, i(t(l)("Score")), 9, Es),
            d[4] || (d[4] = e("th", null, null, -1))
          ])
        ]),
        (n(!0), a(u, null, v(Y.value, ({ team: r, players: es, placement: ls }) => (n(), a("tbody", {
          key: r.teamId,
          class: g(r.win ? "won" : "lost")
        }, [
          e("tr", Ss, [
            e("td", Vs, [
              e("div", Rs, [
                e("b", {
                  class: g(["iv-sb-res", y.detail.remake ? "" : r.win ? "win" : "loss"])
                }, i(X(r, ls)), 3),
                z(r.teamId) ? (n(), a("span", zs, i(z(r.teamId)), 1)) : k("", !0),
                e("span", Ls, [
                  (n(!0), a(u, null, v(Q(r), (s) => (n(), a("span", {
                    key: s.id,
                    title: s.label,
                    class: g({ none: !s.n })
                  }, [
                    I(ps, {
                      name: s.id,
                      size: 14
                    }, null, 8, ["name"]),
                    m(i(s.n), 1)
                  ], 10, Gs))), 128))
                ]),
                L(r).length ? (n(), a("span", {
                  key: 1,
                  class: "iv-sb-bans",
                  title: t(l)("Bans")
                }, [
                  (n(!0), a(u, null, v(L(r), (s, c) => (n(), a("img", {
                    key: c,
                    src: t(S)(s),
                    alt: t(h)(s),
                    title: t(l)("Banned: {champion}", { champion: t(h)(s) })
                  }, null, 8, As))), 128))
                ], 8, Ps)) : k("", !0),
                e("span", Ks, [
                  m(i(r.kills) + " / " + i(r.deaths) + " / " + i(r.assists) + " ", 1),
                  d[5] || (d[5] = e("span", { class: "iv-sb-dot" }, "·", -1)),
                  m(" " + i(t(l)("{gold} gold", { gold: t($)(r.gold) })), 1)
                ])
              ])
            ])
          ]),
          (n(!0), a(u, null, v(es, (s) => (n(), a(u, {
            key: s.participantId
          }, [
            e("tr", {
              class: g(["iv-sb-row", { self: s.puuid === y.puuid, open: p.value === s.participantId }]),
              onClick: (c) => ss(c, s)
            }, [
              e("td", js, [
                e("span", {
                  class: "iv-sb-portrait",
                  title: t(h)(s.championId)
                }, [
                  e("span", Ts, [
                    e("img", {
                      src: t(S)(s.championId),
                      alt: ""
                    }, null, 8, Hs)
                  ]),
                  e("em", null, i(s.level), 1)
                ], 8, Fs),
                e("span", Os, [
                  (n(!0), a(u, null, v(s.spells, (c, f) => (n(), a("img", {
                    key: f,
                    src: t(O)(c),
                    alt: t(V)(c),
                    title: t(V)(c),
                    onError: d[0] || (d[0] = //@ts-ignore
                    (...B) => t(b) && t(b)(...B))
                  }, null, 40, Us))), 128)),
                  s.perks[0] ? (n(), a("img", {
                    key: 0,
                    src: t(T)(s.perks[0]),
                    title: t(H)(s.perks[0]),
                    alt: "",
                    class: "key",
                    onError: d[1] || (d[1] = //@ts-ignore
                    (...c) => t(b) && t(b)(...c))
                  }, null, 40, Ws)) : (n(), a("i", Ys)),
                  s.styles[1] ? (n(), a("img", {
                    key: 2,
                    src: t(U)(s.styles[1]),
                    title: t(W)(s.styles[1]),
                    alt: "",
                    class: "sub",
                    onError: d[2] || (d[2] = //@ts-ignore
                    (...c) => t(b) && t(b)(...c))
                  }, null, 40, qs)) : k("", !0)
                ])
              ]),
              e("td", Js, [
                e("span", Qs, [
                  I(ks, {
                    class: "iv-sb-link",
                    to: ts(s),
                    title: t(bs)(s) || t(h)(s.championId)
                  }, {
                    default: ds(() => [
                      m(i(s.gameName || t(h)(s.championId)), 1),
                      s.tagLine ? (n(), a("small", Xs, "#" + i(s.tagLine), 1)) : k("", !0)
                    ]),
                    _: 2
                  }, 1032, ["to", "title"]),
                  s.puuid && s.puuid === t(x).viewer.value && s.puuid !== y.puuid ? (n(), a("span", Zs, i(t(l)("You")), 1)) : k("", !0)
                ]),
                e("span", st, [
                  e("small", null, [
                    s.position ? (n(), a(u, { key: 0 }, [
                      m(i(t(hs)(s.position, t(l))), 1)
                    ], 64)) : (n(), a(u, { key: 1 }, [
                      m(i(t(h)(s.championId)), 1)
                    ], 64)),
                    s.gold15 !== null ? (n(), a(u, { key: 2 }, [
                      d[6] || (d[6] = m(" · ", -1)),
                      e("span", {
                        class: g(Z(s.gold15)),
                        title: t(l)("Gold lead over the lane opponent at 15 minutes")
                      }, i(t(l)("{gold} gold @15", { gold: t(j)(s.gold15) })), 11, tt)
                    ], 64)) : k("", !0)
                  ]),
                  (n(!0), a(u, null, v(t(vs)(s.badges), (c) => (n(), a("span", {
                    key: c,
                    class: "iv-badge",
                    title: t(l)(t(N)[c].tip)
                  }, i(t(l)(t(N)[c].label)), 9, et))), 128))
                ])
              ]),
              e("td", lt, [
                e("b", null, [
                  m(i(s.kills), 1),
                  d[7] || (d[7] = e("i", null, "/", -1)),
                  m(i(s.deaths), 1),
                  d[8] || (d[8] = e("i", null, "/", -1)),
                  m(i(s.assists), 1)
                ]),
                e("small", null, i(t(K)(s.kills, s.deaths, s.assists)) + " · " + i(t(C)(s.kp)) + " " + i(t(l)("KP")), 1)
              ]),
              e("td", {
                class: "num iv-sb-dmg",
                title: `${t(D)(s.damage)} · ${t(l)("{share} of the team", { share: t(C)(s.damageShare) })}`
              }, [
                e("b", null, i(t($)(s.damage)), 1),
                e("i", ot, [
                  e("em", {
                    style: cs({ width: `${s.damage / q.value * 100}%` })
                  }, null, 4)
                ])
              ], 8, it),
              e("td", {
                class: "num",
                title: t(l)("{share} of the team", { share: t(C)(s.goldShare) })
              }, [
                e("b", null, i(t($)(s.gold)), 1)
              ], 8, nt),
              e("td", at, [
                e("b", null, i(s.cs), 1),
                e("small", null, i(t(D)(s.csMin, 1)), 1)
              ]),
              e("td", {
                class: "num iv-sb-vis",
                title: t(l)("{placed} placed · {killed} destroyed · {control} control wards", { placed: s.wardsPlaced, killed: s.wardsKilled, control: s.controlWards })
              }, [
                e("b", null, i(s.vision), 1)
              ], 8, dt),
              e("td", null, [
                e("span", ct, [
                  (n(!0), a(u, null, v(s.items, (c, f) => (n(), a(u, { key: f }, [
                    c ? (n(), a("img", {
                      key: 0,
                      src: t(F)(c),
                      alt: "",
                      class: g({ trinket: f === 6 }),
                      onError: d[3] || (d[3] = //@ts-ignore
                      (...B) => t(b) && t(b)(...B))
                    }, null, 42, rt)) : (n(), a("i", {
                      key: 1,
                      class: g({ trinket: f === 6 })
                    }, null, 2))
                  ], 64))), 128))
                ])
              ]),
              e("td", ut, [
                s.score !== null ? (n(), a("span", mt, [
                  s.badges.includes("mvp") ? (n(), a("span", {
                    key: 0,
                    class: "iv-badge gold",
                    title: t(l)(t(N).mvp.tip)
                  }, i(t(l)("MVP")), 9, _t)) : s.badges.includes("ace") ? (n(), a("span", {
                    key: 1,
                    class: "iv-badge",
                    title: t(l)(t(N).ace.tip)
                  }, i(t(l)("ACE")), 9, bt)) : (n(), a("small", ht, i(t(E)(s.rank)), 1)),
                  I(ys, {
                    score: t(M)(s.score),
                    rank: s.rank,
                    size: "sm"
                  }, null, 8, ["score", "rank"])
                ])) : (n(), a("span", vt, "–"))
              ]),
              e("td", gt, [
                e("button", {
                  type: "button",
                  class: "iv-sb-toggle",
                  "aria-expanded": p.value === s.participantId,
                  "aria-controls": `${t(P)}-${s.participantId}`,
                  "aria-label": t(l)("Details of {name}", { name: s.gameName || t(h)(s.championId) }),
                  onClick: (c) => G(s)
                }, [
                  I(gs, {
                    name: "down",
                    size: 14
                  })
                ], 8, kt)
              ])
            ], 10, Ms),
            p.value === s.participantId ? (n(), a("tr", pt, [
              e("td", {
                id: `${t(P)}-${s.participantId}`,
                colspan: "10"
              }, [
                e("div", ft, [
                  I(fs, {
                    detail: y.detail,
                    player: s,
                    me: R.value
                  }, null, 8, ["detail", "player", "me"])
                ])
              ], 8, yt)
            ])) : k("", !0)
          ], 64))), 128))
        ], 2))), 128))
      ])
    ]));
  }
});
export {
  Gt as default
};
