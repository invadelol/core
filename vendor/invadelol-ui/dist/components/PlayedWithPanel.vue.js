import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
import { defineComponent as p, openBlock as l, createElementBlock as i, createElementVNode as a, toDisplayString as n, unref as t, Fragment as g, renderList as h, createVNode as _, withCtx as f, createTextVNode as y, createCommentVNode as m } from "vue";
import { useInvadeUi as w, useFormat as k } from "../context.js";
import N from "./Link.vue.js";
/* empty css                 */
/* empty css                       */
/* empty css                    */
const v = {
  key: 0,
  class: "iv-panel iv-pf-panel iv-pf-mates"
}, L = { class: "iv-panel-head" }, x = { class: "meta" }, V = { key: 0 }, C = ["src"], P = { class: "iv-pf-mate-who" }, U = { key: 0 }, $ = { class: "iv-pf-mate-wr" }, b = {
  key: 1,
  class: "iv-pf-note"
}, S = /* @__PURE__ */ p({
  __name: "PlayedWithPanel",
  props: {
    data: {}
  },
  setup(o) {
    const r = w(), { t: s } = r, { ago: d, num: c, pct: u } = k();
    return (B, E) => o.data && o.data.games ? (l(), i("section", v, [
      a("header", L, [
        a("h3", null, n(t(s)("Played with")), 1),
        a("span", x, n(t(s)("Last {n} games", { n: t(c)(o.data.games) })), 1)
      ]),
      o.data.mates.length ? (l(), i("ul", V, [
        (l(!0), i(g, null, h(o.data.mates, (e) => (l(), i("li", {
          key: e.puuid
        }, [
          _(N, {
            to: { kind: "player", puuid: e.puuid, gameName: e.gameName, tagLine: e.tagLine },
            title: t(s)("Open {name}’s profile", { name: `${e.gameName}#${e.tagLine}` })
          }, {
            default: f(() => [
              a("img", {
                src: t(r).assetUrl("profileIcon", e.icon),
                alt: "",
                loading: "lazy"
              }, null, 8, C),
              a("span", P, [
                a("b", null, [
                  y(n(e.gameName || t(s)("Unknown player")), 1),
                  e.tagLine ? (l(), i("small", U, "#" + n(e.tagLine), 1)) : m("", !0)
                ]),
                a("small", null, n(t(s)("{n} games", { n: t(c)(e.games) })) + " · " + n(t(d)(e.last)), 1)
              ]),
              a("span", $, [
                a("b", null, n(t(u)(e.wins / e.games)), 1),
                a("small", null, n(t(s)("{w}W {l}L", { w: e.wins, l: e.games - e.wins })), 1)
              ])
            ]),
            _: 2
          }, 1032, ["to", "title"])
        ]))), 128))
      ])) : (l(), i("p", b, n(t(s)("No regular teammates in these games.")), 1))
    ])) : m("", !0);
  }
});
export {
  S as default
};
