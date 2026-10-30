import '../styles/base.css';
import '../styles/primitives.css';
import './MatchRow.css';
import { defineComponent as te, computed as m, openBlock as a, createElementBlock as s, createElementVNode as l, normalizeClass as f, unref as e, toDisplayString as n, createCommentVNode as v, Fragment as p, renderList as B, createTextVNode as k, createBlock as I } from "vue";
import { useInvadeUi as le, useFormat as ae, useNames as se, gameFavorite as oe } from "../context.js";
import { hideBroken as d } from "../dom.js";
import { queueName as ne, queueShort as ue, topBadges as ie, BADGES as A } from "../logic/labels.js";
import { rowTeamRating as re } from "../logic/team.js";
import ce from "./Icon.vue.js";
import me from "./PerfDial.vue.js";
/* empty css              */
import ve from "./StarButton.vue.js";
/* empty css                */
import de from "./TeamBadge.vue.js";
/* empty css               */
/* empty css                 */
/* empty css                       */
const pe = { class: "iv-mr-wrap" }, ke = ["aria-expanded"], ge = { class: "iv-mr-grid" }, ye = ["title"], fe = { class: "iv-mr-portrait" }, he = ["src"], _e = { key: 0 }, be = {
  key: 0,
  class: "iv-mr-load"
}, we = ["src", "alt", "title"], Ie = ["src", "alt", "title"], $e = { key: 1 }, Ne = ["src", "alt", "title"], Be = { key: 3 }, Se = ["title"], qe = { class: "iv-mr-q" }, Ee = { class: "iv-mr-q brief" }, Ce = { class: "iv-mr-kda" }, Le = {
  key: 0,
  class: "iv-mr-kp"
}, Re = { class: "iv-mr-farm" }, xe = { class: "iv-unit" }, ze = { class: "iv-mr-items" }, Ve = { class: "iv-mr-well" }, Ae = ["src", "alt", "title"], De = {
  key: 0,
  class: "iv-mr-badges"
}, Fe = ["title"], Me = { class: "iv-mr-vs" }, Pe = ["title"], Te = ["src", "alt"], Ge = { class: "iv-mr-score" }, at = /* @__PURE__ */ te({
  __name: "MatchRow",
  props: {
    game: {},
    score: { default: null },
    lp: { default: null },
    opponent: { default: null },
    kp: { default: null },
    badges: { default: () => [] },
    open: { type: Boolean, default: !1 },
    compact: { type: Boolean, default: !1 },
    puuid: { default: null }
  },
  emits: ["toggle"],
  setup(c) {
    const i = c, h = le(), { t: o } = h, { compact: D, date: F, kdaRatio: M, mmss: P, num: T, ordinal: S, pct: G, score100: K, signedLp: U } = ae(), { champIcon: q, champName: _, itemIcon: W, itemName: E, runeIcon: j, runeName: C, spellIcon: H, spellName: L, styleIcon: J, styleName: R } = se(), t = m(() => i.game), O = m(() => t.value.remake ? "remake" : t.value.win ? "win" : "loss"), Q = m(() => t.value.queueId === 420 ? o("Ranked Solo") : ne(t.value.queueId, o)), X = m(() => ue(t.value.queueId, o)), Y = m(() => t.value.remake ? o("Remake") : t.value.placement ? o("{place} place", { place: S(t.value.placement) }) : i.lp != null ? `${U(i.lp)} ${o("LP")}` : t.value.win ? o("Win") : o("Loss")), b = m(() => i.opponent ?? i.score?.opponent ?? null), x = m(() => i.kp ?? i.score?.kp ?? null), z = m(() => ie(i.badges.length ? i.badges : i.score?.badges)), $ = m(() => re(t.value, i.score)), w = m(() => i.score?.tag || ""), V = m(() => i.score ? w.value === "mvp" ? o("MVP") : w.value === "ace" ? o("ACE") : S(i.score.rank) : ""), Z = m(() => F(t.value.creation, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })), g = m(() => h.favorites && i.puuid ? oe(i.puuid, _(t.value.championId), t.value) : null);
    return (ee, r) => (a(), s("div", pe, [
      l("button", {
        type: "button",
        class: f(["iv-mr", [O.value, { open: c.open, compact: c.compact, starred: g.value }]]),
        "aria-expanded": c.compact ? void 0 : c.open,
        onClick: r[4] || (r[4] = (u) => ee.$emit("toggle"))
      }, [
        l("span", ge, [
          l("span", {
            class: "iv-mr-champ",
            title: e(_)(t.value.championId)
          }, [
            l("span", fe, [
              l("img", {
                src: e(q)(t.value.championId),
                alt: ""
              }, null, 8, he)
            ]),
            c.compact ? v("", !0) : (a(), s("em", _e, n(t.value.level), 1))
          ], 8, ye),
          c.compact ? v("", !0) : (a(), s("span", be, [
            (a(!0), s(p, null, B(t.value.spells.slice(0, 2), (u, y) => (a(), s("img", {
              key: `s${y}`,
              src: e(H)(u),
              alt: e(L)(u),
              title: e(L)(u),
              onError: r[0] || (r[0] = //@ts-ignore
              (...N) => e(d) && e(d)(...N))
            }, null, 40, we))), 128)),
            t.value.keystone ? (a(), s("img", {
              key: 0,
              src: e(j)(t.value.keystone),
              alt: e(C)(t.value.keystone),
              title: e(C)(t.value.keystone),
              class: "key",
              onError: r[1] || (r[1] = //@ts-ignore
              (...u) => e(d) && e(d)(...u))
            }, null, 40, Ie)) : (a(), s("i", $e)),
            t.value.subStyle ? (a(), s("img", {
              key: 2,
              src: e(J)(t.value.subStyle),
              alt: e(R)(t.value.subStyle),
              title: e(R)(t.value.subStyle),
              class: "sub",
              onError: r[2] || (r[2] = //@ts-ignore
              (...u) => e(d) && e(d)(...u))
            }, null, 40, Ne)) : (a(), s("i", Be))
          ])),
          l("span", {
            class: "iv-mr-game",
            title: Z.value
          }, [
            l("b", null, [
              l("span", qe, n(Q.value), 1),
              l("span", Ee, n(X.value), 1)
            ]),
            l("small", null, [
              l("span", {
                class: f(["iv-mr-outcome", { lp: c.lp != null && !t.value.remake && !t.value.placement }])
              }, n(Y.value), 3),
              k(" · " + n(e(P)(t.value.duration)), 1)
            ])
          ], 8, Se),
          l("span", Ce, [
            l("b", null, [
              k(n(t.value.kills), 1),
              r[6] || (r[6] = l("i", null, "/", -1)),
              k(n(t.value.deaths), 1),
              r[7] || (r[7] = l("i", null, "/", -1)),
              k(n(t.value.assists), 1)
            ]),
            l("small", null, [
              k(n(e(M)(t.value.kills, t.value.deaths, t.value.assists)) + " " + n(e(o)("KDA")), 1),
              x.value != null ? (a(), s("span", Le, " · " + n(e(G)(x.value)) + " " + n(e(o)("KP")), 1)) : v("", !0)
            ])
          ]),
          l("span", Re, [
            l("b", null, [
              k(n(e(T)(t.value.csMin, 1)), 1),
              l("span", xe, n(e(o)("CS/min")), 1)
            ]),
            l("small", null, n(e(D)(t.value.damage)) + " " + n(e(o)("dmg")), 1)
          ]),
          c.compact ? v("", !0) : (a(), s(p, { key: 1 }, [
            l("span", ze, [
              l("span", Ve, [
                (a(!0), s(p, null, B(t.value.items.slice(0, 7), (u, y) => (a(), s(p, { key: y }, [
                  u ? (a(), s("img", {
                    key: 0,
                    src: e(W)(u),
                    alt: e(E)(u),
                    title: e(E)(u),
                    class: f({ trinket: y === 6 }),
                    onError: r[3] || (r[3] = //@ts-ignore
                    (...N) => e(d) && e(d)(...N))
                  }, null, 42, Ae)) : (a(), s("i", {
                    key: 1,
                    class: f({ trinket: y === 6 })
                  }, null, 2))
                ], 64))), 128))
              ]),
              $.value || z.value.length ? (a(), s("span", De, [
                $.value ? (a(), I(de, {
                  key: 0,
                  verdict: $.value,
                  win: t.value.win
                }, null, 8, ["verdict", "win"])) : v("", !0),
                (a(!0), s(p, null, B(z.value, (u) => (a(), s("span", {
                  key: u,
                  class: "iv-badge",
                  title: e(o)(e(A)[u].tip)
                }, n(e(o)(e(A)[u].label)), 9, Fe))), 128))
              ])) : v("", !0)
            ]),
            l("span", Me, [
              b.value ? (a(), s(p, { key: 0 }, [
                l("small", null, n(e(o)("vs")), 1),
                l("span", {
                  class: "iv-mr-portrait",
                  title: e(o)("Lane opponent: {champion}", { champion: e(_)(b.value) })
                }, [
                  l("img", {
                    src: e(q)(b.value),
                    alt: e(_)(b.value)
                  }, null, 8, Te)
                ], 8, Pe)
              ], 64)) : v("", !0)
            ])
          ], 64)),
          l("span", Ge, [
            c.compact && V.value ? (a(), s("small", {
              key: 0,
              class: f(["iv-mr-place", w.value])
            }, n(V.value), 3)) : v("", !0),
            c.score ? (a(), I(me, {
              key: 1,
              score: e(K)(c.score.score),
              rank: c.score.rank,
              tag: w.value,
              size: c.compact ? "sm" : "md"
            }, null, 8, ["score", "rank", "tag", "size"])) : v("", !0)
          ]),
          c.compact ? v("", !0) : (a(), I(ce, {
            key: 2,
            name: "down",
            size: 15,
            class: "iv-mr-chev"
          }))
        ])
      ], 10, ke),
      g.value ? (a(), I(ve, {
        key: 0,
        class: "iv-mr-star",
        saved: e(h).favorites.has(g.value.key),
        label: `${e(o)("Game")} · ${g.value.label}`,
        onToggle: r[5] || (r[5] = (u) => e(h).favorites.toggle(g.value))
      }, null, 8, ["saved", "label"])) : v("", !0)
    ]));
  }
});
export {
  at as default
};
