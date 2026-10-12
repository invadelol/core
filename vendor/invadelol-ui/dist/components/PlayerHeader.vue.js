import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
import { defineComponent as x, computed as u, openBlock as t, createElementBlock as o, createCommentVNode as c, createElementVNode as l, unref as s, toDisplayString as a, createVNode as h, createTextVNode as p, Fragment as k, renderList as z, normalizeClass as N, normalizeStyle as S } from "vue";
import { useInvadeUi as C, useFormat as I } from "../context.js";
import { tierColor as U, rankLabel as y, count as V } from "../logic/labels.js";
import D from "./Icon.vue.js";
import F from "./RankCrest.vue.js";
/* empty css               */
/* empty css                 */
/* empty css                       */
/* empty css                    */
const P = { class: "iv-pf-head" }, B = ["src"], E = ["src"], M = { class: "iv-pf-who" }, Y = { class: "iv-pf-name" }, $ = {
  key: 0,
  class: "iv-badge brand"
}, G = {
  key: 1,
  class: "iv-badge brand"
}, H = { class: "iv-pf-meta" }, O = { key: 0 }, T = {
  key: 1,
  class: "iv-pf-flag"
}, W = { class: "iv-pf-ranks" }, j = ["title"], q = {
  key: 1,
  class: "iv-pf-unranked"
}, A = {
  key: 2,
  class: "iv-pf-lp"
}, J = { class: "iv-unit" }, oe = /* @__PURE__ */ x({
  __name: "PlayerHeader",
  props: {
    profile: {},
    games: {}
  },
  setup(d) {
    const m = d, v = C(), { t: n } = v, { ago: g, pct: w } = I(), r = u(() => m.profile.card), b = u(
      () => [
        { id: "solo", label: n("Solo/Duo"), rank: r.value.solo },
        { id: "flex", label: n("Flex"), rank: r.value.flex }
      ]
    ), _ = u(() => {
      const i = m.games[0];
      return i ? g(Math.min(Date.now(), i.creation + i.duration * 1e3)) : "";
    }), f = u(() => {
      const i = m.profile.champions[0]?.championId ?? r.value.mastery[0]?.championId;
      return i ? v.assetUrl("splash", i) : void 0;
    }), L = (i) => i?.previous ? n("Last season: {tier}", { tier: y({ ...i, tier: i.previous, division: "" }, !1, n) }) : void 0;
    return (i, K) => (t(), o("section", P, [
      f.value ? (t(), o("img", {
        key: 0,
        class: "iv-pf-splash",
        src: f.value,
        alt: "",
        loading: "lazy",
        decoding: "async"
      }, null, 8, B)) : c("", !0),
      l("img", {
        class: "iv-pf-icon",
        src: s(v).assetUrl("profileIcon", r.value.icon),
        alt: ""
      }, null, 8, E),
      l("div", M, [
        l("h2", null, [
          l("span", Y, a(r.value.gameName), 1),
          l("small", null, "#" + a(r.value.tagLine), 1),
          d.profile.isSelf ? (t(), o("span", $, a(s(n)("You")), 1)) : d.profile.isOwn ? (t(), o("span", G, a(s(n)("Your account")), 1)) : c("", !0)
        ]),
        l("p", H, [
          l("span", null, a(s(n)("Level {n}", { n: r.value.level })), 1),
          _.value ? (t(), o("span", O, a(s(n)("Last game {when}", { when: _.value })), 1)) : c("", !0),
          r.value.private ? (t(), o("span", T, [
            h(D, {
              name: "eye",
              size: 12
            }),
            p(a(s(n)("Private profile")), 1)
          ])) : c("", !0)
        ])
      ]),
      l("div", W, [
        (t(!0), o(k, null, z(b.value, (e) => (t(), o("div", {
          key: e.id,
          class: N(["iv-pf-rank", { none: !e.rank }]),
          title: L(e.rank)
        }, [
          h(F, {
            tier: e.rank?.tier,
            size: e.rank ? 40 : 28,
            emblem: ""
          }, null, 8, ["tier", "size"]),
          l("div", null, [
            l("p", null, [
              e.rank ? (t(), o("b", {
                key: 0,
                style: S({ color: s(U)(e.rank.tier) })
              }, a(s(y)(e.rank, !1, s(n))), 5)) : (t(), o("b", q, a(s(n)("Unranked")), 1)),
              e.rank ? (t(), o("span", A, [
                p(a(e.rank.lp), 1),
                l("span", J, a(s(n)("LP")), 1)
              ])) : c("", !0)
            ]),
            l("small", null, [
              p(a(e.label) + " ", 1),
              e.rank && e.rank.losses ? (t(), o(k, { key: 0 }, [
                p(" · " + a(s(n)("{w}W {l}L", { w: e.rank.wins, l: e.rank.losses })) + " · " + a(s(w)(e.rank.wins / Math.max(1, e.rank.wins + e.rank.losses))), 1)
              ], 64)) : e.rank ? (t(), o(k, { key: 1 }, [
                p(" · " + a(s(V)(e.rank.wins, "wins", s(n))), 1)
              ], 64)) : c("", !0)
            ])
          ])
        ], 10, j))), 128))
      ])
    ]));
  }
});
export {
  oe as default
};
