import '../styles/base.css';
import '../styles/primitives.css';
import './MatchRow.css';
import { defineComponent as ee, computed as m, openBlock as s, createElementBlock as a, createElementVNode as t, normalizeClass as p, unref as e, toDisplayString as o, createCommentVNode as v, Fragment as k, renderList as S, createTextVNode as g, createBlock as $ } from "vue";
import { useInvadeUi as le, useFormat as te, useNames as se, gameFavorite as ae } from "../context.js";
import { hideBroken as d } from "../dom.js";
import { queueName as ne, queueShort as oe, topBadges as ue, BADGES as R } from "../logic/labels.js";
import ie from "./Icon.vue.js";
import V from "./PerfDial.vue.js";
/* empty css              */
import re from "./StarButton.vue.js";
/* empty css                */
/* empty css                 */
/* empty css                       */
const ce = { class: "iv-mr-wrap" }, me = ["aria-expanded"], ve = { class: "iv-mr-grid" }, de = ["title"], pe = { class: "iv-mr-portrait" }, ke = ["src"], ge = { key: 0 }, ye = {
  key: 0,
  class: "iv-mr-load"
}, he = ["src", "alt", "title"], fe = ["src", "alt", "title"], _e = { key: 1 }, be = ["src", "alt", "title"], Ie = { key: 3 }, $e = ["title"], Be = { class: "iv-mr-q" }, Ne = { class: "iv-mr-q brief" }, Se = { class: "iv-mr-kda" }, qe = {
  key: 0,
  class: "iv-mr-kp"
}, we = { class: "iv-mr-farm" }, Ee = { class: "iv-unit" }, ze = { class: "iv-mr-well" }, Ce = ["src"], Le = {
  key: 0,
  class: "iv-mr-badges"
}, xe = ["title"], Re = { class: "iv-mr-vs" }, Ve = ["title"], Ae = ["src", "alt"], De = { class: "iv-mr-score" }, Oe = /* @__PURE__ */ ee({
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
  setup(u) {
    const c = u, f = le(), { t: n } = f, { compact: A, date: D, kdaRatio: F, mmss: M, num: P, ordinal: q, pct: G, score100: K, signedLp: T } = te(), { champIcon: w, champName: _, itemIcon: U, runeIcon: W, runeName: E, spellIcon: j, spellName: z, styleIcon: H, styleName: C } = se(), l = m(() => c.game), J = m(() => l.value.remake ? "remake" : l.value.win ? "win" : "loss"), O = m(() => l.value.queueId === 420 ? n("Ranked Solo") : ne(l.value.queueId, n)), Q = m(() => oe(l.value.queueId, n)), X = m(() => l.value.remake ? n("Remake") : l.value.placement ? n("{place} place", { place: q(l.value.placement) }) : c.lp != null ? `${T(c.lp)} ${n("LP")}` : l.value.win ? n("Win") : n("Loss")), b = m(() => c.opponent ?? c.score?.opponent ?? null), L = m(() => c.kp ?? c.score?.kp ?? null), B = m(() => ue(c.badges.length ? c.badges : c.score?.badges)), I = m(() => c.score?.tag || ""), x = m(() => c.score ? I.value === "mvp" ? n("MVP") : I.value === "ace" ? n("ACE") : q(c.score.rank) : ""), Y = m(() => D(l.value.creation, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })), y = m(() => f.favorites && c.puuid ? ae(c.puuid, _(l.value.championId), l.value) : null);
    return (Z, i) => (s(), a("div", ce, [
      t("button", {
        type: "button",
        class: p(["iv-mr", [J.value, { open: u.open, compact: u.compact, starred: y.value }]]),
        "aria-expanded": u.compact ? void 0 : u.open,
        onClick: i[4] || (i[4] = (r) => Z.$emit("toggle"))
      }, [
        t("span", ve, [
          t("span", {
            class: "iv-mr-champ",
            title: e(_)(l.value.championId)
          }, [
            t("span", pe, [
              t("img", {
                src: e(w)(l.value.championId),
                alt: ""
              }, null, 8, ke)
            ]),
            u.compact ? v("", !0) : (s(), a("em", ge, o(l.value.level), 1))
          ], 8, de),
          u.compact ? v("", !0) : (s(), a("span", ye, [
            (s(!0), a(k, null, S(l.value.spells.slice(0, 2), (r, h) => (s(), a("img", {
              key: `s${h}`,
              src: e(j)(r),
              alt: e(z)(r),
              title: e(z)(r),
              onError: i[0] || (i[0] = //@ts-ignore
              (...N) => e(d) && e(d)(...N))
            }, null, 40, he))), 128)),
            l.value.keystone ? (s(), a("img", {
              key: 0,
              src: e(W)(l.value.keystone),
              alt: e(E)(l.value.keystone),
              title: e(E)(l.value.keystone),
              class: "key",
              onError: i[1] || (i[1] = //@ts-ignore
              (...r) => e(d) && e(d)(...r))
            }, null, 40, fe)) : (s(), a("i", _e)),
            l.value.subStyle ? (s(), a("img", {
              key: 2,
              src: e(H)(l.value.subStyle),
              alt: e(C)(l.value.subStyle),
              title: e(C)(l.value.subStyle),
              class: "sub",
              onError: i[2] || (i[2] = //@ts-ignore
              (...r) => e(d) && e(d)(...r))
            }, null, 40, be)) : (s(), a("i", Ie))
          ])),
          t("span", {
            class: "iv-mr-game",
            title: Y.value
          }, [
            t("b", null, [
              t("span", Be, o(O.value), 1),
              t("span", Ne, o(Q.value), 1)
            ]),
            t("small", null, [
              t("span", {
                class: p(["iv-mr-outcome", { lp: u.lp != null && !l.value.remake && !l.value.placement }])
              }, o(X.value), 3),
              g(" · " + o(e(M)(l.value.duration)), 1)
            ])
          ], 8, $e),
          t("span", Se, [
            t("b", null, [
              g(o(l.value.kills), 1),
              i[6] || (i[6] = t("i", null, "/", -1)),
              g(o(l.value.deaths), 1),
              i[7] || (i[7] = t("i", null, "/", -1)),
              g(o(l.value.assists), 1)
            ]),
            t("small", null, [
              g(o(e(F)(l.value.kills, l.value.deaths, l.value.assists)) + " " + o(e(n)("KDA")), 1),
              L.value != null ? (s(), a("span", qe, " · " + o(e(G)(L.value)) + " " + o(e(n)("KP")), 1)) : v("", !0)
            ])
          ]),
          t("span", we, [
            t("b", null, [
              g(o(e(P)(l.value.csMin, 1)), 1),
              t("span", Ee, o(e(n)("CS/min")), 1)
            ]),
            t("small", null, o(e(A)(l.value.damage)) + " " + o(e(n)("dmg")), 1)
          ]),
          u.compact ? v("", !0) : (s(), a(k, { key: 1 }, [
            t("span", {
              class: p(["iv-mr-items", { tagged: B.value.length }])
            }, [
              t("span", ze, [
                (s(!0), a(k, null, S(l.value.items.slice(0, 7), (r, h) => (s(), a(k, { key: h }, [
                  r ? (s(), a("img", {
                    key: 0,
                    src: e(U)(r),
                    alt: "",
                    class: p({ trinket: h === 6 }),
                    onError: i[3] || (i[3] = //@ts-ignore
                    (...N) => e(d) && e(d)(...N))
                  }, null, 42, Ce)) : (s(), a("i", {
                    key: 1,
                    class: p({ trinket: h === 6 })
                  }, null, 2))
                ], 64))), 128))
              ]),
              B.value.length ? (s(), a("span", Le, [
                (s(!0), a(k, null, S(B.value, (r) => (s(), a("span", {
                  key: r,
                  class: "iv-badge",
                  title: e(n)(e(R)[r].tip)
                }, o(e(n)(e(R)[r].label)), 9, xe))), 128))
              ])) : v("", !0)
            ], 2),
            t("span", Re, [
              b.value ? (s(), a(k, { key: 0 }, [
                t("small", null, o(e(n)("vs")), 1),
                t("span", {
                  class: "iv-mr-portrait",
                  title: e(n)("Lane opponent: {champion}", { champion: e(_)(b.value) })
                }, [
                  t("img", {
                    src: e(w)(b.value),
                    alt: e(_)(b.value)
                  }, null, 8, Ae)
                ], 8, Ve)
              ], 64)) : v("", !0)
            ])
          ], 64)),
          t("span", De, [
            u.compact && x.value ? (s(), a("small", {
              key: 0,
              class: p(["iv-mr-place", I.value])
            }, o(x.value), 3)) : v("", !0),
            u.score ? (s(), $(V, {
              key: 1,
              score: e(K)(u.score.score),
              rank: u.score.rank,
              tag: I.value,
              size: u.compact ? "sm" : "md"
            }, null, 8, ["score", "rank", "tag", "size"])) : l.value.remake ? v("", !0) : (s(), $(V, {
              key: 2,
              score: null,
              size: u.compact ? "sm" : "md"
            }, null, 8, ["size"]))
          ]),
          u.compact ? v("", !0) : (s(), $(ie, {
            key: 2,
            name: "down",
            size: 15,
            class: "iv-mr-chev"
          }))
        ])
      ], 10, me),
      y.value ? (s(), $(re, {
        key: 0,
        class: "iv-mr-star",
        saved: e(f).favorites.has(y.value.key),
        label: `${e(n)("Game")} · ${y.value.label}`,
        onToggle: i[5] || (i[5] = (r) => e(f).favorites.toggle(y.value))
      }, null, 8, ["saved", "label"])) : v("", !0)
    ]));
  }
});
export {
  Oe as default
};
