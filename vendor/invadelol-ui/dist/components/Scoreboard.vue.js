import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
import { defineComponent as os, computed as w, shallowRef as ns, watch as as, useId as ds, openBlock as n, createElementBlock as a, createElementVNode as e, toDisplayString as i, unref as s, Fragment as u, renderList as v, normalizeClass as g, createCommentVNode as k, createVNode as I, createTextVNode as m, withCtx as cs, normalizeStyle as rs } from "vue";
import { useInvadeUi as us, useFormat as ms, useNames as _s } from "../context.js";
import { hideBroken as b } from "../dom.js";
import { teamsOf as bs, riotId as hs, side as K } from "../logic/detail.js";
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
}, Gs = { class: "iv-sb-obj" }, Ps = ["title"], As = ["title"], Ks = ["src", "alt", "title"], Ms = { class: "iv-sb-tot" }, js = ["onClick"], Fs = { class: "iv-sb-who" }, Ts = ["title"], Hs = { class: "iv-sb-art" }, Os = ["src"], Us = { class: "iv-sb-load" }, Ws = ["src", "alt", "title"], Ys = ["src", "title"], qs = { key: 1 }, Js = ["src", "title"], Qs = { class: "iv-sb-name" }, Xs = { class: "iv-sb-line" }, Zs = { key: 0 }, st = {
  key: 0,
  class: "iv-badge brand"
}, tt = { class: "iv-sb-line iv-sb-sub" }, et = ["title"], lt = ["title"], it = { class: "num iv-sb-kda" }, ot = ["title"], nt = { class: "iv-sb-bar" }, at = ["title"], dt = { class: "num" }, ct = ["title"], rt = { class: "iv-sb-items" }, ut = ["src", "alt", "title"], mt = { class: "num iv-sb-score" }, _t = {
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
    const _ = y, x = us(), { t: l } = x, { compact: $, kdaRatio: M, num: D, ordinal: E, pct: C, score100: j, signedGold: F } = ms(), { champIcon: S, champName: h, itemIcon: T, itemName: V, runeIcon: H, runeName: O, spellIcon: U, spellName: R, styleIcon: W, styleName: Y } = _s(), z = w(() => _.detail.players.find((o) => o.puuid === _.puuid)), q = w(() => bs(_.detail, z.value)), J = w(() => Math.max(1, ..._.detail.players.map((o) => o.damage))), Q = w(() => _.detail.players.some((o) => o.placement > 0));
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
    const Z = (o, d) => Q.value && d ? l("{place} place", { place: E(d) }) : _.detail.remake ? l("Remake") : o.win ? l("Victory") : l("Defeat"), L = (o) => K(o) === "blue" ? l("Blue side") : K(o) === "red" ? l("Red side") : "", G = (o) => o.bans.filter((d) => d > 0), ss = (o) => o >= 1e3 ? "iv-up" : o <= -1e3 ? "iv-down" : "", p = ns(null);
    as(() => _.detail, () => p.value = null);
    const P = (o) => p.value = p.value === o.participantId ? null : o.participantId, ts = (o, d) => {
      o.target.closest("a, button") || P(d);
    }, A = ds(), es = (o) => o.puuid && o.puuid !== _.puuid ? { kind: "player", puuid: o.puuid, gameName: o.gameName, tagLine: o.tagLine } : null;
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
            e("th", $s, i(s(l)("Player")), 1),
            e("th", Cs, i(s(l)("KDA")), 1),
            e("th", Bs, i(s(l)("Damage")), 1),
            e("th", xs, i(s(l)("Gold")), 1),
            e("th", Ds, i(s(l)("CS")), 1),
            e("th", Es, i(s(l)("Vision")), 1),
            e("th", null, i(s(l)("Items")), 1),
            e("th", {
              class: "num",
              title: s(l)("Invade score")
            }, i(s(l)("Score")), 9, Ss),
            d[4] || (d[4] = e("th", null, null, -1))
          ])
        ]),
        (n(!0), a(u, null, v(q.value, ({ team: r, players: ls, placement: is }) => (n(), a("tbody", {
          key: r.teamId,
          class: g(r.win ? "won" : "lost")
        }, [
          e("tr", Vs, [
            e("td", Rs, [
              e("div", zs, [
                e("b", {
                  class: g(["iv-sb-res", y.detail.remake ? "" : r.win ? "win" : "loss"])
                }, i(Z(r, is)), 3),
                L(r.teamId) ? (n(), a("span", Ls, i(L(r.teamId)), 1)) : k("", !0),
                e("span", Gs, [
                  (n(!0), a(u, null, v(X(r), (t) => (n(), a("span", {
                    key: t.id,
                    title: t.label,
                    class: g({ none: !t.n })
                  }, [
                    I(ys, {
                      name: t.id,
                      size: 14
                    }, null, 8, ["name"]),
                    m(i(t.n), 1)
                  ], 10, Ps))), 128))
                ]),
                G(r).length ? (n(), a("span", {
                  key: 1,
                  class: "iv-sb-bans",
                  title: s(l)("Bans")
                }, [
                  (n(!0), a(u, null, v(G(r), (t, c) => (n(), a("img", {
                    key: c,
                    src: s(S)(t),
                    alt: s(h)(t),
                    title: s(l)("Banned: {champion}", { champion: s(h)(t) })
                  }, null, 8, Ks))), 128))
                ], 8, As)) : k("", !0),
                e("span", Ms, [
                  m(i(r.kills) + " / " + i(r.deaths) + " / " + i(r.assists) + " ", 1),
                  d[5] || (d[5] = e("span", { class: "iv-sb-dot" }, "·", -1)),
                  m(" " + i(s(l)("{gold} gold", { gold: s($)(r.gold) })), 1)
                ])
              ])
            ])
          ]),
          (n(!0), a(u, null, v(ls, (t) => (n(), a(u, {
            key: t.participantId
          }, [
            e("tr", {
              class: g(["iv-sb-row", { self: t.puuid === y.puuid, open: p.value === t.participantId }]),
              onClick: (c) => ts(c, t)
            }, [
              e("td", Fs, [
                e("span", {
                  class: "iv-sb-portrait",
                  title: s(h)(t.championId)
                }, [
                  e("span", Hs, [
                    e("img", {
                      src: s(S)(t.championId),
                      alt: ""
                    }, null, 8, Os)
                  ]),
                  e("em", null, i(t.level), 1)
                ], 8, Ts),
                e("span", Us, [
                  (n(!0), a(u, null, v(t.spells, (c, f) => (n(), a("img", {
                    key: f,
                    src: s(U)(c),
                    alt: s(R)(c),
                    title: s(R)(c),
                    onError: d[0] || (d[0] = //@ts-ignore
                    (...B) => s(b) && s(b)(...B))
                  }, null, 40, Ws))), 128)),
                  t.perks[0] ? (n(), a("img", {
                    key: 0,
                    src: s(H)(t.perks[0]),
                    title: s(O)(t.perks[0]),
                    alt: "",
                    class: "key",
                    onError: d[1] || (d[1] = //@ts-ignore
                    (...c) => s(b) && s(b)(...c))
                  }, null, 40, Ys)) : (n(), a("i", qs)),
                  t.styles[1] ? (n(), a("img", {
                    key: 2,
                    src: s(W)(t.styles[1]),
                    title: s(Y)(t.styles[1]),
                    alt: "",
                    class: "sub",
                    onError: d[2] || (d[2] = //@ts-ignore
                    (...c) => s(b) && s(b)(...c))
                  }, null, 40, Js)) : k("", !0)
                ])
              ]),
              e("td", Qs, [
                e("span", Xs, [
                  I(ps, {
                    class: "iv-sb-link",
                    to: es(t),
                    title: s(hs)(t) || s(h)(t.championId)
                  }, {
                    default: cs(() => [
                      m(i(t.gameName || s(h)(t.championId)), 1),
                      t.tagLine ? (n(), a("small", Zs, "#" + i(t.tagLine), 1)) : k("", !0)
                    ]),
                    _: 2
                  }, 1032, ["to", "title"]),
                  t.puuid && t.puuid === s(x).viewer.value && t.puuid !== y.puuid ? (n(), a("span", st, i(s(l)("You")), 1)) : k("", !0)
                ]),
                e("span", tt, [
                  e("small", null, [
                    t.position ? (n(), a(u, { key: 0 }, [
                      m(i(s(vs)(t.position, s(l))), 1)
                    ], 64)) : (n(), a(u, { key: 1 }, [
                      m(i(s(h)(t.championId)), 1)
                    ], 64)),
                    t.gold15 !== null ? (n(), a(u, { key: 2 }, [
                      d[6] || (d[6] = m(" · ", -1)),
                      e("span", {
                        class: g(ss(t.gold15)),
                        title: s(l)("Gold lead over the lane opponent at 15 minutes")
                      }, i(s(l)("{gold} gold @15", { gold: s(F)(t.gold15) })), 11, et)
                    ], 64)) : k("", !0)
                  ]),
                  (n(!0), a(u, null, v(s(gs)(t.badges), (c) => (n(), a("span", {
                    key: c,
                    class: "iv-badge",
                    title: s(l)(s(N)[c].tip)
                  }, i(s(l)(s(N)[c].label)), 9, lt))), 128))
                ])
              ]),
              e("td", it, [
                e("b", null, [
                  m(i(t.kills), 1),
                  d[7] || (d[7] = e("i", null, "/", -1)),
                  m(i(t.deaths), 1),
                  d[8] || (d[8] = e("i", null, "/", -1)),
                  m(i(t.assists), 1)
                ]),
                e("small", null, i(s(M)(t.kills, t.deaths, t.assists)) + " · " + i(s(C)(t.kp)) + " " + i(s(l)("KP")), 1)
              ]),
              e("td", {
                class: "num iv-sb-dmg",
                title: `${s(D)(t.damage)} · ${s(l)("{share} of the team", { share: s(C)(t.damageShare) })}`
              }, [
                e("b", null, i(s($)(t.damage)), 1),
                e("i", nt, [
                  e("em", {
                    style: rs({ width: `${t.damage / J.value * 100}%` })
                  }, null, 4)
                ])
              ], 8, ot),
              e("td", {
                class: "num",
                title: s(l)("{share} of the team", { share: s(C)(t.goldShare) })
              }, [
                e("b", null, i(s($)(t.gold)), 1)
              ], 8, at),
              e("td", dt, [
                e("b", null, i(t.cs), 1),
                e("small", null, i(s(D)(t.csMin, 1)), 1)
              ]),
              e("td", {
                class: "num iv-sb-vis",
                title: s(l)("{placed} placed · {killed} destroyed · {control} control wards", { placed: t.wardsPlaced, killed: t.wardsKilled, control: t.controlWards })
              }, [
                e("b", null, i(t.vision), 1)
              ], 8, ct),
              e("td", null, [
                e("span", rt, [
                  (n(!0), a(u, null, v(t.items, (c, f) => (n(), a(u, { key: f }, [
                    c ? (n(), a("img", {
                      key: 0,
                      src: s(T)(c),
                      alt: s(V)(c),
                      title: s(V)(c),
                      class: g({ trinket: f === 6 }),
                      onError: d[3] || (d[3] = //@ts-ignore
                      (...B) => s(b) && s(b)(...B))
                    }, null, 42, ut)) : (n(), a("i", {
                      key: 1,
                      class: g({ trinket: f === 6 })
                    }, null, 2))
                  ], 64))), 128))
                ])
              ]),
              e("td", mt, [
                t.score !== null ? (n(), a("span", _t, [
                  t.badges.includes("mvp") ? (n(), a("span", {
                    key: 0,
                    class: "iv-badge gold",
                    title: s(l)(s(N).mvp.tip)
                  }, i(s(l)("MVP")), 9, bt)) : t.badges.includes("ace") ? (n(), a("span", {
                    key: 1,
                    class: "iv-badge",
                    title: s(l)(s(N).ace.tip)
                  }, i(s(l)("ACE")), 9, ht)) : (n(), a("small", vt, i(s(E)(t.rank)), 1)),
                  I(fs, {
                    score: s(j)(t.score),
                    rank: t.rank,
                    size: "sm"
                  }, null, 8, ["score", "rank"])
                ])) : (n(), a("span", gt, "–"))
              ]),
              e("td", kt, [
                e("button", {
                  type: "button",
                  class: "iv-sb-toggle",
                  "aria-expanded": p.value === t.participantId,
                  "aria-controls": `${s(A)}-${t.participantId}`,
                  "aria-label": s(l)("Details of {name}", { name: t.gameName || s(h)(t.championId) }),
                  onClick: (c) => P(t)
                }, [
                  I(ks, {
                    name: "down",
                    size: 14
                  })
                ], 8, pt)
              ])
            ], 10, js),
            p.value === t.participantId ? (n(), a("tr", yt, [
              e("td", {
                id: `${s(A)}-${t.participantId}`,
                colspan: "10"
              }, [
                e("div", It, [
                  I(Is, {
                    detail: y.detail,
                    player: t,
                    me: z.value
                  }, null, 8, ["detail", "player", "me"])
                ])
              ], 8, ft)
            ])) : k("", !0)
          ], 64))), 128))
        ], 2))), 128))
      ])
    ]));
  }
});
export {
  Pt as default
};
