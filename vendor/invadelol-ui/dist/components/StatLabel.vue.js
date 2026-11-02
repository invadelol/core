import '../styles/base.css';
import '../styles/primitives.css';
import { defineComponent as E, useTemplateRef as h, shallowRef as x, computed as S, watch as d, onMounted as k, onBeforeUnmount as P, openBlock as R, createElementBlock as B, isRef as C, normalizeClass as L, createVNode as W, createElementVNode as F, toDisplayString as G } from "vue";
import { useStatGroups as N } from "../fit.js";
import { hideTip as v, showTip as w, tipOn as O } from "../tip.js";
import V from "./StatIcon.vue.js";
/* empty css                 */
/* empty css                       */
const _ = 4, H = /* @__PURE__ */ E({
  __name: "StatLabel",
  props: {
    stat: {},
    label: {},
    size: { default: 14 },
    group: { default: void 0 },
    bare: { type: Boolean }
  },
  setup(s) {
    const o = s, t = h("root"), p = h("text"), l = N(), b = /* @__PURE__ */ Symbol(), i = x(!1), c = S(() => o.bare ? !0 : o.group && l ? (l.get(o.group)?.size ?? 0) > 0 : i.value);
    function u(e, n) {
      if (!e || !l) return;
      l.has(e) || l.set(e, /* @__PURE__ */ new Set());
      const r = l.get(e);
      n ? r.add(b) : r.delete(b);
    }
    d(i, (e) => u(o.group, e)), d(
      () => o.group,
      (e, n) => {
        u(n, !1), u(e, i.value);
      }
    );
    function f() {
      const e = t.value?.parentElement;
      if (!e || !p.value) return;
      if (!e.clientWidth) return void (i.value = !1);
      const n = getComputedStyle(e), r = e.clientWidth - parseFloat(n.paddingLeft) - parseFloat(n.paddingRight);
      i.value = p.value.scrollWidth + o.size + _ > r + 0.5;
    }
    let m;
    k(() => {
      o.bare || !t.value?.parentElement || (m = new ResizeObserver(f), m.observe(t.value.parentElement), document.fonts?.addEventListener("loadingdone", f));
    }), d(() => [o.label, o.size], f, { flush: "post" }), P(() => {
      m?.disconnect(), document.fonts?.removeEventListener("loadingdone", f), u(o.group, !1), t.value && v(t.value);
    });
    let a = "mouse", g = 0;
    function y(e) {
      a = e.pointerType, !(a !== "mouse" || !c.value) && (g = window.setTimeout(() => t.value && w(t.value, o.label), 300));
    }
    function z() {
      clearTimeout(g), a === "mouse" && t.value && v(t.value);
    }
    function T(e) {
      a === "mouse" || !c.value || !t.value || (e.stopPropagation(), O(t.value) ? v(t.value) : w(t.value, o.label, 2500));
    }
    return (e, n) => (R(), B("span", {
      ref_key: "root",
      ref: t,
      class: L(["iv-stat", { bare: c.value }]),
      onPointerdown: n[0] || (n[0] = (r) => C(a) ? a.value = r.pointerType : a = r.pointerType),
      onPointerenter: y,
      onPointerleave: z,
      onClick: T
    }, [
      W(V, {
        name: s.stat,
        size: s.size
      }, null, 8, ["name", "size"]),
      F("span", {
        ref_key: "text",
        ref: p,
        class: "iv-stat-l"
      }, G(s.label), 513)
    ], 34));
  }
});
export {
  H as default
};
