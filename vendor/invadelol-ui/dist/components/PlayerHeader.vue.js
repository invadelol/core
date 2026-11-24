import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
import { defineComponent as z, computed as p, openBlock as a, createElementBlock as n, createCommentVNode as c, createElementVNode as l, unref as t, toDisplayString as s, Fragment as m, renderList as h, createVNode as y, createTextVNode as u, normalizeClass as N, normalizeStyle as S } from "vue";
import { useInvadeUi as C, useFormat as I } from "../context.js";
import { tierColor as U, rankLabel as g, count as V } from "../logic/labels.js";
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
}, J = { class: "iv-unit" }, oe = /* @__PURE__ */ z({
  __name: "PlayerHeader",
  props: {
    profile: {},
    games: {},
    badges: {}
  },
  setup(d) {
    const v = d, k = C(), { t: o } = k, { ago: b, pct: w } = I(), r = p(() => v.profile.card), L = p(
      () => [
        { id: "solo", label: o("Solo/Duo"), rank: r.value.solo },
        { id: "flex", label: o("Flex"), rank: r.value.flex }
      ]
    ), f = p(() => {
      const i = v.games[0];
      return i ? b(Math.min(Date.now(), i.creation + i.duration * 1e3)) : "";
    }), _ = p(() => {
      const i = v.profile.champions[0]?.championId ?? r.value.mastery[0]?.championId;
      return i ? k.assetUrl("splash", i) : void 0;
    }), x = (i) => i?.previous ? o("Last season: {tier}", { tier: g({ ...i, tier: i.previous, division: "" }, !1, o) }) : void 0;
    return (i, K) => (a(), n("section", P, [
      _.value ? (a(), n("img", {
        key: 0,
        class: "iv-pf-splash",
        src: _.value,
        alt: "",
        loading: "lazy",
        decoding: "async"
      }, null, 8, B)) : c("", !0),
      l("img", {
        class: "iv-pf-icon",
        src: t(k).assetUrl("profileIcon", r.value.icon),
        alt: ""
      }, null, 8, E),
      l("div", M, [
        l("h2", null, [
          l("span", Y, s(r.value.gameName), 1),
          l("small", null, "#" + s(r.value.tagLine), 1),
          d.profile.isSelf ? (a(), n("span", $, s(t(o)("You")), 1)) : d.profile.isOwn ? (a(), n("span", G, s(t(o)("Your account")), 1)) : c("", !0),
          (a(!0), n(m, null, h(d.badges, (e) => (a(), n("span", {
            key: e,
            class: "iv-badge"
          }, s(e), 1))), 128))
        ]),
        l("p", H, [
          l("span", null, s(t(o)("Level {n}", { n: r.value.level })), 1),
          f.value ? (a(), n("span", O, s(t(o)("Last game {when}", { when: f.value })), 1)) : c("", !0),
          r.value.private ? (a(), n("span", T, [
            y(D, {
              name: "eye",
              size: 12
            }),
            u(s(t(o)("Private profile")), 1)
          ])) : c("", !0)
        ])
      ]),
      l("div", W, [
        (a(!0), n(m, null, h(L.value, (e) => (a(), n("div", {
          key: e.id,
          class: N(["iv-pf-rank", { none: !e.rank }]),
          title: x(e.rank)
        }, [
          y(F, {
            tier: e.rank?.tier,
            size: e.rank ? 40 : 28,
            emblem: ""
          }, null, 8, ["tier", "size"]),
          l("div", null, [
            l("p", null, [
              e.rank ? (a(), n("b", {
                key: 0,
                style: S({ color: t(U)(e.rank.tier) })
              }, s(t(g)(e.rank, !1, t(o))), 5)) : (a(), n("b", q, s(t(o)("Unranked")), 1)),
              e.rank ? (a(), n("span", A, [
                u(s(e.rank.lp), 1),
                l("span", J, s(t(o)("LP")), 1)
              ])) : c("", !0)
            ]),
            l("small", null, [
              u(s(e.label) + " ", 1),
              e.rank && e.rank.losses ? (a(), n(m, { key: 0 }, [
                u(" · " + s(t(o)("{w}W {l}L", { w: e.rank.wins, l: e.rank.losses })) + " · " + s(t(w)(e.rank.wins / Math.max(1, e.rank.wins + e.rank.losses))), 1)
              ], 64)) : e.rank ? (a(), n(m, { key: 1 }, [
                u(" · " + s(t(V)(e.rank.wins, "wins", t(o))), 1)
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
