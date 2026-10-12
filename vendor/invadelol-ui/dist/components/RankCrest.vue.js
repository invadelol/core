import '../styles/base.css';
import './RankCrest.css';
import d from "../assets/ranks/bronze.svg.js";
import u from "../assets/ranks/challenger.svg.js";
import k from "../assets/ranks/diamond.svg.js";
import f from "../assets/ranks/emerald.svg.js";
import p from "../assets/ranks/gold.svg.js";
import b from "../assets/ranks/grandmaster.svg.js";
import h from "../assets/ranks/iron.svg.js";
import z from "../assets/ranks/master.svg.js";
import w from "../assets/ranks/platinum.svg.js";
import x from "../assets/ranks/silver.svg.js";
import y from "../assets/ranks/unranked.svg.js";
import { defineComponent as $, computed as a, openBlock as _, createElementBlock as m, normalizeStyle as g, createElementVNode as C } from "vue";
import { useInvadeUi as E } from "../context.js";
/* empty css                 */
const I = ["src"], M = ["src", "width", "height"], H = /* @__PURE__ */ $({
  __name: "RankCrest",
  props: {
    tier: { default: null },
    size: { default: 20 }
  },
  setup(s) {
    const o = s, v = E(), i = /* @__PURE__ */ Object.assign({ "../assets/ranks/bronze.svg": d, "../assets/ranks/challenger.svg": u, "../assets/ranks/diamond.svg": k, "../assets/ranks/emerald.svg": f, "../assets/ranks/gold.svg": p, "../assets/ranks/grandmaster.svg": b, "../assets/ranks/iron.svg": h, "../assets/ranks/master.svg": z, "../assets/ranks/platinum.svg": w, "../assets/ranks/silver.svg": x, "../assets/ranks/unranked.svg": y }), e = a(() => (o.tier ?? "").toLowerCase().replace(/[^a-z]/g, "") || "unranked"), t = a(() => i[`../assets/ranks/${e.value}.svg`] ?? i["../assets/ranks/unranked.svg"]), n = a(() => o.size >= 40 && e.value !== "unranked" ? v.assetUrl("rank", e.value) : void 0);
    function c(l) {
      const r = l.target;
      r.src !== t.value && (r.src = t.value);
    }
    return (l, r) => n.value ? (_(), m("span", {
      key: 0,
      class: "iv-crest big",
      style: g({ width: `${s.size}px`, height: `${s.size}px` })
    }, [
      C("img", {
        src: n.value,
        style: g({ width: `${Math.round(s.size * 4.1)}px` }),
        alt: "",
        draggable: "false",
        onError: c
      }, null, 44, I)
    ], 4)) : (_(), m("img", {
      key: 1,
      class: "iv-crest",
      src: t.value,
      width: s.size,
      height: Math.round(s.size * 0.76),
      alt: "",
      draggable: "false"
    }, null, 8, M));
  }
});
export {
  H as default
};
