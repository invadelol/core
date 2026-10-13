import '../styles/base.css';
import './RankCrest.css';
import C from "../assets/ranks/bronze.svg.js";
import B from "../assets/ranks/challenger.svg.js";
import M from "../assets/ranks/diamond.svg.js";
import R from "../assets/ranks/emerald.svg.js";
import W from "../assets/ranks/gold.svg.js";
import $ from "../assets/ranks/grandmaster.svg.js";
import E from "../assets/ranks/iron.svg.js";
import L from "../assets/ranks/master.svg.js";
import S from "../assets/ranks/platinum.svg.js";
import U from "../assets/ranks/silver.svg.js";
import j from "../assets/ranks/unranked.svg.js";
import { defineComponent as A, computed as v, shallowRef as c, watch as w, useTemplateRef as H, onMounted as N, openBlock as l, createElementBlock as n, normalizeStyle as O, normalizeClass as P } from "vue";
import { useInvadeUi as T } from "../context.js";
/* empty css                 */
const q = ["src"], D = ["src"], F = ["src", "width", "height"], re = /* @__PURE__ */ A({
  __name: "RankCrest",
  props: {
    tier: { default: null },
    size: { default: 20 },
    emblem: { type: Boolean }
  },
  setup(t) {
    const g = t, I = T(), d = /* @__PURE__ */ Object.assign({ "../assets/ranks/bronze.svg": C, "../assets/ranks/challenger.svg": B, "../assets/ranks/diamond.svg": M, "../assets/ranks/emerald.svg": R, "../assets/ranks/gold.svg": W, "../assets/ranks/grandmaster.svg": $, "../assets/ranks/iron.svg": E, "../assets/ranks/master.svg": L, "../assets/ranks/platinum.svg": S, "../assets/ranks/silver.svg": U, "../assets/ranks/unranked.svg": j }), i = v(() => (g.tier ?? "").toLowerCase().replace(/[^a-z]/g, "") || "unranked"), f = v(() => d[`../assets/ranks/${i.value}.svg`] ?? d["../assets/ranks/unranked.svg"]), m = v(() => g.emblem && i.value !== "unranked" ? I.assetUrl("rank", i.value) : void 0);
    function k(e) {
      const s = new Image();
      return s.src = e, s.decode().then(
        () => s,
        () => s
      );
    }
    const p = typeof Image < "u", o = c(f.value);
    let h = 0;
    w(f, (e) => {
      const s = ++h;
      p ? k(e).then(() => s === h && (o.value = e)) : o.value = e;
    });
    const r = c(m.value), a = c(null), b = (e) => e.naturalWidth >= e.naturalHeight * 1.5;
    let y = 0;
    w(m, (e) => {
      const s = ++y;
      if (!e || !r.value || a.value === null || !p) {
        r.value = e, a.value = null;
        return;
      }
      k(e).then((u) => {
        s === y && (r.value = e, a.value = u.naturalWidth > 0 && b(u));
      });
    });
    const _ = H("img"), z = () => {
      const e = _.value;
      e?.naturalWidth && (a.value = b(e));
    };
    return N(() => _.value?.complete && z()), (e, s) => m.value ? (l(), n("span", {
      key: 0,
      class: P(["iv-crest big", { ok: a.value }]),
      style: O({ "--iv-size": `${t.size}px` })
    }, [
      a.value !== !1 ? (l(), n("img", {
        key: 0,
        ref_key: "img",
        ref: _,
        src: r.value,
        alt: "",
        draggable: "false",
        onLoad: z,
        onError: s[0] || (s[0] = (u) => a.value = !1)
      }, null, 40, q)) : (l(), n("img", {
        key: 1,
        class: "mini",
        src: o.value,
        alt: "",
        draggable: "false"
      }, null, 8, D))
    ], 6)) : (l(), n("img", {
      key: 1,
      class: "iv-crest",
      src: o.value,
      width: t.size,
      height: Math.round(t.size * 0.76),
      alt: "",
      draggable: "false"
    }, null, 8, F));
  }
});
export {
  re as default
};
