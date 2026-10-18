import '../styles/accounts.css';
import { defineComponent as C, openBlock as a, createElementBlock as u, createElementVNode as e, createTextVNode as r, toDisplayString as n, unref as o, createVNode as d, withCtx as v, Fragment as h, renderList as $, normalizeClass as _, normalizeStyle as b, createCommentVNode as p, createBlock as z } from "vue";
import { useInvadeUi as w } from "../context.js";
import f from "./Button.vue.js";
import m from "./Icon.vue.js";
import L from "./RankCrest.vue.js";
/* empty css               */
/* empty css                     */
const I = { class: "iv-panel iv-accounts iv-account-dossier" }, S = { class: "iv-accounts-head" }, V = {
  key: 0,
  class: "iv-accounts-empty"
}, A = {
  class: "iv-account-columns",
  "aria-hidden": "true"
}, N = ["onClick"], B = ["src"], P = { class: "iv-account-tier" }, U = { key: 0 }, D = {
  key: 0,
  class: "iv-badge brand"
}, E = {
  key: 2,
  class: "iv-account-dossier-note"
}, q = /* @__PURE__ */ C({
  __name: "AccountRoster",
  props: {
    accounts: {},
    mainPuuid: {},
    busy: { type: Boolean }
  },
  emits: ["main", "open", "verify"],
  setup(c) {
    const { assetUrl: y, t: i } = w(), g = (s) => s.tier ? s.tier.charAt(0) + s.tier.slice(1).toLowerCase() + (s.division ? " " + s.division : "") : i("Unranked");
    return (s, l) => (a(), u("section", I, [
      e("header", S, [
        e("div", null, [
          e("h2", null, [
            r(n(o(i)("Your League accounts")), 1),
            e("small", null, n(c.accounts.length), 1)
          ]),
          e("p", null, n(o(i)("Verified through the Invade desktop app.")), 1)
        ]),
        d(f, {
          size: "sm",
          onClick: l[0] || (l[0] = (t) => s.$emit("verify"))
        }, {
          default: v(() => [
            d(m, {
              name: "plus",
              size: 13
            }),
            r(n(o(i)("Add account")), 1)
          ]),
          _: 1
        })
      ]),
      c.accounts.length ? (a(), u(h, { key: 1 }, [
        e("div", A, [
          e("span", null, n(o(i)("Account")), 1),
          e("span", null, n(o(i)("Solo/Duo")), 1),
          l[2] || (l[2] = e("span", null, null, -1))
        ]),
        (a(!0), u(h, null, $(c.accounts, (t) => (a(), u("div", {
          key: t.puuid,
          class: _(["iv-account-row", { "iv-account-row-main": t.puuid === c.mainPuuid }])
        }, [
          e("button", {
            type: "button",
            class: "iv-account-player",
            onClick: (k) => s.$emit("open", t)
          }, [
            e("img", {
              src: o(y)("profileIcon", t.profileIconId ?? 1),
              alt: "",
              width: "32",
              height: "32"
            }, null, 8, B),
            e("span", null, [
              e("b", null, [
                r(n(t.gameName), 1),
                e("small", null, "#" + n(t.tagLine), 1)
              ]),
              e("em", null, [
                r(n(t.platform.replace(/1$/, "")), 1),
                l[3] || (l[3] = e("i", null, "·", -1)),
                d(m, {
                  name: "shield",
                  size: 11
                }),
                r(n(o(i)("Verified")), 1)
              ])
            ])
          ], 8, N),
          e("span", P, [
            d(L, {
              tier: t.tier,
              size: 24
            }, null, 8, ["tier"]),
            e("span", {
              style: b({
                color: t.tier ? `var(--tier-${t.tier.toLowerCase()})` : void 0
              })
            }, [
              r(n(g(t)), 1),
              t.lp != null ? (a(), u("small", U, n(t.lp) + " LP", 1)) : p("", !0)
            ], 4)
          ]),
          t.puuid === c.mainPuuid ? (a(), u("span", D, n(o(i)("Main account")), 1)) : (a(), z(f, {
            key: 1,
            variant: "ghost",
            size: "sm",
            disabled: c.busy,
            onClick: (k) => s.$emit("main", t.puuid)
          }, {
            default: v(() => [
              r(n(o(i)("Set as main")), 1)
            ]),
            _: 1
          }, 8, ["disabled", "onClick"]))
        ], 2))), 128))
      ], 64)) : (a(), u("div", V, [
        d(m, {
          name: "users",
          size: 24
        }),
        e("h3", null, n(o(i)("Add your first League account")), 1),
        e("p", null, n(o(i)(
          "Sign in to League while Invade is running. The app verifies the account you are using."
        )), 1),
        d(f, {
          onClick: l[1] || (l[1] = (t) => s.$emit("verify"))
        }, {
          default: v(() => [
            r(n(o(i)("Connect the desktop app")), 1),
            d(m, {
              name: "next",
              size: 14
            })
          ]),
          _: 1
        })
      ])),
      c.accounts.length ? (a(), u("footer", E, n(o(i)("Your main opens first. Switching profiles does not change it.")), 1)) : p("", !0)
    ]));
  }
});
export {
  q as default
};
