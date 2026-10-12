import '../styles/base.css';
import '../styles/primitives.css';
import './MatchRowSkeleton.css';
import { defineComponent as t, openBlock as s, createElementBlock as e, Fragment as i, renderList as p, normalizeStyle as r, createStaticVNode as c } from "vue";
/* empty css                 */
/* empty css                       */
const k = {
  class: "iv-mr-skel-list",
  "aria-busy": "true"
}, u = /* @__PURE__ */ t({
  __name: "MatchRowSkeleton",
  props: {
    count: { default: 6 }
  },
  setup(l) {
    return (m, a) => (s(), e("div", k, [
      (s(!0), e(i, null, p(l.count, (n) => (s(), e("div", {
        key: n,
        class: "iv-mr-skel",
        style: r({ opacity: 1 - (n - 1) * (0.6 / l.count) })
      }, [...a[0] || (a[0] = [
        c('<span class="iv-skel iv-mr-skel-champ"></span><span class="iv-mr-skel-lines"><span class="iv-skel" style="width:76%;"></span><span class="iv-skel" style="width:52%;"></span></span><span class="iv-mr-skel-lines"><span class="iv-skel" style="width:64%;"></span><span class="iv-skel" style="width:80%;"></span></span><span class="iv-mr-skel-lines iv-mr-skel-farm"><span class="iv-skel" style="width:58%;"></span><span class="iv-skel" style="width:46%;"></span></span><span class="iv-skel iv-mr-skel-well"></span><span class="iv-mr-skel-lines iv-mr-skel-score"><span class="iv-skel"></span><span class="iv-skel"></span></span>', 6)
      ])], 4))), 128))
    ]));
  }
});
export {
  u as default
};
