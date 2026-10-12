import d from "../assets/ranks/bronze.svg.js";
import f from "../assets/ranks/challenger.svg.js";
import k from "../assets/ranks/diamond.svg.js";
import b from "../assets/ranks/emerald.svg.js";
import p from "../assets/ranks/gold.svg.js";
import h from "../assets/ranks/grandmaster.svg.js";
import z from "../assets/ranks/iron.svg.js";
import w from "../assets/ranks/master.svg.js";
import y from "../assets/ranks/platinum.svg.js";
import x from "../assets/ranks/silver.svg.js";
import $ from "../assets/ranks/unranked.svg.js";
import { defineComponent as C, computed as t, openBlock as l, createElementBlock as _, normalizeStyle as m, createElementVNode as E } from "vue";
import { useInvadeUi as I } from "../context.js";
const M = ["src"], B = ["src", "width", "height"], H = /* @__PURE__ */ C({
  __name: "RankCrest",
  props: {
    tier: { default: null },
    size: { default: 20 }
  },
  setup(s) {
    const o = s, g = I(), i = /* @__PURE__ */ Object.assign({ "../assets/ranks/bronze.svg": d, "../assets/ranks/challenger.svg": f, "../assets/ranks/diamond.svg": k, "../assets/ranks/emerald.svg": b, "../assets/ranks/gold.svg": p, "../assets/ranks/grandmaster.svg": h, "../assets/ranks/iron.svg": z, "../assets/ranks/master.svg": w, "../assets/ranks/platinum.svg": y, "../assets/ranks/silver.svg": x, "../assets/ranks/unranked.svg": $ }), e = t(() => (o.tier ?? "").toLowerCase().replace(/[^a-z]/g, "") || "unranked"), a = t(() => i[`../assets/ranks/${e.value}.svg`] ?? i["../assets/ranks/unranked.svg"]), c = t(() => o.size >= 40 && e.value !== "unranked"), v = t(
      () => g.assetUrl("rank", e.value) ?? `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${e.value}.png`
    );
    function u(n) {
      const r = n.target;
      r.src !== a.value && (r.src = a.value);
    }
    return (n, r) => c.value ? (l(), _("span", {
      key: 0,
      class: "iv-crest big",
      style: m({ width: `${s.size}px`, height: `${s.size}px` })
    }, [
      E("img", {
        src: v.value,
        style: m({ width: `${Math.round(s.size * 4.1)}px` }),
        alt: "",
        draggable: "false",
        onError: u
      }, null, 44, M)
    ], 4)) : (l(), _("img", {
      key: 1,
      class: "iv-crest",
      src: a.value,
      width: s.size,
      height: Math.round(s.size * 0.76),
      alt: "",
      draggable: "false"
    }, null, 8, B));
  }
});
export {
  H as default
};
