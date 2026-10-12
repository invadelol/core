import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
import { defineComponent as g, shallowRef as y, onMounted as x, watch as w, onBeforeUnmount as M, openBlock as i, createElementBlock as d, createBlock as T, createVNode as _, createTextVNode as b, toDisplayString as f, unref as v, createElementVNode as B, createCommentVNode as N, nextTick as V } from "vue";
import { useInvadeUi as C } from "../context.js";
import { endOfList as I } from "../logic/pager.js";
import h from "./Icon.vue.js";
import O from "./MatchRowSkeleton.vue.js";
/* empty css                      */
/* empty css                 */
/* empty css                       */
/* empty css                    */
const z = ["aria-busy"], A = {
  key: 1,
  class: "iv-error",
  role: "alert"
}, E = {
  key: 2,
  class: "iv-more-line iv-more-end",
  role: "status"
}, G = /* @__PURE__ */ g({
  __name: "MoreMatches",
  props: {
    more: { type: Boolean },
    load: { type: Function }
  },
  setup(p) {
    const l = p, { t: c } = C(), n = I(), e = y("idle"), t = y(null);
    let a = !1, o;
    async function u(r = !1) {
      if (!l.more || e.value === "loading" || !a || n.held() && !(r && n.ask())) return;
      const s = t.value?.offsetTop;
      e.value = "loading";
      try {
        const m = await l.load();
        if (e.value = "idle", m && typeof m.retryAfterMs == "number") {
          n.hold(m.retryAfterMs);
          return;
        }
        n.clear();
      } catch {
        e.value = "error";
        return;
      }
      await V(), t.value && o && t.value.offsetTop !== s && (o.unobserve(t.value), o.observe(t.value));
    }
    function k() {
      e.value = "idle", a = !0, u(!0);
    }
    return x(() => {
      o = new IntersectionObserver(
        ([r]) => {
          const s = a;
          a = r.isIntersecting, a && u(!s);
        },
        { rootMargin: "240px 0px" }
      ), t.value && o.observe(t.value);
    }), w(
      () => l.more,
      (r) => {
        r && n.clear(), u();
      }
    ), M(() => o?.disconnect()), (r, s) => (i(), d("div", {
      ref_key: "el",
      ref: t,
      class: "iv-more",
      "aria-busy": e.value === "loading"
    }, [
      e.value === "loading" ? (i(), T(O, {
        key: 0,
        count: 3
      })) : e.value === "error" ? (i(), d("p", A, [
        _(h, {
          name: "x",
          size: 15
        }),
        b(f(v(c)("Older games could not be loaded.")) + " ", 1),
        B("button", {
          type: "button",
          class: "iv-btn sm",
          onClick: k
        }, [
          _(h, {
            name: "refresh",
            size: 13
          }),
          b(f(v(c)("Try again")), 1)
        ])
      ])) : p.more ? N("", !0) : (i(), d("p", E, f(v(c)("That's every tracked game")), 1))
    ], 8, z));
  }
});
export {
  G as default
};
