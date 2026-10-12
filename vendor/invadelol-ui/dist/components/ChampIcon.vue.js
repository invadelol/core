import '../styles/base.css';
import './ChampIcon.css';
import { defineComponent as m, computed as o, openBlock as a, createElementBlock as i, normalizeStyle as u, normalizeClass as r, createCommentVNode as n, toDisplayString as f } from "vue";
import { useNames as p } from "../context.js";
/* empty css                 */
const h = ["title"], v = ["src"], y = { key: 1 }, B = /* @__PURE__ */ m({
  __name: "ChampIcon",
  props: {
    id: { default: null },
    size: { default: 28 },
    level: { default: null },
    dim: { type: Boolean, default: !1 },
    title: { default: void 0 }
  },
  setup(e) {
    const t = e, { champIcon: s, champName: c } = p(), l = o(() => t.id ? s(t.id) : void 0), d = o(() => t.title ?? (t.id ? c(t.id) : void 0));
    return (g, z) => (a(), i("span", {
      class: r(["iv-champ", { dim: e.dim, empty: !l.value }]),
      style: u({ width: `${e.size}px`, height: `${e.size}px` }),
      title: d.value
    }, [
      l.value ? (a(), i("img", {
        key: 0,
        src: l.value,
        alt: "",
        loading: "lazy",
        draggable: "false"
      }, null, 8, v)) : n("", !0),
      e.level ? (a(), i("em", y, f(e.level), 1)) : n("", !0)
    ], 14, h));
  }
});
export {
  B as default
};
