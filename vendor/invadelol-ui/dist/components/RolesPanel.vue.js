import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
import { defineComponent as f, useModel as v, computed as k, openBlock as i, createElementBlock as c, createElementVNode as o, toDisplayString as a, unref as t, Fragment as y, renderList as g, normalizeClass as C, createVNode as b, normalizeStyle as N, createCommentVNode as w, mergeModels as M } from "vue";
import { useInvadeUi as S, useFormat as V } from "../context.js";
import { positionName as d, count as $ } from "../logic/labels.js";
import x from "./RoleIcon.vue.js";
/* empty css                 */
/* empty css                       */
/* empty css                    */
const z = {
  key: 0,
  class: "iv-panel iv-pf-panel iv-pf-roles"
}, B = { class: "iv-panel-head" }, E = ["title", "onClick"], F = { class: "iv-pf-role-name" }, R = { class: "iv-pf-share" }, q = { class: "iv-pf-role-n" }, D = { class: "iv-pf-role-pct" }, J = /* @__PURE__ */ f({
  __name: "RolesPanel",
  props: /* @__PURE__ */ M({
    lanes: {}
  }, {
    role: { required: !0 },
    roleModifiers: {}
  }),
  emits: ["update:role"],
  setup(p) {
    const m = p, r = v(p, "role"), { t: n } = S(), { pct: _ } = V(), u = k(() => {
      const l = m.lanes.reduce((s, [, e]) => s + e, 0);
      return m.lanes.map(([s, e]) => ({ lane: s, n: e, share: l ? e / l : 0 }));
    }), h = (l) => r.value = r.value === l ? "" : l;
    return (l, s) => u.value.length ? (i(), c("section", z, [
      o("header", B, [
        o("h3", null, a(t(n)("Roles")), 1)
      ]),
      o("ul", null, [
        (i(!0), c(y, null, g(u.value, (e) => (i(), c("li", {
          key: e.lane
        }, [
          o("button", {
            type: "button",
            class: C({ on: r.value === e.lane }),
            title: t(n)("Show only {role} games", { role: t(d)(e.lane, t(n)) }),
            onClick: (I) => h(e.lane)
          }, [
            b(x, {
              lane: e.lane
            }, null, 8, ["lane"]),
            o("span", F, a(t(d)(e.lane, t(n))), 1),
            o("i", R, [
              o("b", {
                style: N({ width: `${e.share * 100}%` })
              }, null, 4)
            ]),
            o("span", q, a(t($)(e.n, "games", t(n))), 1),
            o("b", D, a(t(_)(e.share)), 1)
          ], 10, E)
        ]))), 128))
      ])
    ])) : w("", !0);
  }
});
export {
  J as default
};
