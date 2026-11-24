import '../styles/base.css';
import '../styles/primitives.css';
import './MatchRow.css';
import { defineComponent as ee, computed as m, openBlock as a, createElementBlock as s, createElementVNode as l, normalizeClass as f, unref as e, toDisplayString as o, createCommentVNode as v, Fragment as y, renderList as z, createTextVNode as p, createBlock as $, createVNode as te } from "vue";
import { useInvadeUi as le, useFormat as ae, useNames as se, gameFavorite as oe } from "../context.js";
import { hideBroken as d } from "../dom.js";
import { queueName as ne, queueShort as ue } from "../logic/labels.js";
import { rowTeamRating as ie } from "../logic/team.js";
import re from "./Icon.vue.js";
import ce from "./PerfDial.vue.js";
/* empty css              */
import me from "./StarButton.vue.js";
/* empty css                */
import ve from "./MatchTags.vue.js";
/* empty css               */
import de from "./TeamBadge.vue.js";
/* empty css               */
/* empty css                 */
/* empty css                       */
const pe = { class: "iv-mr-wrap" }, ke = ["aria-expanded"], ge = { class: "iv-mr-grid" }, fe = ["title"], ye = { class: "iv-mr-portrait" }, he = ["src"], _e = { key: 0 }, be = {
  key: 0,
  class: "iv-mr-load"
}, we = ["src", "alt", "title"], $e = ["src", "alt", "title"], Ie = { key: 1 }, Ne = ["src", "alt", "title"], qe = { key: 3 }, Se = ["title"], Be = { class: "iv-mr-q" }, Ee = { class: "iv-mr-q brief" }, Ce = { class: "iv-mr-kda" }, Le = {
  key: 0,
  class: "iv-mr-kp"
}, Re = { class: "iv-mr-farm" }, Ve = { class: "iv-unit" }, xe = { class: "iv-mr-items" }, ze = { class: "iv-mr-well" }, Fe = ["src", "alt", "title"], Me = {
  key: 0,
  class: "iv-mr-badges"
}, Pe = { class: "iv-mr-vs" }, Te = ["title"], Ae = ["src", "alt"], De = { class: "iv-mr-score" }, st = /* @__PURE__ */ ee({
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
    const u = r, h = le(), { t: n } = h, { compact: F, date: M, kdaRatio: P, mmss: T, num: A, ordinal: q, pct: D, score100: K, signedLp: G } = ae(), { champIcon: S, champName: _, itemIcon: U, itemName: B, runeIcon: W, runeName: E, spellIcon: j, spellName: C, styleIcon: H, styleName: L } = se(), t = m(() => u.game), J = m(() => t.value.remake ? "remake" : t.value.win ? "win" : "loss"), O = m(() => t.value.queueId === 420 ? n("Ranked Solo") : ne(t.value.queueId, n)), Q = m(() => ue(t.value.queueId, n)), X = m(() => t.value.remake ? n("Remake") : t.value.placement ? n("{place} place", { place: q(t.value.placement) }) : u.lp != null ? `${G(u.lp)} ${n("LP")}` : t.value.win ? n("Win") : n("Loss")), b = m(() => u.opponent ?? u.score?.opponent ?? null), R = m(() => u.kp ?? u.score?.kp ?? null), V = m(() => (u.badges.length ? u.badges : u.score?.badges) ?? []), I = m(() => ie(t.value, u.score)), w = m(() => u.score?.tag || ""), x = m(() => u.score ? w.value === "mvp" ? n("MVP") : w.value === "ace" ? n("ACE") : q(u.score.rank) : ""), Y = m(() => M(t.value.creation, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })), k = m(() => h.favorites && u.puuid ? oe(u.puuid, _(t.value.championId), t.value) : null);
    return (Z, i) => (a(), s("div", pe, [
      l("button", {
        type: "button",
        class: f(["iv-mr", [J.value, { open: r.open, compact: r.compact, starred: k.value }]]),
        "aria-expanded": r.compact ? void 0 : r.open,
        onClick: i[4] || (i[4] = (c) => Z.$emit("toggle"))
      }, [
        l("span", ge, [
          l("span", {
            class: "iv-mr-champ",
            title: e(_)(t.value.championId)
          }, [
            l("span", ye, [
              l("img", {
                src: e(S)(t.value.championId),
                alt: ""
              }, null, 8, he)
            ]),
            r.compact ? v("", !0) : (a(), s("em", _e, o(t.value.level), 1))
          ], 8, fe),
          r.compact ? v("", !0) : (a(), s("span", be, [
            (a(!0), s(y, null, z(t.value.spells.slice(0, 2), (c, g) => (a(), s("img", {
              key: `s${g}`,
              src: e(j)(c),
              alt: e(C)(c),
              title: e(C)(c),
              onError: i[0] || (i[0] = //@ts-ignore
              (...N) => e(d) && e(d)(...N))
            }, null, 40, we))), 128)),
            t.value.keystone ? (a(), s("img", {
              key: 0,
              src: e(W)(t.value.keystone),
              alt: e(E)(t.value.keystone),
              title: e(E)(t.value.keystone),
              class: "key",
              onError: i[1] || (i[1] = //@ts-ignore
              (...c) => e(d) && e(d)(...c))
            }, null, 40, $e)) : (a(), s("i", Ie)),
            t.value.subStyle ? (a(), s("img", {
              key: 2,
              src: e(H)(t.value.subStyle),
              alt: e(L)(t.value.subStyle),
              title: e(L)(t.value.subStyle),
              class: "sub",
              onError: i[2] || (i[2] = //@ts-ignore
              (...c) => e(d) && e(d)(...c))
            }, null, 40, Ne)) : (a(), s("i", qe))
          ])),
          l("span", {
            class: "iv-mr-game",
            title: Y.value
          }, [
            l("b", null, [
              l("span", Be, o(O.value), 1),
              l("span", Ee, o(Q.value), 1)
            ]),
            l("small", null, [
              l("span", {
                class: f(["iv-mr-outcome", { lp: r.lp != null && !t.value.remake && !t.value.placement }])
              }, o(X.value), 3),
              p(" · " + o(e(T)(t.value.duration)), 1)
            ])
          ], 8, Se),
          l("span", Ce, [
            l("b", null, [
              p(o(t.value.kills), 1),
              i[6] || (i[6] = l("i", null, "/", -1)),
              p(o(t.value.deaths), 1),
              i[7] || (i[7] = l("i", null, "/", -1)),
              p(o(t.value.assists), 1)
            ]),
            l("small", null, [
              p(o(e(P)(t.value.kills, t.value.deaths, t.value.assists)) + " " + o(e(n)("KDA")), 1),
              R.value != null ? (a(), s("span", Le, " · " + o(e(D)(R.value)) + " " + o(e(n)("KP")), 1)) : v("", !0)
            ])
          ]),
          l("span", Re, [
            l("b", null, [
              p(o(e(A)(t.value.csMin, 1)), 1),
              l("span", Ve, o(e(n)("CS/min")), 1)
            ]),
            l("small", null, o(e(F)(t.value.damage)) + " " + o(e(n)("dmg")), 1)
          ]),
          r.compact ? v("", !0) : (a(), s(y, { key: 1 }, [
            l("span", xe, [
              l("span", ze, [
                (a(!0), s(y, null, z(t.value.items.slice(0, 7), (c, g) => (a(), s(y, { key: g }, [
                  c ? (a(), s("img", {
                    key: 0,
                    src: e(U)(c),
                    alt: e(B)(c),
                    title: e(B)(c),
                    class: f({ trinket: g === 6 }),
                    onError: i[3] || (i[3] = //@ts-ignore
                    (...N) => e(d) && e(d)(...N))
                  }, null, 42, Fe)) : (a(), s("i", {
                    key: 1,
                    class: f({ trinket: g === 6 })
                  }, null, 2))
                ], 64))), 128))
              ]),
              I.value || V.value.length ? (a(), s("span", Me, [
                I.value ? (a(), $(de, {
                  key: 0,
                  verdict: I.value,
                  win: t.value.win
                }, null, 8, ["verdict", "win"])) : v("", !0),
                te(ve, { badges: V.value }, null, 8, ["badges"])
              ])) : v("", !0)
            ]),
            l("span", Pe, [
              b.value ? (a(), s(y, { key: 0 }, [
                l("small", null, o(e(n)("vs")), 1),
                l("span", {
                  class: "iv-mr-portrait",
                  title: e(n)("Lane opponent: {champion}", { champion: e(_)(b.value) })
                }, [
                  l("img", {
                    src: e(S)(b.value),
                    alt: e(_)(b.value)
                  }, null, 8, Ae)
                ], 8, Te)
              ], 64)) : v("", !0)
            ])
          ], 64)),
          l("span", De, [
            r.compact && x.value ? (a(), s("small", {
              key: 0,
              class: f(["iv-mr-place", w.value])
            }, o(x.value), 3)) : v("", !0),
            r.score ? (a(), $(ce, {
              key: 1,
              score: e(K)(r.score.score),
              rank: r.score.rank,
              tag: w.value,
              size: r.compact ? "sm" : "md"
            }, null, 8, ["score", "rank", "tag", "size"])) : v("", !0)
          ]),
          r.compact ? v("", !0) : (a(), $(re, {
            key: 2,
            name: "down",
            size: 15,
            class: "iv-mr-chev"
          }))
        ])
      ], 10, ke),
      k.value ? (a(), $(me, {
        key: 0,
        class: "iv-mr-star",
        saved: e(h).favorites.has(k.value.key),
        label: `${e(n)("Game")} · ${k.value.label}`,
        onToggle: i[5] || (i[5] = (c) => e(h).favorites.toggle(k.value))
      }, null, 8, ["saved", "label"])) : v("", !0)
    ]));
  }
});
export {
  st as default
};
