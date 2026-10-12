import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
import { defineComponent as w, shallowRef as _, onMounted as x, watch as T, onBeforeUnmount as M, openBlock as a, createElementBlock as u, createBlock as B, createVNode as b, createTextVNode as k, toDisplayString as v, unref as i, createElementVNode as N, createCommentVNode as V, nextTick as C } from "vue";
import { useInvadeUi as I } from "../context.js";
import { mmss as $ } from "../logic/format.js";
import { pager as z } from "../logic/pager.js";
import h from "./Icon.vue.js";
import E from "./MatchRowSkeleton.vue.js";
/* empty css                      */
/* empty css                 */
/* empty css                       */
/* empty css                    */
const O = ["aria-busy"], U = {
  key: 1,
  class: "iv-error",
  role: "alert"
}, D = {
  key: 2,
  class: "iv-more-line"
}, F = {
  key: 3,
  class: "iv-more-line iv-more-end",
  role: "status"
}, P = /* @__PURE__ */ w({
  __name: "MoreMatches",
  props: {
    more: { type: Boolean },
    load: { type: Function }
  },
  setup(d) {
    const f = d, { t: n } = I(), p = z(), e = _("idle"), y = _(0), t = _(null);
    let s = !1, l, o;
    async function m(c = !1) {
      if (clearTimeout(l), !f.more || e.value === "loading" || !(s || c)) return;
      const r = p.wait();
      if (y.value = Math.ceil(r / 1e3), r > 0) {
        s && (l = setTimeout(m, r % 1e3 || 1e3));
        return;
      }
      e.value = "loading";
      try {
        const g = await f.load();
        g?.wait ? p.hold(g.wait) : p.take(), e.value = "idle";
      } catch {
        e.value = "error";
        return;
      }
      await C(), t.value && o && (o.unobserve(t.value), o.observe(t.value));
    }
    return x(() => {
      o = new IntersectionObserver(
        ([c]) => {
          s = c.isIntersecting, s ? m() : clearTimeout(l);
        },
        { rootMargin: "240px 0px" }
      ), t.value && o.observe(t.value);
    }), T(
      () => f.more,
      () => {
        m();
      }
    ), M(() => {
      o?.disconnect(), clearTimeout(l);
    }), (c, r) => (a(), u("div", {
      ref_key: "el",
      ref: t,
      class: "iv-more",
      "aria-busy": e.value === "loading"
    }, [
      e.value === "loading" ? (a(), B(E, {
        key: 0,
        count: 3
      })) : e.value === "error" ? (a(), u("p", U, [
        b(h, {
          name: "x",
          size: 15
        }),
        k(v(i(n)("Older games could not be loaded.")) + " ", 1),
        N("button", {
          type: "button",
          class: "iv-btn sm",
          onClick: r[0] || (r[0] = (g) => m(!0))
        }, [
          b(h, {
            name: "refresh",
            size: 13
          }),
          k(v(i(n)("Try again")), 1)
        ])
      ])) : d.more && y.value > 0 ? (a(), u("p", D, v(i(n)("More games in {time}", { time: i($)(y.value) })), 1)) : d.more ? V("", !0) : (a(), u("p", F, v(i(n)("That's every tracked game")), 1))
    ], 8, O));
  }
});
export {
  P as default
};
