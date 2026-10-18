import '../styles/accounts.css';
import { defineComponent as O, ref as _, computed as B, openBlock as o, createElementBlock as d, withKeys as j, normalizeClass as I, createElementVNode as l, createVNode as u, createTextVNode as v, toDisplayString as t, unref as i, createCommentVNode as k, withCtx as p, withModifiers as q, withDirectives as G, vModelText as H, Fragment as N, renderList as x, createBlock as S } from "vue";
import { useInvadeUi as J } from "../context.js";
import C from "./Button.vue.js";
import c from "./Icon.vue.js";
import Q from "./RankCrest.vue.js";
/* empty css               */
/* empty css                     */
const W = { class: "iv-favorites-head" }, X = {
  key: 0,
  class: "iv-favorites-status",
  role: "status"
}, Y = ["for"], Z = ["id", "placeholder"], ee = {
  key: 0,
  role: "alert"
}, te = ["aria-label"], le = ["aria-pressed"], ae = ["aria-pressed", "onClick"], ie = {
  key: 0,
  class: "iv-folder-actions"
}, se = {
  key: 1,
  class: "iv-favorites-empty"
}, ne = {
  key: 2,
  class: "iv-favorites-people"
}, oe = ["onClick"], ue = ["src"], re = {
  key: 0,
  class: "iv-favorite-rank"
}, de = { class: "iv-favorite-options" }, ve = {
  key: 0,
  class: "iv-favorite-menu"
}, ce = ["onClick"], me = ["onClick"], fe = ["onClick"], ze = /* @__PURE__ */ O({
  __name: "ProfileFavorites",
  props: {
    folders: {},
    profiles: {},
    status: { default: "" },
    layout: { default: "strip" },
    busy: { type: Boolean }
  },
  emits: ["open", "create", "rename", "removeFolder", "move", "remove", "search"],
  setup(r, { emit: D }) {
    const F = r, w = D, { assetUrl: E, t: a } = J(), m = _("all"), h = _(!1), g = _(null), $ = B(
      () => F.folders.find((s) => s.id === m.value)
    ), z = _(""), y = _(""), b = _(null);
    function K() {
      b.value = null, h.value = !1;
    }
    function L(s, n) {
      w("move", s, n), b.value = null;
    }
    function M(s) {
      w("remove", s), b.value = null;
    }
    const V = B(
      () => F.profiles.filter(
        (s) => m.value === "all" || s.folderId === m.value
      )
    ), P = (s) => F.profiles.filter((n) => n.folderId === s).length;
    function R() {
      g.value = null, z.value = "", y.value = "", h.value = !h.value;
    }
    function T() {
      $.value && (g.value = $.value.id, z.value = $.value.name, y.value = "", h.value = !0);
    }
    function U() {
      $.value && (w("removeFolder", $.value.id), m.value = "all", h.value = !1);
    }
    function A() {
      const s = z.value.trim();
      if (!s) {
        y.value = a("Enter a folder name");
        return;
      }
      if (F.folders.some(
        (n) => n.id !== g.value && n.name.toLowerCase() === s.toLowerCase()
      )) {
        y.value = a("This folder already exists");
        return;
      }
      g.value ? w("rename", g.value, s) : w("create", s), z.value = "", h.value = !1, y.value = "";
    }
    return (s, n) => (o(), d("section", {
      class: I(["iv-panel iv-favorite-profiles", `iv-favorites-${r.layout}`]),
      "aria-label": "Favorite profiles",
      onKeydown: j(K, ["esc"])
    }, [
      l("header", W, [
        l("h2", null, [
          u(c, {
            name: "star",
            size: 15
          }),
          v(t(i(a)("Favorites")), 1),
          l("small", null, t(r.profiles.length), 1)
        ]),
        r.status ? (o(), d("span", X, [
          u(c, {
            name: r.status.toLowerCase().includes("offline") ? "clock" : "check",
            size: 12
          }, null, 8, ["name"]),
          v(t(r.status), 1)
        ])) : k("", !0),
        u(C, {
          variant: "ghost",
          size: "sm",
          onClick: R
        }, {
          default: p(() => [
            u(c, {
              name: "folder",
              size: 14
            }),
            v(t(i(a)("New folder")), 1)
          ]),
          _: 1
        })
      ]),
      h.value ? (o(), d("form", {
        key: 0,
        class: "iv-folder-create",
        onSubmit: q(A, ["prevent"])
      }, [
        l("label", {
          for: `iv-folder-${r.layout}`
        }, t(i(a)("Folder name")), 9, Y),
        l("div", null, [
          G(l("input", {
            id: `iv-folder-${r.layout}`,
            "onUpdate:modelValue": n[0] || (n[0] = (e) => z.value = e),
            maxlength: "40",
            placeholder: i(a)("e.g. Clash team"),
            autofocus: ""
          }, null, 8, Z), [
            [H, z.value]
          ]),
          u(C, {
            type: "submit",
            disabled: r.busy
          }, {
            default: p(() => [
              v(t(g.value ? i(a)("Save") : i(a)("Create")), 1)
            ]),
            _: 1
          }, 8, ["disabled"]),
          u(C, {
            variant: "ghost",
            onClick: n[1] || (n[1] = (e) => h.value = !1)
          }, {
            default: p(() => [
              v(t(i(a)("Cancel")), 1)
            ]),
            _: 1
          })
        ]),
        y.value ? (o(), d("p", ee, t(y.value), 1)) : k("", !0)
      ], 32)) : k("", !0),
      l("nav", {
        class: "iv-favorites-folders",
        "aria-label": i(a)("Favorite folders")
      }, [
        l("button", {
          type: "button",
          class: I({ on: m.value === "all" }),
          "aria-pressed": m.value === "all",
          onClick: n[2] || (n[2] = (e) => m.value = "all")
        }, [
          v(t(i(a)("All profiles")), 1),
          l("small", null, t(r.profiles.length), 1)
        ], 10, le),
        (o(!0), d(N, null, x(r.folders, (e) => (o(), d("button", {
          key: e.id,
          type: "button",
          class: I({ on: m.value === e.id }),
          "aria-pressed": m.value === e.id,
          onClick: (f) => m.value = e.id
        }, [
          u(c, {
            name: "folder",
            size: 13
          }),
          v(t(e.name), 1),
          l("small", null, t(P(e.id)), 1)
        ], 10, ae))), 128)),
        $.value ? (o(), d("span", ie, [
          u(C, {
            variant: "ghost",
            size: "sm",
            disabled: r.busy,
            onClick: T
          }, {
            default: p(() => [
              v(t(i(a)("Rename folder")), 1)
            ]),
            _: 1
          }, 8, ["disabled"]),
          u(C, {
            variant: "ghost",
            size: "sm",
            "icon-only": "",
            disabled: r.busy,
            "aria-label": i(a)("Delete folder, keep profiles"),
            onClick: U
          }, {
            default: p(() => [
              u(c, {
                name: "trash",
                size: 13
              })
            ]),
            _: 1
          }, 8, ["disabled", "aria-label"])
        ])) : k("", !0)
      ], 8, te),
      V.value.length ? (o(), d("div", ne, [
        (o(!0), d(N, null, x(V.value, (e) => (o(), d("div", {
          key: e.puuid,
          class: "iv-favorite-person"
        }, [
          l("button", {
            type: "button",
            class: "iv-favorite-open",
            onClick: (f) => s.$emit("open", e)
          }, [
            l("img", {
              src: i(E)("profileIcon", e.profileIconId ?? 1),
              alt: "",
              width: "32",
              height: "32"
            }, null, 8, ue),
            l("span", null, [
              l("b", null, t(e.gameName), 1),
              l("small", null, [
                v("#" + t(e.tagLine), 1),
                n[4] || (n[4] = l("i", null, "·", -1)),
                v(t(e.platform.replace(/1$/, "")), 1)
              ])
            ])
          ], 8, oe),
          r.layout === "list" && e.tier ? (o(), d("span", re, [
            u(Q, {
              tier: e.tier,
              size: 18
            }, null, 8, ["tier"]),
            v(t(e.tier.charAt(0) + e.tier.slice(1).toLowerCase()) + " " + t(e.division), 1)
          ])) : k("", !0),
          l("div", de, [
            u(C, {
              variant: "ghost",
              size: "sm",
              "icon-only": "",
              "aria-label": `${i(a)("Organize favorite")} · ${e.gameName}`,
              "aria-expanded": b.value === e.puuid,
              onClick: (f) => b.value = b.value === e.puuid ? null : e.puuid
            }, {
              default: p(() => [
                u(c, {
                  name: "down",
                  size: 12
                })
              ]),
              _: 1
            }, 8, ["aria-label", "aria-expanded", "onClick"]),
            b.value === e.puuid ? (o(), d("div", ve, [
              l("span", null, t(i(a)("Move to folder")), 1),
              l("button", {
                type: "button",
                onClick: (f) => L(e.puuid, null)
              }, [
                v(t(i(a)("No folder")), 1),
                e.folderId ? k("", !0) : (o(), S(c, {
                  key: 0,
                  name: "check",
                  size: 12
                }))
              ], 8, ce),
              (o(!0), d(N, null, x(r.folders, (f) => (o(), d("button", {
                key: f.id,
                type: "button",
                onClick: (he) => L(e.puuid, f.id)
              }, [
                u(c, {
                  name: "folder",
                  size: 13
                }),
                v(t(f.name), 1),
                e.folderId === f.id ? (o(), S(c, {
                  key: 0,
                  name: "check",
                  size: 12
                })) : k("", !0)
              ], 8, me))), 128)),
              l("button", {
                type: "button",
                class: "iv-favorite-remove",
                onClick: (f) => M(e.puuid)
              }, [
                u(c, {
                  name: "star",
                  size: 13
                }),
                v(t(i(a)("Remove favorite")), 1)
              ], 8, fe)
            ])) : k("", !0)
          ])
        ]))), 128))
      ])) : (o(), d("div", se, [
        l("p", null, t(r.profiles.length ? i(a)("No profiles in this folder yet.") : i(a)(
          "Keep a team, a duo or a profile close. Star any player to save them here."
        )), 1),
        u(C, {
          variant: "ghost",
          size: "sm",
          onClick: n[3] || (n[3] = (e) => s.$emit("search"))
        }, {
          default: p(() => [
            u(c, {
              name: "search",
              size: 14
            }),
            v(t(i(a)("Find a profile")), 1)
          ]),
          _: 1
        })
      ]))
    ], 34));
  }
});
export {
  ze as default
};
