import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/detail.css';
import { defineComponent as cs, computed as p, shallowRef as rs, watch as us, useId as ms, openBlock as n, createElementBlock as o, createElementVNode as e, toDisplayString as i, unref as s, Fragment as u, renderList as v, normalizeClass as g, createCommentVNode as k, createVNode as N, createTextVNode as m, withCtx as _s, normalizeStyle as K } from "vue";
import { useInvadeUi as bs, useFormat as hs, useNames as vs } from "../context.js";
import { hideBroken as b } from "../dom.js";
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
const xs = { class: "iv-sb-wrap" }, Cs = { class: "iv-table iv-sb" }, Ss = { colspan: "2" }, Bs = { class: "num" }, Ds = { class: "num" }, Ts = { class: "num iv-sb-taken" }, Es = { class: "num" }, Vs = { class: "num" }, Ms = { class: "num iv-sb-vis" }, Rs = ["title"], zs = { class: "iv-sb-team" }, Gs = { colspan: "11" }, Ls = { class: "iv-sb-team-line" }, Ps = {
  key: 0,
  class: "iv-sb-side"
}, Ks = { class: "iv-sb-obj" }, As = ["title"], js = ["title"], Fs = ["src", "alt", "title"], Hs = { class: "iv-sb-tot" }, Os = ["onClick"], Us = { class: "iv-sb-who" }, Ws = ["title"], Ys = { class: "iv-sb-art" }, qs = ["src"], Js = { class: "iv-sb-load" }, Qs = ["src", "alt", "title"], Xs = ["src", "title"], Zs = { key: 1 }, st = ["src", "title"], tt = { class: "iv-sb-name" }, et = { class: "iv-sb-line" }, lt = { key: 0 }, at = {
  key: 0,
  class: "iv-badge brand"
}, it = { class: "iv-sb-line iv-sb-sub" }, nt = ["title"], ot = ["title"], dt = { class: "num iv-sb-kda" }, ct = ["title", "data-l"], rt = { class: "iv-sb-share" }, ut = { class: "iv-sb-bar" }, mt = ["title"], _t = { class: "iv-sb-bar taken" }, bt = ["title", "data-l"], ht = ["data-l"], vt = ["title"], gt = { class: "iv-sb-itd" }, kt = { class: "iv-sb-items" }, yt = ["src", "alt", "title"], pt = { class: "num iv-sb-score" }, ft = {
  key: 0,
  class: "iv-sb-perf"
}, wt = ["title"], It = ["title"], $t = { key: 2 }, Nt = {
  key: 1,
  class: "iv-pf-dim"
}, xt = { class: "iv-sb-more" }, Ct = ["aria-expanded", "aria-controls", "aria-label", "onClick"], St = {
  key: 0,
  class: "iv-sb-detail"
}, Bt = ["id"], Dt = { class: "iv-sb-detail-in" }, Ot = /* @__PURE__ */ cs({
  __name: "Scoreboard",
  props: {
    detail: {},
    puuid: {}
  },
  setup(f) {
    const _ = f, B = bs(), { t: l } = B, { compact: x, kdaRatio: j, num: w, ordinal: D, pct: I, score100: F, signedGold: H } = hs(), { champIcon: T, champName: h, itemIcon: O, itemName: E, runeIcon: U, runeName: W, spellIcon: Y, spellName: V, styleIcon: q, styleName: J } = vs(), M = p(() => _.detail.players.find((a) => a.puuid === _.puuid)), Q = p(() => gs(_.detail, M.value)), X = p(() => Math.max(1, ..._.detail.players.map((a) => a.damage))), Z = p(() => Math.max(1, ..._.detail.players.map((a) => a.damageTaken))), R = p(() => Math.max(1, _.detail.duration / 60)), ss = (a) => {
      const d = (r) => I(r / Math.max(1, a.damage));
      return `${w(a.damage)} · ${l("{share} of the team", { share: I(a.damageShare) })} · ${l("{physical} physical · {magic} magic · {true} true", { physical: d(a.physical), magic: d(a.magic), true: d(a.trueDamage) })}`;
    }, ts = p(() => _.detail.players.some((a) => a.placement > 0));
    function es(a) {
      return [
        { id: "tower", label: l("Towers"), n: a.towers },
        { id: "dragon", label: l("Dragons"), n: a.dragons },
        { id: "baron", label: l("Barons"), n: a.barons },
        { id: "grubs", label: l("Voidgrubs"), n: a.grubs },
        { id: "herald", label: l("Rift Herald"), n: a.heralds },
        { id: "inhib", label: l("Inhibitors"), n: a.inhibitors }
      ].filter((r) => r.n !== null);
    }
    const ls = (a, d) => ts.value && d ? l("{place} place", { place: D(d) }) : _.detail.remake ? l("Remake") : a.win ? l("Victory") : l("Defeat"), z = (a) => A(a) === "blue" ? l("Blue side") : A(a) === "red" ? l("Red side") : "", G = (a) => a.bans.filter((d) => d > 0), as = (a) => a >= 1e3 ? "iv-up" : a <= -1e3 ? "iv-down" : "", y = rs(null);
    us(() => _.detail, () => y.value = null);
    const L = (a) => y.value = y.value === a.participantId ? null : a.participantId, is = (a, d) => {
      a.target.closest("a, button") || L(d);
    }, P = ms(), ns = (a) => a.puuid && a.puuid !== _.puuid ? { kind: "player", puuid: a.puuid, gameName: a.gameName, tagLine: a.tagLine } : null;
    return (a, d) => (n(), o("div", xs, [
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
            e("th", Ss, i(s(l)("Player")), 1),
            e("th", Bs, i(s(l)("KDA")), 1),
            e("th", Ds, i(s(l)("Damage")), 1),
            e("th", Ts, i(s(l)("Taken")), 1),
            e("th", Es, i(s(l)("Gold")), 1),
            e("th", Vs, i(s(l)("CS")), 1),
            e("th", Ms, i(s(l)("Vision")), 1),
            e("th", null, i(s(l)("Items")), 1),
            e("th", {
              class: "num",
              title: s(l)("Invade score")
            }, i(s(l)("Score")), 9, Rs),
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
                }, i(ls(r, ds)), 3),
                z(r.teamId) ? (n(), o("span", Ps, i(z(r.teamId)), 1)) : k("", !0),
                e("span", Ks, [
                  (n(!0), o(u, null, v(es(r), (t) => (n(), o("span", {
                    key: t.id,
                    title: t.label,
                    class: g({ none: !t.n })
                  }, [
                    N(Is, {
                      name: t.id,
                      size: 14
                    }, null, 8, ["name"]),
                    m(i(t.n), 1)
                  ], 10, As))), 128))
                ]),
                G(r).length ? (n(), o("span", {
                  key: 1,
                  class: "iv-sb-bans",
                  title: s(l)("Bans")
                }, [
                  (n(!0), o(u, null, v(G(r), (t, c) => (n(), o("img", {
                    key: c,
                    src: s(T)(t),
                    alt: s(h)(t),
                    title: s(l)("Banned: {champion}", { champion: s(h)(t) })
                  }, null, 8, Fs))), 128))
                ], 8, js)) : k("", !0),
                e("span", Hs, [
                  m(i(r.kills) + " / " + i(r.deaths) + " / " + i(r.assists) + " ", 1),
                  d[5] || (d[5] = e("span", { class: "iv-sb-dot" }, "·", -1)),
                  m(" " + i(s(l)("{gold} gold", { gold: s(x)(r.gold) })), 1)
                ])
              ])
            ])
          ]),
          (n(!0), o(u, null, v(os, (t) => (n(), o(u, {
            key: t.participantId
          }, [
            e("tr", {
              class: g(["iv-sb-row", { self: t.puuid === f.puuid, open: y.value === t.participantId }]),
              onClick: (c) => is(c, t)
            }, [
              e("td", Us, [
                e("span", {
                  class: "iv-sb-portrait",
                  title: s(h)(t.championId)
                }, [
                  e("span", Ys, [
                    e("img", {
                      src: s(T)(t.championId),
                      alt: ""
                    }, null, 8, qs)
                  ]),
                  e("em", null, i(t.level), 1)
                ], 8, Ws),
                e("span", Js, [
                  (n(!0), o(u, null, v(t.spells, (c, $) => (n(), o("img", {
                    key: $,
                    src: s(Y)(c),
                    alt: s(V)(c),
                    title: s(V)(c),
                    onError: d[0] || (d[0] = //@ts-ignore
                    (...S) => s(b) && s(b)(...S))
                  }, null, 40, Qs))), 128)),
                  t.perks[0] ? (n(), o("img", {
                    key: 0,
                    src: s(U)(t.perks[0]),
                    title: s(W)(t.perks[0]),
                    alt: "",
                    class: "key",
                    onError: d[1] || (d[1] = //@ts-ignore
                    (...c) => s(b) && s(b)(...c))
                  }, null, 40, Xs)) : (n(), o("i", Zs)),
                  t.styles[1] ? (n(), o("img", {
                    key: 2,
                    src: s(q)(t.styles[1]),
                    title: s(J)(t.styles[1]),
                    alt: "",
                    class: "sub",
                    onError: d[2] || (d[2] = //@ts-ignore
                    (...c) => s(b) && s(b)(...c))
                  }, null, 40, st)) : k("", !0)
                ])
              ]),
              e("td", tt, [
                e("span", et, [
                  N(ws, {
                    class: "iv-sb-link",
                    to: ns(t),
                    title: s(ks)(t) || s(h)(t.championId)
                  }, {
                    default: _s(() => [
                      m(i(t.gameName || s(h)(t.championId)), 1),
                      t.tagLine ? (n(), o("small", lt, "#" + i(t.tagLine), 1)) : k("", !0)
                    ]),
                    _: 2
                  }, 1032, ["to", "title"]),
                  t.puuid && t.puuid === s(B).viewer.value && t.puuid !== f.puuid ? (n(), o("span", at, i(s(l)("You")), 1)) : k("", !0)
                ]),
                e("span", it, [
                  e("small", null, [
                    t.position ? (n(), o(u, { key: 0 }, [
                      m(i(s(ys)(t.position, s(l))), 1)
                    ], 64)) : (n(), o(u, { key: 1 }, [
                      m(i(s(h)(t.championId)), 1)
                    ], 64)),
                    t.gold15 !== null ? (n(), o(u, { key: 2 }, [
                      d[6] || (d[6] = m(" · ", -1)),
                      e("span", {
                        class: g(as(t.gold15)),
                        title: s(l)("Gold lead over the lane opponent at 15 minutes")
                      }, i(s(l)("{gold} gold @15", { gold: s(H)(t.gold15) })), 11, nt)
                    ], 64)) : k("", !0)
                  ]),
                  (n(!0), o(u, null, v(s(ps)(t.badges), (c) => (n(), o("span", {
                    key: c,
                    class: "iv-badge",
                    title: s(l)(s(C)[c].tip)
                  }, i(s(l)(s(C)[c].label)), 9, ot))), 128))
                ])
              ]),
              e("td", dt, [
                e("b", null, [
                  m(i(t.kills), 1),
                  d[7] || (d[7] = e("i", null, "/", -1)),
                  m(i(t.deaths), 1),
                  d[8] || (d[8] = e("i", null, "/", -1)),
                  m(i(t.assists), 1)
                ]),
                e("small", null, i(s(j)(t.kills, t.deaths, t.assists)) + " · " + i(s(I)(t.kp)) + " " + i(s(l)("KP")), 1)
              ]),
              e("td", {
                class: "num iv-sb-dmg",
                title: ss(t),
                "data-l": s(l)("dmg")
              }, [
                e("b", null, [
                  e("small", rt, i(s(I)(t.damageShare)), 1),
                  m(i(s(x)(t.damage)), 1)
                ]),
                e("i", ut, [
                  e("em", {
                    style: K({ width: `${t.damage / X.value * 100}%` })
                  }, null, 4)
                ])
              ], 8, ct),
              e("td", {
                class: "num iv-sb-dmg iv-sb-taken",
                title: s(w)(t.damageTaken)
              }, [
                e("b", null, i(s(x)(t.damageTaken)), 1),
                e("i", _t, [
                  e("em", {
                    style: K({ width: `${t.damageTaken / Z.value * 100}%` })
                  }, null, 4)
                ])
              ], 8, mt),
              e("td", {
                class: "num iv-sb-gold",
                title: `${s(l)("{share} of the team", { share: s(I)(t.goldShare) })} · ${s(l)("Gold per minute")}: ${s(w)(t.gold / R.value)}`,
                "data-l": s(l)("gold")
              }, [
                e("b", null, i(s(x)(t.gold)), 1),
                e("small", null, i(s(w)(t.gold / R.value)), 1)
              ], 8, bt),
              e("td", {
                class: "num iv-sb-cs",
                "data-l": s(l)("CS")
              }, [
                e("b", null, i(t.cs), 1),
                e("small", null, i(s(w)(t.csMin, 1)), 1)
              ], 8, ht),
              e("td", {
                class: "num iv-sb-vis",
                title: s(l)("{placed} placed · {killed} destroyed · {control} control wards", { placed: t.wardsPlaced, killed: t.wardsKilled, control: t.controlWards })
              }, [
                e("b", null, i(t.vision), 1),
                e("small", null, i(t.wardsPlaced) + " / " + i(t.wardsKilled), 1)
              ], 8, vt),
              e("td", gt, [
                e("span", kt, [
                  (n(!0), o(u, null, v(t.items, (c, $) => (n(), o(u, { key: $ }, [
                    c ? (n(), o("img", {
                      key: 0,
                      src: s(O)(c),
                      alt: s(E)(c),
                      title: s(E)(c),
                      class: g({ trinket: $ === 6 }),
                      onError: d[3] || (d[3] = //@ts-ignore
                      (...S) => s(b) && s(b)(...S))
                    }, null, 42, yt)) : (n(), o("i", {
                      key: 1,
                      class: g({ trinket: $ === 6 })
                    }, null, 2))
                  ], 64))), 128))
                ])
              ]),
              e("td", pt, [
                t.score !== null ? (n(), o("span", ft, [
                  t.badges.includes("mvp") ? (n(), o("span", {
                    key: 0,
                    class: "iv-badge gold",
                    title: s(l)(s(C).mvp.tip)
                  }, i(s(l)("MVP")), 9, wt)) : t.badges.includes("ace") ? (n(), o("span", {
                    key: 1,
                    class: "iv-badge",
                    title: s(l)(s(C).ace.tip)
                  }, i(s(l)("ACE")), 9, It)) : (n(), o("small", $t, i(s(D)(t.rank)), 1)),
                  N($s, {
                    score: s(F)(t.score),
                    rank: t.rank,
                    size: "sm"
                  }, null, 8, ["score", "rank"])
                ])) : (n(), o("span", Nt, "–"))
              ]),
              e("td", xt, [
                e("button", {
                  type: "button",
                  class: "iv-sb-toggle",
                  "aria-expanded": y.value === t.participantId,
                  "aria-controls": `${s(P)}-${t.participantId}`,
                  "aria-label": s(l)("Details of {name}", { name: t.gameName || s(h)(t.championId) }),
                  onClick: (c) => L(t)
                }, [
                  N(fs, {
                    name: "down",
                    size: 14
                  })
                ], 8, Ct)
              ])
            ], 10, Os),
            y.value === t.participantId ? (n(), o("tr", St, [
              e("td", {
                id: `${s(P)}-${t.participantId}`,
                colspan: "11"
              }, [
                e("div", Dt, [
                  N(Ns, {
                    detail: f.detail,
                    player: t,
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
  Ot as default
};
