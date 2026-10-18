import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
import '../styles/accounts.css';
import { defineComponent as g, openBlock as n, createElementBlock as c, createElementVNode as i, toDisplayString as s, unref as a, createVNode as r, withCtx as h, createTextVNode as m, Fragment as b, renderList as p, createCommentVNode as _, normalizeStyle as $, createBlock as C } from "vue";
import { useInvadeUi as L } from "../context.js";
import { tierColor as N } from "../logic/labels.js";
import f from "./Button.vue.js";
import w from "./Icon.vue.js";
import z from "./RankCrest.vue.js";
/* empty css               */
/* empty css                 */
/* empty css                       */
/* empty css                    */
/* empty css                     */
const A = { class: "iv-panel iv-pf-panel iv-acc" }, E = { class: "iv-panel-head" }, B = { class: "meta" }, I = { class: "actions" }, V = {
  key: 0,
  class: "iv-acc-rows"
}, M = ["aria-label", "onClick"], P = ["src"], R = { class: "iv-acc-who" }, S = { key: 0 }, U = { class: "iv-acc-rank" }, T = { key: 0 }, x = { class: "iv-acc-main" }, D = {
  key: 0,
  class: "iv-badge brand"
}, F = {
  key: 1,
  class: "iv-pf-note"
}, Z = /* @__PURE__ */ g({
  __name: "AccountRoster",
  props: {
    accounts: {},
    mainPuuid: {},
    busy: { type: Boolean }
  },
  emits: ["main", "open", "verify"],
  setup(l) {
    const { assetUrl: v, t: o } = L(), d = (t) => t.platform.replace(/\d+$/, ""), k = (t) => t.tier ? t.tier.charAt(0) + t.tier.slice(1).toLowerCase() + (t.division && !/MASTER|CHALLENGER/.test(t.tier) ? " " + t.division : "") : o("Unranked");
    return (t, u) => (n(), c("section", A, [
      i("header", E, [
        i("h3", null, s(a(o)("League accounts")), 1),
        i("span", B, s(l.accounts.length), 1),
        i("span", I, [
          r(f, {
            variant: "ghost",
            size: "sm",
            disabled: l.busy,
            onClick: u[0] || (u[0] = (e) => t.$emit("verify"))
          }, {
            default: h(() => [
              r(w, {
                name: "plus",
                size: 13
              }),
              m(s(a(o)("Add account")), 1)
            ]),
            _: 1
          }, 8, ["disabled"])
        ])
      ]),
      l.accounts.length ? (n(), c("ul", V, [
        (n(!0), c(b, null, p(l.accounts, (e) => (n(), c("li", {
          key: e.puuid
        }, [
          i("button", {
            type: "button",
            class: "iv-acc-hit",
            "aria-label": `${a(o)("Open profile")} · ${e.gameName}#${e.tagLine}`,
            onClick: (y) => t.$emit("open", e)
          }, null, 8, M),
          i("img", {
            src: a(v)("profileIcon", e.profileIconId ?? 1),
            alt: "",
            width: "30",
            height: "30"
          }, null, 8, P),
          i("span", R, [
            i("b", null, [
              m(s(e.gameName), 1),
              i("small", null, "#" + s(e.tagLine), 1)
            ]),
            d(e) ? (n(), c("small", S, s(d(e)), 1)) : _("", !0)
          ]),
          i("span", U, [
            r(z, {
              tier: e.tier,
              size: 16
            }, null, 8, ["tier"]),
            i("b", {
              style: $({ color: e.tier ? a(N)(e.tier) : void 0 })
            }, s(k(e)), 5),
            e.tier && e.lp != null ? (n(), c("small", T, s(e.lp) + " " + s(a(o)("LP")), 1)) : _("", !0)
          ]),
          i("span", x, [
            e.puuid === l.mainPuuid ? (n(), c("span", D, s(a(o)("Main")), 1)) : (n(), C(f, {
              key: 1,
              class: "iv-acc-make",
              variant: "ghost",
              size: "sm",
              disabled: l.busy,
              onClick: (y) => t.$emit("main", e.puuid)
            }, {
              default: h(() => [
                m(s(a(o)("Make main")), 1)
              ]),
              _: 1
            }, 8, ["disabled", "onClick"]))
          ])
        ]))), 128))
      ])) : (n(), c("p", F, s(a(o)("No League account linked yet.")), 1))
    ]));
  }
});
export {
  Z as default
};
