import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
import { defineComponent as x, shallowRef as h, onMounted as B, watch as M, onBeforeUnmount as T, openBlock as s, createElementBlock as d, createBlock as C, createVNode as y, createTextVNode as b, toDisplayString as m, unref as f, createElementVNode as k, createCommentVNode as N, nextTick as V } from "vue";
import { useInvadeUi as z } from "../context.js";
import { endOfList as I } from "../logic/pager.js";
import _ from "./Icon.vue.js";
import O from "./MatchRowSkeleton.vue.js";
/* empty css                      */
/* empty css                 */
/* empty css                       */
/* empty css                    */
const A = ["aria-busy"], E = {
  key: 1,
  class: "iv-error",
  role: "alert"
}, S = {
  key: 2,
  class: "iv-more-line iv-more-end",
  role: "status"
}, U = {
  key: 3,
  class: "iv-more-line"
}, J = /* @__PURE__ */ x({
  __name: "MoreMatches",
  props: {
    more: { type: Boolean },
    load: {},
    auto: { type: Boolean, default: !0 }
  },
  setup(v) {
    const o = v, { t: l } = z(), i = I(), e = h("idle"), t = h(null);
    let r = !1, n;
    async function u(a = !1) {
      if (!o.more || e.value === "loading" || !r || i.held() && !(a && i.ask())) return;
      const c = t.value?.offsetTop;
      e.value = "loading";
      try {
        const p = await o.load();
        if (e.value = "idle", p && typeof p.retryAfterMs == "number") {
          i.hold(p.retryAfterMs);
          return;
        }
        i.clear();
      } catch {
        e.value = "error";
        return;
      }
      o.auto && (await V(), t.value && n && t.value.offsetTop !== c && (n.unobserve(t.value), n.observe(t.value)));
    }
    function g() {
      e.value = "idle", r = !0, u(!0);
    }
    function w() {
      r = !0, u(!0);
    }
    return B(() => {
      n = new IntersectionObserver(
        ([a]) => {
          const c = r;
          r = a.isIntersecting, r && o.auto && u(!c);
        },
        { rootMargin: "240px 0px" }
      ), t.value && n.observe(t.value);
    }), M(
      () => o.more,
      (a) => {
        a && i.clear(), o.auto && u();
      }
    ), T(() => n?.disconnect()), (a, c) => (s(), d("div", {
      ref_key: "el",
      ref: t,
      class: "iv-more",
      "aria-busy": e.value === "loading"
    }, [
      e.value === "loading" ? (s(), C(O, {
        key: 0,
        count: 3
      })) : e.value === "error" ? (s(), d("p", E, [
        y(_, {
          name: "x",
          size: 15
        }),
        b(m(f(l)("Older games could not be loaded.")) + " ", 1),
        k("button", {
          type: "button",
          class: "iv-btn sm",
          onClick: g
        }, [
          y(_, {
            name: "refresh",
            size: 13
          }),
          b(m(f(l)("Try again")), 1)
        ])
      ])) : v.more ? v.auto ? N("", !0) : (s(), d("p", U, [
        k("button", {
          type: "button",
          class: "iv-btn iv-more-btn",
          onClick: w
        }, [
          y(_, {
            name: "down",
            size: 14
          }),
          b(m(f(l)("Show older games")), 1)
        ])
      ])) : (s(), d("p", S, m(f(l)("That's every tracked game")), 1))
    ], 8, A));
  }
});
export {
  J as default
};
