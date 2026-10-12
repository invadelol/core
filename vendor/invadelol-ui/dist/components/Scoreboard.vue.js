import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
import { defineComponent as os, computed as I, shallowRef as ns, watch as as, useId as ds, openBlock as n, createElementBlock as a, createElementVNode as e, toDisplayString as i, unref as t, Fragment as u, renderList as g, normalizeClass as k, createCommentVNode as b, createVNode as w, createTextVNode as m, withCtx as cs, normalizeStyle as rs } from "vue";
import { useInvadeUi as us, useFormat as ms, useNames as _s } from "../context.js";
import { hideBroken as h } from "../dom.js";
import { teamsOf as bs, riotId as hs, side as A } from "../logic/detail.js";
import { positionName as vs, topBadges as gs, BADGES as N } from "../logic/labels.js";
import ks from "./Icon.vue.js";
import ps from "./Link.vue.js";
import ys from "./ObjectiveIcon.vue.js";
import fs from "./PerfDial.vue.js";
/* empty css              */
import Is from "./PlayerDetail.vue.js";
/* empty css                 */
/* empty css                       */
/* empty css                   */
const ws = { class: "iv-sb-wrap" }, Ns = { class: "iv-table iv-sb" }, $s = { colspan: "2" }, Cs = { class: "num" }, Bs = { class: "num" }, xs = { class: "num" }, Ds = { class: "num" }, Es = { class: "num iv-sb-vis" }, Ss = ["title"], Vs = { class: "iv-sb-team" }, Rs = { colspan: "10" }, zs = { class: "iv-sb-team-line" }, Ls = {
  key: 0,
  class: "iv-sb-side"
}, Gs = {
  key: 1,
  class: "iv-sb-obj"
}, Ps = ["title"], As = ["title"], Ks = ["src", "alt", "title"], Ms = { class: "iv-sb-tot" }, js = ["onClick"], Fs = { class: "iv-sb-who" }, Ts = ["title"], Hs = { class: "iv-sb-art" }, Os = ["src"], Us = { class: "iv-sb-load" }, Ws = ["src", "alt", "title"], Ys = ["src", "title"], qs = { key: 1 }, Js = ["src", "title"], Qs = { class: "iv-sb-name" }, Xs = { class: "iv-sb-line" }, Zs = { key: 0 }, st = {
  key: 0,
  class: "iv-badge brand"
}, tt = { class: "iv-sb-line iv-sb-sub" }, et = ["title"], lt = ["title"], it = { class: "num iv-sb-kda" }, ot = ["title"], nt = { class: "iv-sb-bar" }, at = ["title"], dt = { class: "num" }, ct = ["title"], rt = { class: "iv-sb-items" }, ut = ["src"], mt = { class: "num iv-sb-score" }, _t = {
  key: 0,
  class: "iv-sb-perf"
}, bt = ["title"], ht = ["title"], vt = { key: 2 }, gt = {
  key: 1,
  class: "iv-pf-dim"
}, kt = { class: "iv-sb-more" }, pt = ["aria-expanded", "aria-controls", "aria-label", "onClick"], yt = {
  key: 0,
  class: "iv-sb-detail"
}, ft = ["id"], It = { class: "iv-sb-detail-in" }, Pt = /* @__PURE__ */ os({
  __name: "Scoreboard",
  props: {
    detail: {},
    puuid: {}
  },
  setup(y) {
    const _ = y, x = us(), { t: l } = x, { compact: $, kdaRatio: K, num: D, ordinal: E, pct: C, score100: M, signedGold: j } = ms(), { champIcon: S, champName: v, itemIcon: F, runeIcon: T, runeName: H, spellIcon: O, spellName: V, styleIcon: U, styleName: W } = _s(), R = I(() => _.detail.players.find((o) => o.puuid === _.puuid)), Y = I(() => bs(_.detail, R.value)), q = I(() => Math.max(1, ..._.detail.players.map((o) => o.damage))), J = I(() => _.detail.mapId === 11), Q = I(() => _.detail.players.some((o) => o.placement > 0));
    function X(o) {
      return [
        { id: "tower", label: l("Towers"), n: o.towers },
        { id: "dragon", label: l("Dragons"), n: o.dragons },
        { id: "baron", label: l("Barons"), n: o.barons },
        { id: "grubs", label: l("Voidgrubs"), n: o.grubs },
        { id: "herald", label: l("Rift Herald"), n: o.heralds },
        { id: "inhib", label: l("Inhibitors"), n: o.inhibitors }
      ].filter((r) => r.n !== null);
    }
    const Z = (o, d) => Q.value && d ? l("{place} place", { place: E(d) }) : _.detail.remake ? l("Remake") : o.win ? l("Victory") : l("Defeat"), z = (o) => A(o) === "blue" ? l("Blue side") : A(o) === "red" ? l("Red side") : "", L = (o) => o.bans.filter((d) => d > 0), ss = (o) => o >= 1e3 ? "iv-up" : o <= -1e3 ? "iv-down" : "", p = ns(null);
    as(() => _.detail, () => p.value = null);
    const G = (o) => p.value = p.value === o.participantId ? null : o.participantId, ts = (o, d) => {
      o.target.closest("a, button") || G(d);
    }, P = ds(), es = (o) => o.puuid && o.puuid !== _.puuid ? { kind: "player", puuid: o.puuid, gameName: o.gameName, tagLine: o.tagLine } : null;
    return (o, d) => (n(), a("div", ws, [
      e("table", Ns, [
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
            e("th", $s, i(t(l)("Player")), 1),
            e("th", Cs, i(t(l)("KDA")), 1),
            e("th", Bs, i(t(l)("Damage")), 1),
            e("th", xs, i(t(l)("Gold")), 1),
            e("th", Ds, i(t(l)("CS")), 1),
            e("th", Es, i(t(l)("Vision")), 1),
            e("th", null, i(t(l)("Items")), 1),
            e("th", {
              class: "num",
              title: t(l)("Invade score")
            }, i(t(l)("Score")), 9, Ss),
            d[4] || (d[4] = e("th", null, null, -1))
          ])
        ]),
        (n(!0), a(u, null, g(Y.value, ({ team: r, players: ls, placement: is }) => (n(), a("tbody", {
          key: r.teamId,
          class: k(r.win ? "won" : "lost")
        }, [
          e("tr", Vs, [
            e("td", Rs, [
              e("div", zs, [
                e("b", {
                  class: k(["iv-sb-res", y.detail.remake ? "" : r.win ? "win" : "loss"])
                }, i(Z(r, is)), 3),
                z(r.teamId) ? (n(), a("span", Ls, i(z(r.teamId)), 1)) : b("", !0),
                J.value ? (n(), a("span", Gs, [
                  (n(!0), a(u, null, g(X(r), (s) => (n(), a("span", {
                    key: s.id,
                    title: s.label,
                    class: k({ none: !s.n })
                  }, [
                    w(ys, {
                      name: s.id,
                      size: 14
                    }, null, 8, ["name"]),
                    m(i(s.n), 1)
                  ], 10, Ps))), 128))
                ])) : b("", !0),
                L(r).length ? (n(), a("span", {
                  key: 2,
                  class: "iv-sb-bans",
                  title: t(l)("Bans")
                }, [
                  (n(!0), a(u, null, g(L(r), (s, c) => (n(), a("img", {
                    key: c,
                    src: t(S)(s),
                    alt: t(v)(s),
                    title: t(l)("Banned: {champion}", { champion: t(v)(s) })
                  }, null, 8, Ks))), 128))
                ], 8, As)) : b("", !0),
                e("span", Ms, [
                  m(i(r.kills) + " / " + i(r.deaths) + " / " + i(r.assists) + " ", 1),
                  d[5] || (d[5] = e("span", { class: "iv-sb-dot" }, "·", -1)),
                  m(" " + i(t(l)("{gold} gold", { gold: t($)(r.gold) })), 1)
                ])
              ])
            ])
          ]),
          (n(!0), a(u, null, g(ls, (s) => (n(), a(u, {
            key: s.participantId
          }, [
            e("tr", {
              class: k(["iv-sb-row", { self: s.puuid === y.puuid, open: p.value === s.participantId }]),
              onClick: (c) => ts(c, s)
            }, [
              e("td", Fs, [
                e("span", {
                  class: "iv-sb-portrait",
                  title: t(v)(s.championId)
                }, [
                  e("span", Hs, [
                    e("img", {
                      src: t(S)(s.championId),
                      alt: ""
                    }, null, 8, Os)
                  ]),
                  e("em", null, i(s.level), 1)
                ], 8, Ts),
                e("span", Us, [
                  (n(!0), a(u, null, g(s.spells, (c, f) => (n(), a("img", {
                    key: f,
                    src: t(O)(c),
                    alt: t(V)(c),
                    title: t(V)(c),
                    onError: d[0] || (d[0] = //@ts-ignore
                    (...B) => t(h) && t(h)(...B))
                  }, null, 40, Ws))), 128)),
                  s.perks[0] ? (n(), a("img", {
                    key: 0,
                    src: t(T)(s.perks[0]),
                    title: t(H)(s.perks[0]),
                    alt: "",
                    class: "key",
                    onError: d[1] || (d[1] = //@ts-ignore
                    (...c) => t(h) && t(h)(...c))
                  }, null, 40, Ys)) : (n(), a("i", qs)),
                  s.styles[1] ? (n(), a("img", {
                    key: 2,
                    src: t(U)(s.styles[1]),
                    title: t(W)(s.styles[1]),
                    alt: "",
                    class: "sub",
                    onError: d[2] || (d[2] = //@ts-ignore
                    (...c) => t(h) && t(h)(...c))
                  }, null, 40, Js)) : b("", !0)
                ])
              ]),
              e("td", Qs, [
                e("span", Xs, [
                  w(ps, {
                    class: "iv-sb-link",
                    to: es(s),
                    title: t(hs)(s) || t(v)(s.championId)
                  }, {
                    default: cs(() => [
                      m(i(s.gameName || t(v)(s.championId)), 1),
                      s.tagLine ? (n(), a("small", Zs, "#" + i(s.tagLine), 1)) : b("", !0)
                    ]),
                    _: 2
                  }, 1032, ["to", "title"]),
                  s.puuid && s.puuid === t(x).viewer.value && s.puuid !== y.puuid ? (n(), a("span", st, i(t(l)("You")), 1)) : b("", !0)
                ]),
                e("span", tt, [
                  e("small", null, [
                    s.position ? (n(), a(u, { key: 0 }, [
                      m(i(t(vs)(s.position, t(l))), 1)
                    ], 64)) : (n(), a(u, { key: 1 }, [
                      m(i(t(v)(s.championId)), 1)
                    ], 64)),
                    s.gold15 !== null ? (n(), a(u, { key: 2 }, [
                      d[6] || (d[6] = m(" · ", -1)),
                      e("span", {
                        class: k(ss(s.gold15)),
                        title: t(l)("Gold lead over the lane opponent at 15 minutes")
                      }, i(t(l)("{gold} gold @15", { gold: t(j)(s.gold15) })), 11, et)
                    ], 64)) : b("", !0)
                  ]),
                  (n(!0), a(u, null, g(t(gs)(s.badges), (c) => (n(), a("span", {
                    key: c,
                    class: "iv-badge",
                    title: t(l)(t(N)[c].tip)
                  }, i(t(l)(t(N)[c].label)), 9, lt))), 128))
                ])
              ]),
              e("td", it, [
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
                e("i", nt, [
                  e("em", {
                    style: rs({ width: `${s.damage / q.value * 100}%` })
                  }, null, 4)
                ])
              ], 8, ot),
              e("td", {
                class: "num",
                title: t(l)("{share} of the team", { share: t(C)(s.goldShare) })
              }, [
                e("b", null, i(t($)(s.gold)), 1)
              ], 8, at),
              e("td", dt, [
                e("b", null, i(s.cs), 1),
                e("small", null, i(t(D)(s.csMin, 1)), 1)
              ]),
              e("td", {
                class: "num iv-sb-vis",
                title: t(l)("{placed} placed · {killed} destroyed · {control} control wards", { placed: s.wardsPlaced, killed: s.wardsKilled, control: s.controlWards })
              }, [
                e("b", null, i(s.vision), 1)
              ], 8, ct),
              e("td", null, [
                e("span", rt, [
                  (n(!0), a(u, null, g(s.items, (c, f) => (n(), a(u, { key: f }, [
                    c ? (n(), a("img", {
                      key: 0,
                      src: t(F)(c),
                      alt: "",
                      class: k({ trinket: f === 6 }),
                      onError: d[3] || (d[3] = //@ts-ignore
                      (...B) => t(h) && t(h)(...B))
                    }, null, 42, ut)) : (n(), a("i", {
                      key: 1,
                      class: k({ trinket: f === 6 })
                    }, null, 2))
                  ], 64))), 128))
                ])
              ]),
              e("td", mt, [
                s.score !== null ? (n(), a("span", _t, [
                  s.badges.includes("mvp") ? (n(), a("span", {
                    key: 0,
                    class: "iv-badge gold",
                    title: t(l)(t(N).mvp.tip)
                  }, i(t(l)("MVP")), 9, bt)) : s.badges.includes("ace") ? (n(), a("span", {
                    key: 1,
                    class: "iv-badge",
                    title: t(l)(t(N).ace.tip)
                  }, i(t(l)("ACE")), 9, ht)) : (n(), a("small", vt, i(t(E)(s.rank)), 1)),
                  w(fs, {
                    score: t(M)(s.score),
                    rank: s.rank,
                    size: "sm"
                  }, null, 8, ["score", "rank"])
                ])) : (n(), a("span", gt, "–"))
              ]),
              e("td", kt, [
                e("button", {
                  type: "button",
                  class: "iv-sb-toggle",
                  "aria-expanded": p.value === s.participantId,
                  "aria-controls": `${t(P)}-${s.participantId}`,
                  "aria-label": t(l)("Details of {name}", { name: s.gameName || t(v)(s.championId) }),
                  onClick: (c) => G(s)
                }, [
                  w(ks, {
                    name: "down",
                    size: 14
                  })
                ], 8, pt)
              ])
            ], 10, js),
            p.value === s.participantId ? (n(), a("tr", yt, [
              e("td", {
                id: `${t(P)}-${s.participantId}`,
                colspan: "10"
              }, [
                e("div", It, [
                  w(Is, {
                    detail: y.detail,
                    player: s,
                    me: R.value
                  }, null, 8, ["detail", "player", "me"])
                ])
              ], 8, ft)
            ])) : b("", !0)
          ], 64))), 128))
        ], 2))), 128))
      ])
    ]));
  }
});
export {
  Pt as default
};
