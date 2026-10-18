import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/profile.css';
import '../styles/accounts.css';
import { defineComponent as x, ref as C, computed as S, openBlock as s, createElementBlock as r, normalizeClass as z, createElementVNode as u, toDisplayString as a, unref as i, Fragment as k, createVNode as m, withCtx as g, createTextVNode as d, createCommentVNode as y, createBlock as V, withKeys as K, withModifiers as G, withDirectives as H, vModelText as O, renderList as F, normalizeStyle as P, nextTick as Y } from "vue";
import { useInvadeUi as j } from "../context.js";
import { tierColor as q } from "../logic/labels.js";
import b from "./Button.vue.js";
import A from "./Icon.vue.js";
import J from "./RankCrest.vue.js";
/* empty css               */
import Q from "./StarButton.vue.js";
/* empty css                */
/* empty css                 */
/* empty css                       */
/* empty css                    */
/* empty css                     */
const W = { class: "iv-panel-head" }, X = { class: "meta" }, Z = { class: "actions" }, ee = ["placeholder", "aria-label"], le = {
  key: 0,
  role: "alert"
}, te = ["aria-label"], ae = ["aria-pressed"], ie = ["aria-pressed", "onClick"], oe = {
  key: 2,
  class: "iv-favs-rows"
}, se = ["aria-label", "onClick"], ne = ["src"], re = { class: "iv-acc-who" }, ue = {
  key: 0,
  class: "iv-favs-tier"
}, de = { key: 1 }, ve = ["value", "disabled", "aria-label", "onChange"], me = { value: "" }, ce = ["value"], fe = {
  key: 3,
  class: "iv-pf-note"
}, Ie = /* @__PURE__ */ x({
  __name: "ProfileFavorites",
  props: {
    folders: {},
    profiles: {},
    layout: { default: "strip" },
    busy: { type: Boolean },
    title: { default: "" }
  },
  emits: ["open", "create", "rename", "removeFolder", "move", "remove", "search", "manage"],
  setup(n, { emit: B }) {
    const $ = n, N = B, { assetUrl: M, t: o } = j(), c = C("all"), h = S(() => $.folders.find((l) => l.id === c.value) ?? null), L = S(() => h.value ? $.profiles.filter((l) => l.folderId === h.value.id) : $.profiles), D = (l) => $.profiles.filter((t) => t.folderId === l).length, v = C(null), p = C(""), w = C(""), I = C(null);
    async function T(l) {
      v.value = l, p.value = l === "new" ? "" : h.value?.name ?? "", w.value = "", await Y(), I.value?.focus();
    }
    function R() {
      const l = v.value, t = p.value.trim();
      if (!l || !t) return void (v.value = null);
      if ($.folders.some((e) => e.id !== l && e.name.toLowerCase() === t.toLowerCase())) {
        w.value = o("You already have a folder with this name");
        return;
      }
      l === "new" ? N("create", t) : N("rename", l, t), v.value = null;
    }
    function U() {
      h.value && (N("removeFolder", h.value.id), c.value = "all");
    }
    const E = (l) => l.platform.replace(/\d+$/, ""), _ = (l) => l.tier ? l.tier.charAt(0) + l.tier.slice(1).toLowerCase() + (l.division && !/MASTER|CHALLENGER/.test(l.tier) ? " " + l.division : "") : "";
    return (l, t) => (s(), r("section", {
      class: z(["iv-panel iv-pf-panel iv-favs", `iv-favs-${n.layout}`])
    }, [
      u("header", W, [
        u("h3", null, a(n.title || i(o)("Favorites")), 1),
        u("span", X, a(n.profiles.length), 1),
        u("span", Z, [
          n.layout === "list" && !v.value ? (s(), r(k, { key: 0 }, [
            h.value ? (s(), r(k, { key: 0 }, [
              m(b, {
                variant: "ghost",
                size: "sm",
                disabled: n.busy,
                onClick: t[0] || (t[0] = (e) => T(h.value.id))
              }, {
                default: g(() => [
                  d(a(i(o)("Rename")), 1)
                ]),
                _: 1
              }, 8, ["disabled"]),
              m(b, {
                variant: "ghost",
                size: "sm",
                disabled: n.busy,
                onClick: U
              }, {
                default: g(() => [
                  d(a(i(o)("Delete folder")), 1)
                ]),
                _: 1
              }, 8, ["disabled"])
            ], 64)) : y("", !0),
            m(b, {
              variant: "ghost",
              size: "sm",
              disabled: n.busy,
              onClick: t[1] || (t[1] = (e) => T("new"))
            }, {
              default: g(() => [
                m(A, {
                  name: "plus",
                  size: 13
                }),
                d(a(i(o)("New folder")), 1)
              ]),
              _: 1
            }, 8, ["disabled"])
          ], 64)) : n.layout === "strip" ? (s(), V(b, {
            key: 1,
            variant: "ghost",
            size: "sm",
            onClick: t[2] || (t[2] = (e) => l.$emit("manage"))
          }, {
            default: g(() => [
              d(a(i(o)("Manage")), 1)
            ]),
            _: 1
          })) : y("", !0)
        ])
      ]),
      v.value ? (s(), r("form", {
        key: 0,
        class: "iv-favs-form",
        onSubmit: G(R, ["prevent"]),
        onKeydown: t[5] || (t[5] = K((e) => v.value = null, ["esc"]))
      }, [
        H(u("input", {
          ref_key: "input",
          ref: I,
          "onUpdate:modelValue": t[3] || (t[3] = (e) => p.value = e),
          maxlength: "40",
          placeholder: i(o)("Folder name"),
          "aria-label": i(o)("Folder name")
        }, null, 8, ee), [
          [O, p.value]
        ]),
        m(b, {
          size: "sm",
          type: "submit",
          disabled: n.busy
        }, {
          default: g(() => [
            d(a(v.value === "new" ? i(o)("Create") : i(o)("Save")), 1)
          ]),
          _: 1
        }, 8, ["disabled"]),
        m(b, {
          variant: "ghost",
          size: "sm",
          onClick: t[4] || (t[4] = (e) => v.value = null)
        }, {
          default: g(() => [
            d(a(i(o)("Cancel")), 1)
          ]),
          _: 1
        }),
        w.value ? (s(), r("small", le, a(w.value), 1)) : y("", !0)
      ], 32)) : y("", !0),
      n.folders.length ? (s(), r("div", {
        key: 1,
        class: "iv-seg sm iv-favs-folders",
        role: "group",
        "aria-label": i(o)("Folders")
      }, [
        u("button", {
          type: "button",
          class: z({ on: c.value === "all" }),
          "aria-pressed": c.value === "all",
          onClick: t[6] || (t[6] = (e) => c.value = "all")
        }, [
          d(a(i(o)("All")) + " ", 1),
          u("small", null, a(n.profiles.length), 1)
        ], 10, ae),
        (s(!0), r(k, null, F(n.folders, (e) => (s(), r("button", {
          key: e.id,
          type: "button",
          class: z({ on: c.value === e.id }),
          "aria-pressed": c.value === e.id,
          onClick: (f) => c.value = e.id
        }, [
          d(a(e.name) + " ", 1),
          u("small", null, a(D(e.id)), 1)
        ], 10, ie))), 128))
      ], 8, te)) : y("", !0),
      L.value.length ? (s(), r("ul", oe, [
        (s(!0), r(k, null, F(L.value, (e) => (s(), r("li", {
          key: e.puuid
        }, [
          u("button", {
            type: "button",
            class: "iv-acc-hit",
            "aria-label": `${i(o)("Open profile")} · ${e.gameName}#${e.tagLine}`,
            onClick: (f) => l.$emit("open", e)
          }, null, 8, se),
          u("img", {
            src: i(M)("profileIcon", e.profileIconId ?? 1),
            alt: "",
            width: "30",
            height: "30",
            loading: "lazy"
          }, null, 8, ne),
          u("span", re, [
            u("b", null, [
              d(a(e.gameName), 1),
              u("small", null, "#" + a(e.tagLine), 1)
            ]),
            e.tier ? (s(), r("small", ue, [
              m(J, {
                tier: e.tier,
                size: 12
              }, null, 8, ["tier"]),
              u("span", {
                style: P({ color: i(q)(e.tier) })
              }, a(_(e)), 5)
            ])) : E(e) ? (s(), r("small", de, a(E(e)), 1)) : y("", !0)
          ]),
          n.layout === "list" ? (s(), r(k, { key: 0 }, [
            u("select", {
              class: "iv-select iv-favs-move",
              value: e.folderId ?? "",
              disabled: n.busy,
              "aria-label": `${i(o)("Folder")} · ${e.gameName}`,
              onChange: (f) => l.$emit("move", e.puuid, f.target.value || null)
            }, [
              u("option", me, a(i(o)("No folder")), 1),
              (s(!0), r(k, null, F(n.folders, (f) => (s(), r("option", {
                key: f.id,
                value: f.id
              }, a(f.name), 9, ce))), 128))
            ], 40, ve),
            m(Q, {
              class: "iv-favs-star",
              saved: "",
              label: e.gameName,
              onToggle: (f) => l.$emit("remove", e.puuid)
            }, null, 8, ["label", "onToggle"])
          ], 64)) : y("", !0)
        ]))), 128))
      ])) : (s(), r("p", fe, [
        d(a(n.profiles.length ? i(o)("No players in this folder.") : i(o)("No favorite players yet.")) + " ", 1),
        n.profiles.length ? y("", !0) : (s(), V(b, {
          key: 0,
          variant: "ghost",
          size: "sm",
          onClick: t[7] || (t[7] = (e) => l.$emit("search"))
        }, {
          default: g(() => [
            m(A, {
              name: "search",
              size: 13
            }),
            d(a(i(o)("Find a player")), 1)
          ]),
          _: 1
        }))
      ]))
    ], 2));
  }
});
export {
  Ie as default
};
