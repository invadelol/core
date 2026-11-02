import '../styles/base.css';
import '../styles/primitives.css';
import { defineComponent as x, useTemplateRef as h, shallowRef as S, computed as k, watch as v, onMounted as E, onBeforeUnmount as P, openBlock as R, createElementBlock as B, isRef as C, normalizeClass as W, createVNode as F, createElementVNode as G, toDisplayString as L } from "vue";
import { useStatGroups as N } from "../fit.js";
import { hideTip as d, showTip as y, tipOn as O } from "../tip.js";
import V from "./StatIcon.vue.js";
/* empty css                 */
/* empty css                       */
const _ = 4, H = /* @__PURE__ */ x({
  __name: "StatLabel",
  props: {
    stat: {},
    label: {},
    size: { default: 14 },
    group: { default: void 0 },
    bare: { type: Boolean }
  },
  setup(s) {
    const o = s, t = h("root"), f = h("text"), l = N(), b = /* @__PURE__ */ Symbol(), i = S(!1), p = k(() => o.bare ? !0 : o.group && l ? (l.get(o.group)?.size ?? 0) > 0 : i.value);
    function u(e, n) {
      if (!e || !l) return;
      l.has(e) || l.set(e, /* @__PURE__ */ new Set());
      const r = l.get(e);
      n ? r.add(b) : r.delete(b);
    }
    v(i, (e) => u(o.group, e)), v(
      () => o.group,
      (e, n) => {
        u(n, !1), u(e, i.value);
      }
    );
    function c() {
      const e = t.value?.parentElement;
      if (!e || !f.value) return;
      if (!e.clientWidth) return void (i.value = !1);
      const n = getComputedStyle(e), r = e.clientWidth - parseFloat(n.paddingLeft) - parseFloat(n.paddingRight);
      i.value = f.value.scrollWidth + o.size + _ > r + 0.5;
    }
    let m;
    E(() => {
      o.bare || !t.value?.parentElement || (m = new ResizeObserver(c), m.observe(t.value.parentElement), document.fonts?.ready.then(c));
    }), v(() => [o.label, o.size], c, { flush: "post" }), P(() => {
      m?.disconnect(), u(o.group, !1), t.value && d(t.value);
    });
    let a = "mouse", g = 0;
    function w(e) {
      a = e.pointerType, !(a !== "mouse" || !p.value) && (g = window.setTimeout(() => t.value && y(t.value, o.label), 300));
    }
    function z() {
      clearTimeout(g), a === "mouse" && t.value && d(t.value);
    }
    function T(e) {
      a === "mouse" || !p.value || !t.value || (e.stopPropagation(), O(t.value) ? d(t.value) : y(t.value, o.label, 2500));
    }
    return (e, n) => (R(), B("span", {
      ref_key: "root",
      ref: t,
      class: W(["iv-stat", { bare: p.value }]),
      onPointerdown: n[0] || (n[0] = (r) => C(a) ? a.value = r.pointerType : a = r.pointerType),
      onPointerenter: w,
      onPointerleave: z,
      onClick: T
    }, [
      F(V, {
        name: s.stat,
        size: s.size
      }, null, 8, ["name", "size"]),
      G("span", {
        ref_key: "text",
        ref: f,
        class: "iv-stat-l"
      }, L(s.label), 513)
    ], 34));
  }
});
export {
  H as default
};
