import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
import { defineComponent as n, openBlock as l, createElementBlock as a, Fragment as t, createStaticVNode as d, createElementVNode as e, createVNode as v, renderSlot as p, normalizeClass as r, createCommentVNode as f } from "vue";
import k from "./MatchRowSkeleton.vue.js";
/* empty css                      */
/* empty css                 */
/* empty css                       */
/* empty css                    */
const c = { class: "iv-pf" }, m = { class: "iv-pf-cols" }, u = { class: "iv-pf-feed" }, y = {
  key: 0,
  class: "iv-pf-side"
}, B = /* @__PURE__ */ n({
  __name: "ProfileLayout",
  props: {
    loading: { type: Boolean }
  },
  setup(o) {
    return (i, s) => (l(), a("div", c, [
      o.loading ? (l(), a(t, { key: 0 }, [
        s[3] || (s[3] = d('<div class="iv-pf-head iv-pf-head-skel" aria-busy="true"><span class="iv-skel iv-pf-skel-icon"></span><span class="iv-pf-skel-lines"><span class="iv-skel" style="width:180px;height:18px;"></span><span class="iv-skel" style="width:120px;height:11px;"></span></span><span class="iv-pf-skel-ranks"><span class="iv-skel"></span><span class="iv-skel"></span></span></div>', 1)),
        e("div", m, [
          s[2] || (s[2] = e("aside", { class: "iv-pf-side" }, [
            e("div", {
              class: "iv-skel iv-pf-skel-panel",
              style: { height: "228px" }
            }),
            e("div", {
              class: "iv-skel iv-pf-skel-panel",
              style: { height: "300px" }
            })
          ], -1)),
          e("section", u, [
            s[0] || (s[0] = e("div", { class: "iv-skel iv-pf-skel-bar" }, null, -1)),
            s[1] || (s[1] = e("span", { class: "iv-skel iv-pf-skel-day" }, null, -1)),
            v(k, { count: 7 })
          ])
        ])
      ], 64)) : (l(), a(t, { key: 1 }, [
        p(i.$slots, "header"),
        e("div", {
          class: r(["iv-pf-cols", { solo: !i.$slots.side }])
        }, [
          i.$slots.side ? (l(), a("aside", y, [
            p(i.$slots, "side")
          ])) : f("", !0),
          p(i.$slots, "default")
        ], 2)
      ], 64))
    ]));
  }
});
export {
  B as default
};
