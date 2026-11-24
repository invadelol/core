import '../styles/base.css';
import './MatchTags.css';
import { defineComponent as f, computed as c, openBlock as s, createElementBlock as r, createElementVNode as g, unref as e, createBlock as i, createCommentVNode as m, createTextVNode as y, toDisplayString as h, Fragment as x, renderList as z } from "vue";
/* empty css                 */
import { useInvadeUi as B } from "../context.js";
import { topBadges as E, BADGES as o } from "../logic/labels.js";
import p from "./Icon.vue.js";
import _ from "./StatIcon.vue.js";
const N = {
  key: 0,
  class: "iv-tags"
}, V = ["title"], b = ["title", "aria-label"], q = /* @__PURE__ */ f({
  __name: "MatchTags",
  props: {
    badges: {},
    max: { default: 4 }
  },
  setup(v) {
    const u = v, { t: l } = B(), t = {
      penta: { icon: "zap" },
      quadra: { stat: "kda" },
      triple: { stat: "kda" },
      lane_won: { icon: "trend" },
      carry_damage: { stat: "damage" },
      deathless: { icon: "shield" },
      first_blood: { icon: "skull" },
      objectives: { icon: "target" },
      vision: { stat: "vision" },
      tank: { stat: "taken" },
      cc: { icon: "clock" }
    }, d = c(() => E(u.badges, u.max)), n = c(() => d.value[0]), k = c(() => d.value.slice(1));
    return (C, D) => n.value ? (s(), r("span", N, [
      g("span", {
        class: "iv-tag lead",
        title: e(l)(e(o)[n.value].tip)
      }, [
        t[n.value]?.stat ? (s(), i(_, {
          key: 0,
          name: t[n.value].stat,
          size: 12
        }, null, 8, ["name"])) : t[n.value]?.icon ? (s(), i(p, {
          key: 1,
          name: t[n.value].icon,
          size: 12
        }, null, 8, ["name"])) : m("", !0),
        y(" " + h(e(l)(e(o)[n.value].label)), 1)
      ], 8, V),
      (s(!0), r(x, null, z(k.value, (a) => (s(), r("span", {
        key: a,
        class: "iv-tag tile",
        title: e(l)(e(o)[a].label) + " · " + e(l)(e(o)[a].tip),
        "aria-label": e(l)(e(o)[a].label)
      }, [
        t[a]?.stat ? (s(), i(_, {
          key: 0,
          name: t[a].stat,
          size: 11
        }, null, 8, ["name"])) : t[a]?.icon ? (s(), i(p, {
          key: 1,
          name: t[a].icon,
          size: 11
        }, null, 8, ["name"])) : m("", !0)
      ], 8, b))), 128))
    ])) : m("", !0);
  }
});
export {
  q as default
};
