import '../styles/base.css';
import '../styles/primitives.css';
import './MatchRow.css';
import { defineComponent as ee, computed as m, openBlock as a, createElementBlock as s, createElementVNode as t, normalizeClass as p, unref as e, toDisplayString as o, createCommentVNode as v, Fragment as k, renderList as B, createTextVNode as g, createBlock as S } from "vue";
import { useInvadeUi as le, useFormat as te, useNames as ae, gameFavorite as se } from "../context.js";
import { hideBroken as d } from "../dom.js";
import { queueName as ne, queueShort as oe, topBadges as ue, BADGES as V } from "../logic/labels.js";
import ie from "./Icon.vue.js";
import re from "./PerfDial.vue.js";
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
}, Ee = { class: "iv-mr-farm" }, Ce = { class: "iv-unit" }, Le = { class: "iv-mr-well" }, xe = ["src", "alt", "title"], ze = {
  key: 0,
  class: "iv-mr-badges"
}, Re = ["title"], Ve = { class: "iv-mr-vs" }, Ae = ["title"], De = ["src", "alt"], Fe = { class: "iv-mr-score" }, Qe = /* @__PURE__ */ ee({
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
  setup(r) {
    const c = r, f = le(), { t: n } = f, { compact: A, date: D, kdaRatio: F, mmss: M, num: P, ordinal: q, pct: G, score100: K, signedLp: T } = te(), { champIcon: w, champName: _, itemIcon: U, itemName: E, runeIcon: W, runeName: C, spellIcon: j, spellName: L, styleIcon: H, styleName: x } = ae(), l = m(() => c.game), J = m(() => l.value.remake ? "remake" : l.value.win ? "win" : "loss"), O = m(() => l.value.queueId === 420 ? n("Ranked Solo") : ne(l.value.queueId, n)), Q = m(() => oe(l.value.queueId, n)), X = m(() => l.value.remake ? n("Remake") : l.value.placement ? n("{place} place", { place: q(l.value.placement) }) : c.lp != null ? `${T(c.lp)} ${n("LP")}` : l.value.win ? n("Win") : n("Loss")), b = m(() => c.opponent ?? c.score?.opponent ?? null), z = m(() => c.kp ?? c.score?.kp ?? null), N = m(() => ue(c.badges.length ? c.badges : c.score?.badges)), I = m(() => c.score?.tag || ""), R = m(() => c.score ? I.value === "mvp" ? n("MVP") : I.value === "ace" ? n("ACE") : q(c.score.rank) : ""), Y = m(() => D(l.value.creation, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })), y = m(() => f.favorites && c.puuid ? se(c.puuid, _(l.value.championId), l.value) : null);
    return (Z, i) => (a(), s("div", me, [
      t("button", {
        type: "button",
        class: p(["iv-mr", [J.value, { open: r.open, compact: r.compact, starred: y.value }]]),
        "aria-expanded": r.compact ? void 0 : r.open,
        onClick: i[4] || (i[4] = (u) => Z.$emit("toggle"))
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
            r.compact ? v("", !0) : (a(), s("em", ye, o(l.value.level), 1))
          ], 8, pe),
          r.compact ? v("", !0) : (a(), s("span", he, [
            (a(!0), s(k, null, B(l.value.spells.slice(0, 2), (u, h) => (a(), s("img", {
              key: `s${h}`,
              src: e(j)(u),
              alt: e(L)(u),
              title: e(L)(u),
              onError: i[0] || (i[0] = //@ts-ignore
              (...$) => e(d) && e(d)(...$))
            }, null, 40, fe))), 128)),
            l.value.keystone ? (a(), s("img", {
              key: 0,
              src: e(W)(l.value.keystone),
              alt: e(C)(l.value.keystone),
              title: e(C)(l.value.keystone),
              class: "key",
              onError: i[1] || (i[1] = //@ts-ignore
              (...u) => e(d) && e(d)(...u))
            }, null, 40, _e)) : (a(), s("i", be)),
            l.value.subStyle ? (a(), s("img", {
              key: 2,
              src: e(H)(l.value.subStyle),
              alt: e(x)(l.value.subStyle),
              title: e(x)(l.value.subStyle),
              class: "sub",
              onError: i[2] || (i[2] = //@ts-ignore
              (...u) => e(d) && e(d)(...u))
            }, null, 40, Ie)) : (a(), s("i", Ne))
          ])),
          t("span", {
            class: "iv-mr-game",
            title: Y.value
          }, [
            t("b", null, [
              t("span", Be, o(O.value), 1),
              t("span", Se, o(Q.value), 1)
            ]),
            t("small", null, [
              t("span", {
                class: p(["iv-mr-outcome", { lp: r.lp != null && !l.value.remake && !l.value.placement }])
              }, o(X.value), 3),
              g(" · " + o(e(M)(l.value.duration)), 1)
            ])
          ], 8, $e),
          t("span", qe, [
            t("b", null, [
              g(o(l.value.kills), 1),
              i[6] || (i[6] = t("i", null, "/", -1)),
              g(o(l.value.deaths), 1),
              i[7] || (i[7] = t("i", null, "/", -1)),
              g(o(l.value.assists), 1)
            ]),
            t("small", null, [
              g(o(e(F)(l.value.kills, l.value.deaths, l.value.assists)) + " " + o(e(n)("KDA")), 1),
              z.value != null ? (a(), s("span", we, " · " + o(e(G)(z.value)) + " " + o(e(n)("KP")), 1)) : v("", !0)
            ])
          ]),
          t("span", Ee, [
            t("b", null, [
              g(o(e(P)(l.value.csMin, 1)), 1),
              t("span", Ce, o(e(n)("CS/min")), 1)
            ]),
            t("small", null, o(e(A)(l.value.damage)) + " " + o(e(n)("dmg")), 1)
          ]),
          r.compact ? v("", !0) : (a(), s(k, { key: 1 }, [
            t("span", {
              class: p(["iv-mr-items", { tagged: N.value.length }])
            }, [
              t("span", Le, [
                (a(!0), s(k, null, B(l.value.items.slice(0, 7), (u, h) => (a(), s(k, { key: h }, [
                  u ? (a(), s("img", {
                    key: 0,
                    src: e(U)(u),
                    alt: e(E)(u),
                    title: e(E)(u),
                    class: p({ trinket: h === 6 }),
                    onError: i[3] || (i[3] = //@ts-ignore
                    (...$) => e(d) && e(d)(...$))
                  }, null, 42, xe)) : (a(), s("i", {
                    key: 1,
                    class: p({ trinket: h === 6 })
                  }, null, 2))
                ], 64))), 128))
              ]),
              N.value.length ? (a(), s("span", ze, [
                (a(!0), s(k, null, B(N.value, (u) => (a(), s("span", {
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
            r.compact && R.value ? (a(), s("small", {
              key: 0,
              class: p(["iv-mr-place", I.value])
            }, o(R.value), 3)) : v("", !0),
            r.score ? (a(), S(re, {
              key: 1,
              score: e(K)(r.score.score),
              rank: r.score.rank,
              tag: I.value,
              size: r.compact ? "sm" : "md"
            }, null, 8, ["score", "rank", "tag", "size"])) : v("", !0)
          ]),
          r.compact ? v("", !0) : (a(), S(ie, {
            key: 2,
            name: "down",
            size: 15,
            class: "iv-mr-chev"
          }))
        ])
      ], 10, ve),
      y.value ? (a(), S(ce, {
        key: 0,
        class: "iv-mr-star",
        saved: e(f).favorites.has(y.value.key),
        label: `${e(n)("Game")} · ${y.value.label}`,
        onToggle: i[5] || (i[5] = (u) => e(f).favorites.toggle(y.value))
      }, null, 8, ["saved", "label"])) : v("", !0)
    ]));
  }
});
export {
  Qe as default
};
