import '../styles/accounts.css';
import { defineComponent as D, computed as _, openBlock as a, createElementBlock as r, normalizeStyle as b, unref as l, createElementVNode as t, createVNode as m, createTextVNode as d, toDisplayString as i, createCommentVNode as c, renderSlot as C, Fragment as p, renderList as P, withCtx as I, createBlock as V, normalizeClass as M } from "vue";
import { useInvadeUi as R, useFormat as T } from "../context.js";
import { tierColor as $ } from "../logic/labels.js";
import N from "./Button.vue.js";
import g from "./Icon.vue.js";
import A from "./RankCrest.vue.js";
/* empty css               */
/* empty css                     */
const U = ["aria-busy"], F = ["aria-label"], x = ["src"], G = { class: "iv-roster-main-who" }, H = { class: "iv-roster-kicker" }, j = { key: 0 }, q = {
  key: 1,
  class: "iv-roster-live"
}, J = { class: "iv-roster-main-rank" }, K = { key: 0 }, Q = { key: 1 }, W = {
  key: 1,
  class: "iv-panel iv-roster-rest"
}, X = {
  key: 0,
  class: "iv-roster-label"
}, Y = {
  key: 1,
  class: "iv-roster-list"
}, Z = ["aria-label", "onClick"], ee = ["src"], te = { class: "iv-roster-who" }, ie = { class: "iv-roster-live" }, se = { class: "iv-roster-extra" }, le = { class: "iv-roster-rank" }, ne = { key: 0 }, oe = ["aria-label", "onClick"], ae = ["src"], re = { class: "iv-roster-who" }, ue = { class: "iv-roster-extra" }, ce = { class: "iv-roster-rank" }, de = { key: 0 }, ve = ["title"], me = { class: "iv-roster-add-mark" }, he = { class: "iv-roster-add-copy" }, ge = { key: 0 }, ke = { key: 1 }, ze = /* @__PURE__ */ D({
  __name: "AccountRoster",
  props: {
    accounts: {},
    mainPuuid: {},
    pending: {},
    current: {},
    busy: { type: Boolean }
  },
  emits: ["main", "open", "verify"],
  setup(h) {
    const v = h, { assetUrl: w, t: n } = R(), { date: E } = T(), o = _(() => v.accounts.find((s) => s.puuid === v.mainPuuid) ?? null), f = _(() => v.accounts.filter((s) => s.puuid !== v.mainPuuid)), k = _(() => (v.pending ?? []).filter((s) => !v.accounts.some((u) => u.puuid === s.puuid))), B = _(() => k.value.some((s) => s.puuid === v.current)), S = _(() => v.current === void 0 || !!v.current && !v.accounts.some((s) => s.puuid === v.current)), y = (s) => s.platform.replace(/\d+$/, ""), L = (s) => s.tier ? s.tier.charAt(0) + s.tier.slice(1).toLowerCase() + (s.division && !/MASTER|CHALLENGER/.test(s.tier) ? " " + s.division : "") : n("Unranked"), O = (s) => s.verifiedAt ? n("Verified {when}", { when: E(Date.parse(s.verifiedAt), { day: "numeric", month: "short" }) }) : n("Verified");
    return (s, u) => (a(), r("section", {
      class: "iv-roster",
      "aria-busy": h.busy
    }, [
      o.value ? (a(), r("article", {
        key: 0,
        class: "iv-panel iv-roster-main",
        style: b({ "--tier": o.value.tier ? l($)(o.value.tier) : "var(--text-4)" })
      }, [
        t("button", {
          type: "button",
          class: "iv-roster-hit",
          "aria-label": `${l(n)("Open profile")} · ${o.value.gameName}#${o.value.tagLine}`,
          onClick: u[0] || (u[0] = (e) => s.$emit("open", o.value))
        }, null, 8, F),
        t("img", {
          class: "iv-roster-main-icon",
          src: l(w)("profileIcon", o.value.profileIconId ?? 1),
          alt: "",
          width: "64",
          height: "64"
        }, null, 8, x),
        t("div", G, [
          t("span", H, [
            m(g, {
              name: "crown",
              size: 12
            }),
            d(i(l(n)("Main account")), 1)
          ]),
          t("h3", null, [
            d(i(o.value.gameName), 1),
            t("small", null, "#" + i(o.value.tagLine), 1)
          ]),
          t("p", null, [
            y(o.value) ? (a(), r("span", j, i(y(o.value)), 1)) : c("", !0),
            t("span", null, [
              m(g, {
                name: "shield",
                size: 11
              }),
              d(i(O(o.value)), 1)
            ]),
            o.value.puuid === h.current ? (a(), r("span", q, i(l(n)("In League now")), 1)) : c("", !0)
          ]),
          C(s.$slots, "extra", { profile: o.value })
        ]),
        t("div", J, [
          m(A, {
            tier: o.value.tier,
            size: o.value.tier ? 56 : 36,
            emblem: ""
          }, null, 8, ["tier", "size"]),
          t("span", null, [
            t("b", {
              style: b({ color: o.value.tier ? l($)(o.value.tier) : void 0 })
            }, i(L(o.value)), 5),
            o.value.lp != null && o.value.tier ? (a(), r("small", K, i(o.value.lp) + " " + i(l(n)("LP")), 1)) : (a(), r("small", Q, i(l(n)("Solo/Duo")), 1))
          ])
        ]),
        m(g, {
          name: "right",
          size: 16,
          class: "iv-roster-go"
        })
      ], 4)) : c("", !0),
      f.value.length || k.value.length || !o.value ? (a(), r("div", W, [
        o.value && (f.value.length || k.value.length) ? (a(), r("h3", X, i(l(n)("Other accounts")), 1)) : c("", !0),
        f.value.length || k.value.length ? (a(), r("ul", Y, [
          (a(!0), r(p, null, P(f.value, (e) => (a(), r("li", {
            key: e.puuid,
            class: "iv-roster-row"
          }, [
            t("button", {
              type: "button",
              class: "iv-roster-hit",
              "aria-label": `${l(n)("Open profile")} · ${e.gameName}#${e.tagLine}`,
              onClick: (z) => s.$emit("open", e)
            }, null, 8, Z),
            t("img", {
              src: l(w)("profileIcon", e.profileIconId ?? 1),
              alt: "",
              width: "36",
              height: "36"
            }, null, 8, ee),
            t("span", te, [
              t("b", null, [
                d(i(e.gameName), 1),
                t("small", null, "#" + i(e.tagLine), 1)
              ]),
              t("em", null, [
                y(e) ? (a(), r(p, { key: 0 }, [
                  d(i(y(e)), 1),
                  u[3] || (u[3] = t("i", null, "·", -1))
                ], 64)) : c("", !0),
                m(g, {
                  name: "shield",
                  size: 11
                }),
                d(i(l(n)("Verified")), 1),
                e.puuid === h.current ? (a(), r(p, { key: 1 }, [
                  u[4] || (u[4] = t("i", null, "·", -1)),
                  t("span", ie, i(l(n)("In League now")), 1)
                ], 64)) : c("", !0)
              ])
            ]),
            t("span", se, [
              C(s.$slots, "extra", { profile: e })
            ]),
            t("span", le, [
              m(A, {
                tier: e.tier,
                size: 22
              }, null, 8, ["tier"]),
              t("span", null, [
                t("b", {
                  style: b({ color: e.tier ? l($)(e.tier) : void 0 })
                }, i(L(e)), 5),
                e.lp != null && e.tier ? (a(), r("small", ne, i(e.lp) + " " + i(l(n)("LP")), 1)) : c("", !0)
              ])
            ]),
            m(N, {
              class: "iv-roster-make",
              variant: "ghost",
              size: "sm",
              disabled: h.busy,
              onClick: (z) => s.$emit("main", e.puuid)
            }, {
              default: I(() => [
                m(g, {
                  name: "crown",
                  size: 13
                }),
                d(i(l(n)("Make main")), 1)
              ]),
              _: 1
            }, 8, ["disabled", "onClick"])
          ]))), 128)),
          (a(!0), r(p, null, P(k.value, (e) => (a(), r("li", {
            key: e.puuid,
            class: "iv-roster-row pending"
          }, [
            t("button", {
              type: "button",
              class: "iv-roster-hit",
              "aria-label": `${l(n)("Open profile")} · ${e.gameName}#${e.tagLine}`,
              onClick: (z) => s.$emit("open", e)
            }, null, 8, oe),
            t("img", {
              src: l(w)("profileIcon", e.profileIconId ?? 1),
              alt: "",
              width: "36",
              height: "36"
            }, null, 8, ae),
            t("span", re, [
              t("b", null, [
                d(i(e.gameName), 1),
                t("small", null, "#" + i(e.tagLine), 1)
              ]),
              t("em", null, [
                y(e) ? (a(), r(p, { key: 0 }, [
                  d(i(y(e)), 1),
                  u[5] || (u[5] = t("i", null, "·", -1))
                ], 64)) : c("", !0),
                d(i(e.puuid === h.current ? l(n)("Signed in to League") : l(n)("Not linked yet")), 1)
              ])
            ]),
            t("span", ue, [
              C(s.$slots, "extra", { profile: e })
            ]),
            t("span", ce, [
              m(A, {
                tier: e.tier,
                size: 22
              }, null, 8, ["tier"]),
              t("span", null, [
                t("b", {
                  style: b({ color: e.tier ? l($)(e.tier) : void 0 })
                }, i(L(e)), 5),
                e.lp != null && e.tier ? (a(), r("small", de, i(e.lp) + " " + i(l(n)("LP")), 1)) : c("", !0)
              ])
            ]),
            e.puuid === h.current ? (a(), V(N, {
              key: 0,
              class: "iv-roster-link",
              size: "sm",
              disabled: h.busy,
              onClick: u[1] || (u[1] = (z) => s.$emit("verify"))
            }, {
              default: I(() => [
                m(g, {
                  name: "plus",
                  size: 13
                }),
                d(i(l(n)("Link")), 1)
              ]),
              _: 1
            }, 8, ["disabled"])) : (a(), r("span", {
              key: 1,
              class: "iv-roster-hint",
              title: l(n)("Sign in to League with this account to link it.")
            }, i(l(n)("Sign in to link")), 9, ve))
          ]))), 128))
        ])) : c("", !0),
        B.value ? c("", !0) : (a(), r("div", {
          key: 2,
          class: M(["iv-roster-add", { alone: !f.value.length && !k.value.length }])
        }, [
          t("span", me, [
            m(g, {
              name: "plus",
              size: 16
            })
          ]),
          t("span", he, [
            t("b", null, i(h.accounts.length ? l(n)("Add another account") : l(n)("Add your League account")), 1),
            S.value ? (a(), r("small", ge, i(l(n)("Sign in to League with it while Invade is open. The app checks that it’s yours.")), 1)) : (a(), r("small", ke, i(l(n)("Sign in to League with it and it shows up here, ready to link.")), 1))
          ]),
          S.value ? (a(), V(N, {
            key: 0,
            size: "sm",
            disabled: h.busy,
            onClick: u[2] || (u[2] = (e) => s.$emit("verify"))
          }, {
            default: I(() => [
              d(i(l(n)("Add account")), 1)
            ]),
            _: 1
          }, 8, ["disabled"])) : c("", !0)
        ], 2))
      ])) : c("", !0)
    ], 8, U));
  }
});
export {
  ze as default
};
