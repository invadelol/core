import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
import { defineComponent as cs, computed as p, shallowRef as rs, watch as us, useId as ms, openBlock as n, createElementBlock as o, createElementVNode as e, toDisplayString as a, unref as t, Fragment as u, renderList as v, normalizeClass as g, createCommentVNode as k, createVNode as N, createTextVNode as m, withCtx as _s, normalizeStyle as K } from "vue";
import { useInvadeUi as hs, useFormat as bs, useNames as vs } from "../context.js";
import { hideBroken as h } from "../dom.js";
import { teamsOf as gs, riotId as ks, side as A } from "../logic/detail.js";
import { positionName as ys, topBadges as ps, BADGES as C } from "../logic/labels.js";
import fs from "./Icon.vue.js";
import ws from "./Link.vue.js";
import Is from "./ObjectiveIcon.vue.js";
import $s from "./PerfDial.vue.js";
/* empty css              */
import Ns from "./PlayerDetail.vue.js";
/* empty css                 */
/* empty css                       */
/* empty css                   */
const xs = { class: "iv-sb-wrap" }, Cs = { class: "iv-table iv-sb" }, Bs = { colspan: "2" }, Ds = { class: "num" }, Ss = { class: "num" }, Ts = { class: "num iv-sb-taken" }, Es = { class: "num" }, Vs = { class: "num" }, Ms = { class: "num iv-sb-vis" }, Rs = ["title"], zs = { class: "iv-sb-team" }, Gs = { colspan: "11" }, Ls = { class: "iv-sb-team-line" }, Ps = {
  key: 0,
  class: "iv-sb-side"
}, Ks = { class: "iv-sb-obj" }, As = ["title"], js = ["title"], Fs = ["src", "alt", "title"], Hs = { class: "iv-sb-tot" }, Os = ["onClick"], Us = { class: "iv-sb-who" }, Ws = ["title"], Ys = { class: "iv-sb-art" }, qs = ["src"], Js = { class: "iv-sb-load" }, Qs = ["src", "alt", "title"], Xs = ["src", "title"], Zs = { key: 1 }, st = ["src", "title"], tt = { class: "iv-sb-name" }, et = { class: "iv-sb-line" }, lt = { key: 0 }, at = {
  key: 0,
  class: "iv-badge brand"
}, it = { class: "iv-sb-line iv-sb-sub" }, nt = ["title"], ot = ["title"], dt = { class: "num iv-sb-kda" }, ct = ["title"], rt = { class: "iv-sb-share" }, ut = { class: "iv-sb-bar" }, mt = ["title"], _t = { class: "iv-sb-bar taken" }, ht = ["title"], bt = { class: "num" }, vt = ["title"], gt = { class: "iv-sb-items" }, kt = ["src", "alt", "title"], yt = { class: "num iv-sb-score" }, pt = {
  key: 0,
  class: "iv-sb-perf"
}, ft = ["title"], wt = ["title"], It = { key: 2 }, $t = {
  key: 1,
  class: "iv-pf-dim"
}, Nt = { class: "iv-sb-more" }, xt = ["aria-expanded", "aria-controls", "aria-label", "onClick"], Ct = {
  key: 0,
  class: "iv-sb-detail"
}, Bt = ["id"], Dt = { class: "iv-sb-detail-in" }, Ht = /* @__PURE__ */ cs({
  __name: "Scoreboard",
  props: {
    detail: {},
    puuid: {}
  },
  setup(f) {
    const _ = f, D = hs(), { t: i } = D, { compact: x, kdaRatio: j, num: w, ordinal: S, pct: I, score100: F, signedGold: H } = bs(), { champIcon: T, champName: b, itemIcon: O, itemName: E, runeIcon: U, runeName: W, spellIcon: Y, spellName: V, styleIcon: q, styleName: J } = vs(), M = p(() => _.detail.players.find((l) => l.puuid === _.puuid)), Q = p(() => gs(_.detail, M.value)), X = p(() => Math.max(1, ..._.detail.players.map((l) => l.damage))), Z = p(() => Math.max(1, ..._.detail.players.map((l) => l.damageTaken))), R = p(() => Math.max(1, _.detail.duration / 60)), ss = (l) => {
      const d = (r) => I(r / Math.max(1, l.damage));
      return `${w(l.damage)} · ${i("{share} of the team", { share: I(l.damageShare) })} · ${i("{physical} physical · {magic} magic · {true} true", { physical: d(l.physical), magic: d(l.magic), true: d(l.trueDamage) })}`;
    }, ts = p(() => _.detail.players.some((l) => l.placement > 0));
    function es(l) {
      return [
        { id: "tower", label: i("Towers"), n: l.towers },
        { id: "dragon", label: i("Dragons"), n: l.dragons },
        { id: "baron", label: i("Barons"), n: l.barons },
        { id: "grubs", label: i("Voidgrubs"), n: l.grubs },
        { id: "herald", label: i("Rift Herald"), n: l.heralds },
        { id: "inhib", label: i("Inhibitors"), n: l.inhibitors }
      ].filter((r) => r.n !== null);
    }
    const ls = (l, d) => ts.value && d ? i("{place} place", { place: S(d) }) : _.detail.remake ? i("Remake") : l.win ? i("Victory") : i("Defeat"), z = (l) => A(l) === "blue" ? i("Blue side") : A(l) === "red" ? i("Red side") : "", G = (l) => l.bans.filter((d) => d > 0), as = (l) => l >= 1e3 ? "iv-up" : l <= -1e3 ? "iv-down" : "", y = rs(null);
    us(() => _.detail, () => y.value = null);
    const L = (l) => y.value = y.value === l.participantId ? null : l.participantId, is = (l, d) => {
      l.target.closest("a, button") || L(d);
    }, P = ms(), ns = (l) => l.puuid && l.puuid !== _.puuid ? { kind: "player", puuid: l.puuid, gameName: l.gameName, tagLine: l.tagLine } : null;
    return (l, d) => (n(), o("div", xs, [
      e("table", Cs, [
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
            e("th", Bs, a(t(i)("Player")), 1),
            e("th", Ds, a(t(i)("KDA")), 1),
            e("th", Ss, a(t(i)("Damage")), 1),
            e("th", Ts, a(t(i)("Taken")), 1),
            e("th", Es, a(t(i)("Gold")), 1),
            e("th", Vs, a(t(i)("CS")), 1),
            e("th", Ms, a(t(i)("Vision")), 1),
            e("th", null, a(t(i)("Items")), 1),
            e("th", {
              class: "num",
              title: t(i)("Invade score")
            }, a(t(i)("Score")), 9, Rs),
            d[4] || (d[4] = e("th", null, null, -1))
          ])
        ]),
        (n(!0), o(u, null, v(Q.value, ({ team: r, players: os, placement: ds }) => (n(), o("tbody", {
          key: r.teamId,
          class: g(r.win ? "won" : "lost")
        }, [
          e("tr", zs, [
            e("td", Gs, [
              e("div", Ls, [
                e("b", {
                  class: g(["iv-sb-res", f.detail.remake ? "" : r.win ? "win" : "loss"])
                }, a(ls(r, ds)), 3),
                z(r.teamId) ? (n(), o("span", Ps, a(z(r.teamId)), 1)) : k("", !0),
                e("span", Ks, [
                  (n(!0), o(u, null, v(es(r), (s) => (n(), o("span", {
                    key: s.id,
                    title: s.label,
                    class: g({ none: !s.n })
                  }, [
                    N(Is, {
                      name: s.id,
                      size: 14
                    }, null, 8, ["name"]),
                    m(a(s.n), 1)
                  ], 10, As))), 128))
                ]),
                G(r).length ? (n(), o("span", {
                  key: 1,
                  class: "iv-sb-bans",
                  title: t(i)("Bans")
                }, [
                  (n(!0), o(u, null, v(G(r), (s, c) => (n(), o("img", {
                    key: c,
                    src: t(T)(s),
                    alt: t(b)(s),
                    title: t(i)("Banned: {champion}", { champion: t(b)(s) })
                  }, null, 8, Fs))), 128))
                ], 8, js)) : k("", !0),
                e("span", Hs, [
                  m(a(r.kills) + " / " + a(r.deaths) + " / " + a(r.assists) + " ", 1),
                  d[5] || (d[5] = e("span", { class: "iv-sb-dot" }, "·", -1)),
                  m(" " + a(t(i)("{gold} gold", { gold: t(x)(r.gold) })), 1)
                ])
              ])
            ])
          ]),
          (n(!0), o(u, null, v(os, (s) => (n(), o(u, {
            key: s.participantId
          }, [
            e("tr", {
              class: g(["iv-sb-row", { self: s.puuid === f.puuid, open: y.value === s.participantId }]),
              onClick: (c) => is(c, s)
            }, [
              e("td", Us, [
                e("span", {
                  class: "iv-sb-portrait",
                  title: t(b)(s.championId)
                }, [
                  e("span", Ys, [
                    e("img", {
                      src: t(T)(s.championId),
                      alt: ""
                    }, null, 8, qs)
                  ]),
                  e("em", null, a(s.level), 1)
                ], 8, Ws),
                e("span", Js, [
                  (n(!0), o(u, null, v(s.spells, (c, $) => (n(), o("img", {
                    key: $,
                    src: t(Y)(c),
                    alt: t(V)(c),
                    title: t(V)(c),
                    onError: d[0] || (d[0] = //@ts-ignore
                    (...B) => t(h) && t(h)(...B))
                  }, null, 40, Qs))), 128)),
                  s.perks[0] ? (n(), o("img", {
                    key: 0,
                    src: t(U)(s.perks[0]),
                    title: t(W)(s.perks[0]),
                    alt: "",
                    class: "key",
                    onError: d[1] || (d[1] = //@ts-ignore
                    (...c) => t(h) && t(h)(...c))
                  }, null, 40, Xs)) : (n(), o("i", Zs)),
                  s.styles[1] ? (n(), o("img", {
                    key: 2,
                    src: t(q)(s.styles[1]),
                    title: t(J)(s.styles[1]),
                    alt: "",
                    class: "sub",
                    onError: d[2] || (d[2] = //@ts-ignore
                    (...c) => t(h) && t(h)(...c))
                  }, null, 40, st)) : k("", !0)
                ])
              ]),
              e("td", tt, [
                e("span", et, [
                  N(ws, {
                    class: "iv-sb-link",
                    to: ns(s),
                    title: t(ks)(s) || t(b)(s.championId)
                  }, {
                    default: _s(() => [
                      m(a(s.gameName || t(b)(s.championId)), 1),
                      s.tagLine ? (n(), o("small", lt, "#" + a(s.tagLine), 1)) : k("", !0)
                    ]),
                    _: 2
                  }, 1032, ["to", "title"]),
                  s.puuid && s.puuid === t(D).viewer.value && s.puuid !== f.puuid ? (n(), o("span", at, a(t(i)("You")), 1)) : k("", !0)
                ]),
                e("span", it, [
                  e("small", null, [
                    s.position ? (n(), o(u, { key: 0 }, [
                      m(a(t(ys)(s.position, t(i))), 1)
                    ], 64)) : (n(), o(u, { key: 1 }, [
                      m(a(t(b)(s.championId)), 1)
                    ], 64)),
                    s.gold15 !== null ? (n(), o(u, { key: 2 }, [
                      d[6] || (d[6] = m(" · ", -1)),
                      e("span", {
                        class: g(as(s.gold15)),
                        title: t(i)("Gold lead over the lane opponent at 15 minutes")
                      }, a(t(i)("{gold} gold @15", { gold: t(H)(s.gold15) })), 11, nt)
                    ], 64)) : k("", !0)
                  ]),
                  (n(!0), o(u, null, v(t(ps)(s.badges), (c) => (n(), o("span", {
                    key: c,
                    class: "iv-badge",
                    title: t(i)(t(C)[c].tip)
                  }, a(t(i)(t(C)[c].label)), 9, ot))), 128))
                ])
              ]),
              e("td", dt, [
                e("b", null, [
                  m(a(s.kills), 1),
                  d[7] || (d[7] = e("i", null, "/", -1)),
                  m(a(s.deaths), 1),
                  d[8] || (d[8] = e("i", null, "/", -1)),
                  m(a(s.assists), 1)
                ]),
                e("small", null, a(t(j)(s.kills, s.deaths, s.assists)) + " · " + a(t(I)(s.kp)) + " " + a(t(i)("KP")), 1)
              ]),
              e("td", {
                class: "num iv-sb-dmg",
                title: ss(s)
              }, [
                e("b", null, [
                  e("small", rt, a(t(I)(s.damageShare)), 1),
                  m(a(t(x)(s.damage)), 1)
                ]),
                e("i", ut, [
                  e("em", {
                    style: K({ width: `${s.damage / X.value * 100}%` })
                  }, null, 4)
                ])
              ], 8, ct),
              e("td", {
                class: "num iv-sb-dmg iv-sb-taken",
                title: t(w)(s.damageTaken)
              }, [
                e("b", null, a(t(x)(s.damageTaken)), 1),
                e("i", _t, [
                  e("em", {
                    style: K({ width: `${s.damageTaken / Z.value * 100}%` })
                  }, null, 4)
                ])
              ], 8, mt),
              e("td", {
                class: "num",
                title: `${t(i)("{share} of the team", { share: t(I)(s.goldShare) })} · ${t(i)("Gold per minute")}: ${t(w)(s.gold / R.value)}`
              }, [
                e("b", null, a(t(x)(s.gold)), 1),
                e("small", null, a(t(w)(s.gold / R.value)), 1)
              ], 8, ht),
              e("td", bt, [
                e("b", null, a(s.cs), 1),
                e("small", null, a(t(w)(s.csMin, 1)), 1)
              ]),
              e("td", {
                class: "num iv-sb-vis",
                title: t(i)("{placed} placed · {killed} destroyed · {control} control wards", { placed: s.wardsPlaced, killed: s.wardsKilled, control: s.controlWards })
              }, [
                e("b", null, a(s.vision), 1),
                e("small", null, a(s.wardsPlaced) + " / " + a(s.wardsKilled), 1)
              ], 8, vt),
              e("td", null, [
                e("span", gt, [
                  (n(!0), o(u, null, v(s.items, (c, $) => (n(), o(u, { key: $ }, [
                    c ? (n(), o("img", {
                      key: 0,
                      src: t(O)(c),
                      alt: t(E)(c),
                      title: t(E)(c),
                      class: g({ trinket: $ === 6 }),
                      onError: d[3] || (d[3] = //@ts-ignore
                      (...B) => t(h) && t(h)(...B))
                    }, null, 42, kt)) : (n(), o("i", {
                      key: 1,
                      class: g({ trinket: $ === 6 })
                    }, null, 2))
                  ], 64))), 128))
                ])
              ]),
              e("td", yt, [
                s.score !== null ? (n(), o("span", pt, [
                  s.badges.includes("mvp") ? (n(), o("span", {
                    key: 0,
                    class: "iv-badge gold",
                    title: t(i)(t(C).mvp.tip)
                  }, a(t(i)("MVP")), 9, ft)) : s.badges.includes("ace") ? (n(), o("span", {
                    key: 1,
                    class: "iv-badge",
                    title: t(i)(t(C).ace.tip)
                  }, a(t(i)("ACE")), 9, wt)) : (n(), o("small", It, a(t(S)(s.rank)), 1)),
                  N($s, {
                    score: t(F)(s.score),
                    rank: s.rank,
                    size: "sm"
                  }, null, 8, ["score", "rank"])
                ])) : (n(), o("span", $t, "–"))
              ]),
              e("td", Nt, [
                e("button", {
                  type: "button",
                  class: "iv-sb-toggle",
                  "aria-expanded": y.value === s.participantId,
                  "aria-controls": `${t(P)}-${s.participantId}`,
                  "aria-label": t(i)("Details of {name}", { name: s.gameName || t(b)(s.championId) }),
                  onClick: (c) => L(s)
                }, [
                  N(fs, {
                    name: "down",
                    size: 14
                  })
                ], 8, xt)
              ])
            ], 10, Os),
            y.value === s.participantId ? (n(), o("tr", Ct, [
              e("td", {
                id: `${t(P)}-${s.participantId}`,
                colspan: "11"
              }, [
                e("div", Dt, [
                  N(Ns, {
                    detail: f.detail,
                    player: s,
                    me: M.value
                  }, null, 8, ["detail", "player", "me"])
                ])
              ], 8, Bt)
            ])) : k("", !0)
          ], 64))), 128))
        ], 2))), 128))
      ])
    ]));
  }
});
export {
  Ht as default
};
