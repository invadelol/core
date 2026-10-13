import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
import { defineComponent as B, shallowRef as h, onMounted as M, watch as T, onBeforeUnmount as C, openBlock as i, createElementBlock as s, unref as u, createBlock as N, Fragment as V, createVNode as y, createTextVNode as b, toDisplayString as v, createElementVNode as k, createCommentVNode as z, nextTick as I } from "vue";
import { useInvadeUi as O } from "../context.js";
import { endOfList as A } from "../logic/pager.js";
import { useDelayedFlag as D } from "../stable.js";
import g from "./Icon.vue.js";
import E from "./MatchRowSkeleton.vue.js";
/* empty css                      */
/* empty css                 */
/* empty css                       */
/* empty css                    */
const F = ["aria-busy"], S = {
  key: 2,
  class: "iv-error",
  role: "alert"
}, U = {
  key: 3,
  class: "iv-more-line iv-more-end",
  role: "status"
}, $ = {
  key: 4,
  class: "iv-more-line"
}, W = /* @__PURE__ */ B({
  __name: "MoreMatches",
  props: {
    more: { type: Boolean },
    load: {},
    auto: { type: Boolean, default: !0 }
  },
  setup(c) {
    const t = c, { t: d } = O(), l = A(), e = h("idle"), _ = D(() => e.value === "loading"), o = h(null);
    let r = !1, a;
    async function m(n = !1) {
      if (!t.more || e.value === "loading" || !r || l.held() && !(n && l.ask())) return;
      const f = o.value?.offsetTop;
      e.value = "loading";
      try {
        const p = await t.load();
        if (e.value = "idle", p && typeof p.retryAfterMs == "number") {
          l.hold(p.retryAfterMs);
          return;
        }
        l.clear();
      } catch {
        e.value = "error";
        return;
      }
      t.auto && (await I(), o.value && a && o.value.offsetTop !== f && (a.unobserve(o.value), a.observe(o.value)));
    }
    function w() {
      e.value = "idle", r = !0, m(!0);
    }
    function x() {
      r = !0, m(!0);
    }
    return M(() => {
      a = new IntersectionObserver(
        ([n]) => {
          const f = r;
          r = n.isIntersecting, r && t.auto && m(!f);
        },
        { rootMargin: "240px 0px" }
      ), o.value && a.observe(o.value);
    }), T(
      () => t.more,
      (n) => {
        n && l.clear(), t.auto && m();
      }
    ), C(() => a?.disconnect()), (n, f) => (i(), s("div", {
      ref_key: "el",
      ref: o,
      class: "iv-more",
      "aria-busy": e.value === "loading"
    }, [
      e.value === "loading" && (u(_) || !c.auto) ? (i(), N(E, {
        key: 0,
        count: 3
      })) : e.value === "loading" ? (i(), s(V, { key: 1 }, [], 64)) : e.value === "error" ? (i(), s("p", S, [
        y(g, {
          name: "x",
          size: 15
        }),
        b(v(u(d)("Older games could not be loaded.")) + " ", 1),
        k("button", {
          type: "button",
          class: "iv-btn sm",
          onClick: w
        }, [
          y(g, {
            name: "refresh",
            size: 13
          }),
          b(v(u(d)("Try again")), 1)
        ])
      ])) : c.more ? c.auto ? z("", !0) : (i(), s("p", $, [
        k("button", {
          type: "button",
          class: "iv-btn iv-more-btn",
          onClick: x
        }, [
          y(g, {
            name: "down",
            size: 14
          }),
          b(v(u(d)("Show older games")), 1)
        ])
      ])) : (i(), s("p", U, v(u(d)("That's every tracked game")), 1))
    ], 8, F));
  }
});
export {
  W as default
};
