import '../styles/base.css';
import '../styles/primitives.css';
import './MatchRow.css';
import { defineComponent as le, computed as m, openBlock as a, createElementBlock as s, createElementVNode as t, normalizeClass as p, unref as e, toDisplayString as o, createCommentVNode as v, Fragment as k, renderList as S, createTextVNode as g, createBlock as N } from "vue";
import { useInvadeUi as te, useFormat as ae, useNames as se, gameFavorite as ne } from "../context.js";
import { hideBroken as d } from "../dom.js";
import { queueName as oe, queueShort as ue, topBadges as ie, BADGES as V } from "../logic/labels.js";
import re from "./Icon.vue.js";
import A from "./PerfDial.vue.js";
/* empty css              */
import ce from "./StarButton.vue.js";
/* empty css                */
/* empty css                 */
/* empty css                       */
const me = { class: "iv-mr-wrap" }, ve = ["aria-expanded"], de = { class: "iv-mr-grid" }, pe = ["title"], ke = { class: "iv-mr-portrait" }, ge = ["src"], ye = { key: 0 }, he = {
  key: 0,
  class: "iv-mr-load"
}, fe = ["src", "alt", "title"], _e = ["src", "alt", "title"], be = { key: 1 }, Ie = ["src", "alt", "title"], Ne = { key: 3 }, $e = ["title"], Be = { class: "iv-mr-q" }, Se = { class: "iv-mr-q brief" }, qe = { class: "iv-mr-kda" }, we = {
  key: 0,
  class: "iv-mr-kp"
}, Ee = { class: "iv-mr-farm" }, ze = { class: "iv-unit" }, Ce = { class: "iv-mr-well" }, Le = ["src", "alt", "title"], xe = {
  key: 0,
  class: "iv-mr-badges"
}, Re = ["title"], Ve = { class: "iv-mr-vs" }, Ae = ["title"], De = ["src", "alt"], Fe = { class: "iv-mr-score" }, Qe = /* @__PURE__ */ le({
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
  setup(i) {
    const c = i, f = te(), { t: n } = f, { compact: D, date: F, kdaRatio: M, mmss: P, num: G, ordinal: q, pct: K, score100: T, signedLp: U } = ae(), { champIcon: w, champName: _, itemIcon: W, itemName: E, runeIcon: j, runeName: z, spellIcon: H, spellName: C, styleIcon: J, styleName: L } = se(), l = m(() => c.game), O = m(() => l.value.remake ? "remake" : l.value.win ? "win" : "loss"), Q = m(() => l.value.queueId === 420 ? n("Ranked Solo") : oe(l.value.queueId, n)), X = m(() => ue(l.value.queueId, n)), Y = m(() => l.value.remake ? n("Remake") : l.value.placement ? n("{place} place", { place: q(l.value.placement) }) : c.lp != null ? `${U(c.lp)} ${n("LP")}` : l.value.win ? n("Win") : n("Loss")), b = m(() => c.opponent ?? c.score?.opponent ?? null), x = m(() => c.kp ?? c.score?.kp ?? null), $ = m(() => ie(c.badges.length ? c.badges : c.score?.badges)), I = m(() => c.score?.tag || ""), R = m(() => c.score ? I.value === "mvp" ? n("MVP") : I.value === "ace" ? n("ACE") : q(c.score.rank) : ""), Z = m(() => F(l.value.creation, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })), y = m(() => f.favorites && c.puuid ? ne(c.puuid, _(l.value.championId), l.value) : null);
    return (ee, r) => (a(), s("div", me, [
      t("button", {
        type: "button",
        class: p(["iv-mr", [O.value, { open: i.open, compact: i.compact, starred: y.value }]]),
        "aria-expanded": i.compact ? void 0 : i.open,
        onClick: r[4] || (r[4] = (u) => ee.$emit("toggle"))
      }, [
        t("span", de, [
          t("span", {
            class: "iv-mr-champ",
            title: e(_)(l.value.championId)
          }, [
            t("span", ke, [
              t("img", {
                src: e(w)(l.value.championId),
                alt: ""
              }, null, 8, ge)
            ]),
            i.compact ? v("", !0) : (a(), s("em", ye, o(l.value.level), 1))
          ], 8, pe),
          i.compact ? v("", !0) : (a(), s("span", he, [
            (a(!0), s(k, null, S(l.value.spells.slice(0, 2), (u, h) => (a(), s("img", {
              key: `s${h}`,
              src: e(H)(u),
              alt: e(C)(u),
              title: e(C)(u),
              onError: r[0] || (r[0] = //@ts-ignore
              (...B) => e(d) && e(d)(...B))
            }, null, 40, fe))), 128)),
            l.value.keystone ? (a(), s("img", {
              key: 0,
              src: e(j)(l.value.keystone),
              alt: e(z)(l.value.keystone),
              title: e(z)(l.value.keystone),
              class: "key",
              onError: r[1] || (r[1] = //@ts-ignore
              (...u) => e(d) && e(d)(...u))
            }, null, 40, _e)) : (a(), s("i", be)),
            l.value.subStyle ? (a(), s("img", {
              key: 2,
              src: e(J)(l.value.subStyle),
              alt: e(L)(l.value.subStyle),
              title: e(L)(l.value.subStyle),
              class: "sub",
              onError: r[2] || (r[2] = //@ts-ignore
              (...u) => e(d) && e(d)(...u))
            }, null, 40, Ie)) : (a(), s("i", Ne))
          ])),
          t("span", {
            class: "iv-mr-game",
            title: Z.value
          }, [
            t("b", null, [
              t("span", Be, o(Q.value), 1),
              t("span", Se, o(X.value), 1)
            ]),
            t("small", null, [
              t("span", {
                class: p(["iv-mr-outcome", { lp: i.lp != null && !l.value.remake && !l.value.placement }])
              }, o(Y.value), 3),
              g(" · " + o(e(P)(l.value.duration)), 1)
            ])
          ], 8, $e),
          t("span", qe, [
            t("b", null, [
              g(o(l.value.kills), 1),
              r[6] || (r[6] = t("i", null, "/", -1)),
              g(o(l.value.deaths), 1),
              r[7] || (r[7] = t("i", null, "/", -1)),
              g(o(l.value.assists), 1)
            ]),
            t("small", null, [
              g(o(e(M)(l.value.kills, l.value.deaths, l.value.assists)) + " " + o(e(n)("KDA")), 1),
              x.value != null ? (a(), s("span", we, " · " + o(e(K)(x.value)) + " " + o(e(n)("KP")), 1)) : v("", !0)
            ])
          ]),
          t("span", Ee, [
            t("b", null, [
              g(o(e(G)(l.value.csMin, 1)), 1),
              t("span", ze, o(e(n)("CS/min")), 1)
            ]),
            t("small", null, o(e(D)(l.value.damage)) + " " + o(e(n)("dmg")), 1)
          ]),
          i.compact ? v("", !0) : (a(), s(k, { key: 1 }, [
            t("span", {
              class: p(["iv-mr-items", { tagged: $.value.length }])
            }, [
              t("span", Ce, [
                (a(!0), s(k, null, S(l.value.items.slice(0, 7), (u, h) => (a(), s(k, { key: h }, [
                  u ? (a(), s("img", {
                    key: 0,
                    src: e(W)(u),
                    alt: e(E)(u),
                    title: e(E)(u),
                    class: p({ trinket: h === 6 }),
                    onError: r[3] || (r[3] = //@ts-ignore
                    (...B) => e(d) && e(d)(...B))
                  }, null, 42, Le)) : (a(), s("i", {
                    key: 1,
                    class: p({ trinket: h === 6 })
                  }, null, 2))
                ], 64))), 128))
              ]),
              $.value.length ? (a(), s("span", xe, [
                (a(!0), s(k, null, S($.value, (u) => (a(), s("span", {
                  key: u,
                  class: "iv-badge",
                  title: e(n)(e(V)[u].tip)
                }, o(e(n)(e(V)[u].label)), 9, Re))), 128))
              ])) : v("", !0)
            ], 2),
            t("span", Ve, [
              b.value ? (a(), s(k, { key: 0 }, [
                t("small", null, o(e(n)("vs")), 1),
                t("span", {
                  class: "iv-mr-portrait",
                  title: e(n)("Lane opponent: {champion}", { champion: e(_)(b.value) })
                }, [
                  t("img", {
                    src: e(w)(b.value),
                    alt: e(_)(b.value)
                  }, null, 8, De)
                ], 8, Ae)
              ], 64)) : v("", !0)
            ])
          ], 64)),
          t("span", Fe, [
            i.compact && R.value ? (a(), s("small", {
              key: 0,
              class: p(["iv-mr-place", I.value])
            }, o(R.value), 3)) : v("", !0),
            i.score ? (a(), N(A, {
              key: 1,
              score: e(T)(i.score.score),
              rank: i.score.rank,
              tag: I.value,
              size: i.compact ? "sm" : "md"
            }, null, 8, ["score", "rank", "tag", "size"])) : l.value.remake ? v("", !0) : (a(), N(A, {
              key: 2,
              score: null,
              size: i.compact ? "sm" : "md"
            }, null, 8, ["size"]))
          ]),
          i.compact ? v("", !0) : (a(), N(re, {
            key: 2,
            name: "down",
            size: 15,
            class: "iv-mr-chev"
          }))
        ])
      ], 10, ve),
      y.value ? (a(), N(ce, {
        key: 0,
        class: "iv-mr-star",
        saved: e(f).favorites.has(y.value.key),
        label: `${e(n)("Game")} · ${y.value.label}`,
        onToggle: r[5] || (r[5] = (u) => e(f).favorites.toggle(y.value))
      }, null, 8, ["saved", "label"])) : v("", !0)
    ]));
  }
});
export {
  Qe as default
};
