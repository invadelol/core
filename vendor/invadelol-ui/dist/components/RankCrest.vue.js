import '../styles/base.css';
import './RankCrest.css';
import d from "../assets/ranks/bronze.svg.js";
import k from "../assets/ranks/challenger.svg.js";
import f from "../assets/ranks/diamond.svg.js";
import p from "../assets/ranks/emerald.svg.js";
import b from "../assets/ranks/gold.svg.js";
import h from "../assets/ranks/grandmaster.svg.js";
import z from "../assets/ranks/iron.svg.js";
import y from "../assets/ranks/master.svg.js";
import w from "../assets/ranks/platinum.svg.js";
import C from "../assets/ranks/silver.svg.js";
import x from "../assets/ranks/unranked.svg.js";
import { defineComponent as B, computed as i, shallowRef as I, watch as M, useTemplateRef as R, onMounted as $, openBlock as a, createElementBlock as r, normalizeStyle as E, normalizeClass as L } from "vue";
import { useInvadeUi as U } from "../context.js";
/* empty css                 */
const W = ["src"], j = ["src"], H = ["src", "width", "height"], Y = /* @__PURE__ */ B({
  __name: "RankCrest",
  props: {
    tier: { default: null },
    size: { default: 20 },
    emblem: { type: Boolean }
  },
  setup(s) {
    const _ = s, c = U(), m = /* @__PURE__ */ Object.assign({ "../assets/ranks/bronze.svg": d, "../assets/ranks/challenger.svg": k, "../assets/ranks/diamond.svg": f, "../assets/ranks/emerald.svg": p, "../assets/ranks/gold.svg": b, "../assets/ranks/grandmaster.svg": h, "../assets/ranks/iron.svg": z, "../assets/ranks/master.svg": y, "../assets/ranks/platinum.svg": w, "../assets/ranks/silver.svg": C, "../assets/ranks/unranked.svg": x }), o = i(() => (_.tier ?? "").toLowerCase().replace(/[^a-z]/g, "") || "unranked"), g = i(() => m[`../assets/ranks/${o.value}.svg`] ?? m["../assets/ranks/unranked.svg"]), l = i(() => _.emblem && o.value !== "unranked" ? c.assetUrl("rank", o.value) : void 0), e = I(null);
    M(l, () => e.value = null);
    const n = R("img"), v = () => {
      const t = n.value;
      t?.naturalWidth && (e.value = t.naturalWidth >= t.naturalHeight * 1.5);
    };
    return $(() => n.value?.complete && v()), (t, u) => l.value ? (a(), r("span", {
      key: 0,
      class: L(["iv-crest big", { ok: e.value }]),
      style: E({ "--iv-size": `${s.size}px` })
    }, [
      e.value !== !1 ? (a(), r("img", {
        key: 0,
        ref_key: "img",
        ref: n,
        src: l.value,
        alt: "",
        draggable: "false",
        onLoad: v,
        onError: u[0] || (u[0] = (N) => e.value = !1)
      }, null, 40, W)) : (a(), r("img", {
        key: 1,
        class: "mini",
        src: g.value,
        alt: "",
        draggable: "false"
      }, null, 8, j))
    ], 6)) : (a(), r("img", {
      key: 1,
      class: "iv-crest",
      src: g.value,
      width: s.size,
      height: Math.round(s.size * 0.76),
      alt: "",
      draggable: "false"
    }, null, 8, H));
  }
});
export {
  Y as default
};
