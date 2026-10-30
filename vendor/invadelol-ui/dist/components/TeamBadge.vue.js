import '../styles/base.css';
import '../styles/primitives.css';
import './TeamBadge.css';
import { defineComponent as n, computed as r, openBlock as l, createElementBlock as c, normalizeClass as s, createVNode as m, createTextVNode as p, toDisplayString as d } from "vue";
import { useInvadeUi as u } from "../context.js";
import { TEAM_RATINGS as v, teamTip as _ } from "../logic/team.js";
import f from "./Icon.vue.js";
/* empty css                 */
/* empty css                       */
const b = ["title", "aria-label"], w = /* @__PURE__ */ n({
  __name: "TeamBadge",
  props: {
    verdict: {},
    win: { type: Boolean }
  },
  setup(t) {
    const e = t, { t: a } = u(), i = r(() => a(v[e.verdict.rating].label)), o = r(() => _(e.verdict, e.win, a));
    return (g, T) => (l(), c("span", {
      class: s(["iv-badge iv-team", t.verdict.rating]),
      title: o.value,
      "aria-label": `${i.value}. ${o.value}`
    }, [
      m(f, {
        name: "users",
        size: 11
      }),
      p(d(i.value), 1)
    ], 10, b));
  }
});
export {
  w as default
};
