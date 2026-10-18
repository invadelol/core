import '../styles/accounts.css';
import { defineComponent as oe, ref as F, computed as E, onMounted as ie, onBeforeUnmount as se, openBlock as a, createElementBlock as r, withKeys as U, unref as o, normalizeClass as I, Fragment as b, createElementVNode as l, createVNode as v, createTextVNode as m, toDisplayString as i, createCommentVNode as y, renderList as L, withModifiers as g, withDirectives as M, vModelText as R, createBlock as K, withCtx as W, normalizeStyle as X, nextTick as re } from "vue";
import { useInvadeUi as ue } from "../context.js";
import { tierColor as Z } from "../logic/labels.js";
import ee from "./Button.vue.js";
import d from "./Icon.vue.js";
import le from "./RankCrest.vue.js";
/* empty css               */
/* empty css                     */
const de = ["aria-label"], ve = { class: "iv-favs-head" }, me = {
  key: 0,
  class: "iv-favs-status",
  role: "status"
}, ce = ["aria-label"], fe = ["aria-pressed"], ye = ["aria-label", "onKeydown"], ke = ["aria-pressed", "onClick", "onDblclick"], he = ["placeholder", "aria-label", "onKeydown"], be = ["disabled", "title"], pe = {
  key: 2,
  class: "iv-fav-anchor iv-favs-folder-more"
}, _e = ["aria-label", "aria-expanded"], $e = {
  key: 0,
  class: "iv-fav-menu right",
  role: "menu"
}, Ce = {
  key: 0,
  class: "iv-favs-error",
  role: "alert"
}, ge = {
  key: 1,
  class: "iv-favs-empty"
}, we = {
  key: 2,
  class: "iv-favs-tiles"
}, ze = ["aria-label", "onClick"], Fe = ["src"], Ie = { class: "iv-fav-who" }, Ne = { key: 0 }, xe = { key: 1 }, Le = { class: "iv-fav-anchor" }, Ke = ["aria-label", "aria-expanded", "onClick"], Be = {
  key: 0,
  class: "iv-fav-menu right",
  role: "menu"
}, Se = { class: "iv-fav-menu-label" }, Ue = ["aria-checked", "onClick"], Ae = ["aria-checked", "onClick"], De = ["onClick"], Ve = {
  key: 0,
  class: "iv-fav-tile iv-fav-more-tile"
}, Ee = ["aria-label"], Me = ["aria-pressed"], Re = ["aria-label", "onKeydown"], Oe = ["aria-pressed", "onClick", "onDblclick"], Pe = ["aria-label", "aria-expanded", "onClick"], Te = {
  key: 0,
  class: "iv-fav-menu",
  role: "menu"
}, Ge = ["onClick"], He = ["onClick"], Ye = ["placeholder", "aria-label", "onKeydown"], je = ["disabled"], qe = {
  key: 2,
  class: "iv-favs-error",
  role: "alert"
}, Je = { class: "iv-favs-body" }, Qe = { class: "iv-favs-head" }, We = {
  key: 0,
  class: "iv-favs-status",
  role: "status"
}, Xe = {
  key: 0,
  class: "iv-favs-empty"
}, Ze = {
  key: 1,
  class: "iv-favs-rows"
}, el = ["aria-label", "onClick"], ll = ["src"], tl = { class: "iv-fav-who" }, al = { class: "iv-fav-rank" }, nl = { key: 0 }, ol = { class: "iv-fav-anchor" }, il = ["aria-label", "aria-expanded", "onClick"], sl = {
  key: 0,
  class: "iv-fav-menu right",
  role: "menu"
}, rl = { class: "iv-fav-menu-label" }, ul = ["aria-checked", "onClick"], dl = ["aria-checked", "onClick"], vl = ["onClick"], _l = /* @__PURE__ */ oe({
  __name: "ProfileFavorites",
  props: {
    folders: {},
    profiles: {},
    status: { default: "" },
    layout: { default: "strip" },
    busy: { type: Boolean },
    limit: { default: 8 },
    title: { default: "" }
  },
  emits: ["open", "create", "rename", "removeFolder", "move", "remove", "search"],
  setup(c, { emit: te }) {
    const _ = c, B = te, { assetUrl: G, t: s } = ue(), k = F("all"), O = F(!1), h = E(() => _.folders.find((n) => n.id === k.value) ?? null), P = E(() => k.value === "all" ? _.profiles : _.profiles.filter((n) => n.folderId === k.value)), S = E(() => _.layout === "strip" && !O.value ? P.value.slice(0, _.limit) : P.value), H = E(() => P.value.length - S.value.length), Y = (n) => _.profiles.filter((t) => t.folderId === n).length, T = (n) => _.folders.find((t) => t.id === n)?.name ?? "";
    function A(n) {
      k.value = n, O.value = !1, f.value = null;
    }
    const $ = F(null), p = F(""), w = F(""), z = F(null);
    async function N(n) {
      $.value = n, p.value = n === "new" ? "" : T(n), w.value = "", f.value = null, await re();
      const t = Array.isArray(z.value) ? z.value[0] : z.value;
      t?.focus(), t?.select();
    }
    function C() {
      const n = $.value;
      if (!n) return;
      const t = p.value.trim();
      if (!t) return x();
      if (_.folders.some((e) => e.id !== n && e.name.toLowerCase() === t.toLowerCase())) {
        w.value = s("You already have a folder with this name");
        return;
      }
      n === "new" ? B("create", t) : t !== T(n) && B("rename", n, t), x();
    }
    function x() {
      $.value = null, w.value = "";
    }
    function j(n) {
      B("removeFolder", n), k.value === n && (k.value = "all"), f.value = null;
    }
    const f = F(null);
    function D(n) {
      f.value = f.value === n ? null : n;
    }
    function q(n) {
      f.value && !n.target?.closest?.(".iv-fav-menu, .iv-fav-more") && (f.value = null);
    }
    ie(() => document.addEventListener("pointerdown", q)), se(() => document.removeEventListener("pointerdown", q));
    function V(n, t) {
      n.folderId !== t && B("move", n.puuid, t), f.value = null;
    }
    function J(n) {
      B("remove", n.puuid), f.value = null;
    }
    const Q = (n) => n.tier ? n.tier.charAt(0) + n.tier.slice(1).toLowerCase() + (n.division && !/MASTER|CHALLENGER/.test(n.tier) ? " " + n.division : "") : "", ae = (n) => n.platform.replace(/\d+$/, "");
    return (n, t) => (a(), r("section", {
      class: I(["iv-favs", `iv-favs-${c.layout}`]),
      "aria-label": o(s)("Favorite players"),
      onKeydown: t[14] || (t[14] = U((e) => f.value = null, ["esc"]))
    }, [
      c.layout === "strip" ? (a(), r(b, { key: 0 }, [
        l("header", ve, [
          l("h2", null, [
            v(d, {
              name: "star",
              size: 14
            }),
            m(i(c.title || o(s)("Favorites")), 1)
          ]),
          c.status ? (a(), r("span", me, i(c.status), 1)) : y("", !0)
        ]),
        l("nav", {
          class: "iv-favs-tabs",
          "aria-label": o(s)("Folders")
        }, [
          l("button", {
            type: "button",
            class: I({ on: k.value === "all" }),
            "aria-pressed": k.value === "all",
            onClick: t[0] || (t[0] = (e) => A("all"))
          }, [
            m(i(o(s)("All")), 1),
            l("small", null, i(c.profiles.length), 1)
          ], 10, fe),
          (a(!0), r(b, null, L(c.folders, (e) => (a(), r(b, {
            key: e.id
          }, [
            $.value === e.id ? (a(), r("form", {
              key: 0,
              class: "iv-favs-name",
              onSubmit: g(C, ["prevent"])
            }, [
              M(l("input", {
                ref_for: !0,
                ref_key: "field",
                ref: z,
                "onUpdate:modelValue": t[1] || (t[1] = (u) => p.value = u),
                maxlength: "40",
                "aria-label": o(s)("Folder name"),
                onKeydown: U(g(x, ["stop"]), ["esc"]),
                onBlur: C
              }, null, 40, ye), [
                [R, p.value]
              ])
            ], 32)) : (a(), r("button", {
              key: 1,
              type: "button",
              class: I({ on: k.value === e.id }),
              "aria-pressed": k.value === e.id,
              onClick: (u) => A(e.id),
              onDblclick: (u) => N(e.id)
            }, [
              m(i(e.name), 1),
              l("small", null, i(Y(e.id)), 1)
            ], 42, ke))
          ], 64))), 128)),
          $.value === "new" ? (a(), r("form", {
            key: 0,
            class: "iv-favs-name",
            onSubmit: g(C, ["prevent"])
          }, [
            M(l("input", {
              ref_key: "field",
              ref: z,
              "onUpdate:modelValue": t[2] || (t[2] = (e) => p.value = e),
              maxlength: "40",
              placeholder: o(s)("Folder name"),
              "aria-label": o(s)("Folder name"),
              onKeydown: U(g(x, ["stop"]), ["esc"]),
              onBlur: C
            }, null, 40, he), [
              [R, p.value]
            ])
          ], 32)) : (a(), r("button", {
            key: 1,
            type: "button",
            class: "iv-favs-new",
            disabled: c.busy,
            title: o(s)("New folder"),
            onClick: t[3] || (t[3] = (e) => N("new"))
          }, [
            v(d, {
              name: "plus",
              size: 13
            }),
            l("span", null, i(o(s)("Folder")), 1)
          ], 8, be)),
          h.value && $.value !== h.value.id ? (a(), r("span", pe, [
            l("button", {
              type: "button",
              class: "iv-fav-more",
              "aria-label": `${o(s)("Folder options")} · ${h.value.name}`,
              "aria-expanded": f.value === "f:" + h.value.id,
              onClick: t[4] || (t[4] = (e) => D("f:" + h.value.id))
            }, [
              v(d, {
                name: "more",
                size: 15
              })
            ], 8, _e),
            f.value === "f:" + h.value.id ? (a(), r("div", $e, [
              l("button", {
                type: "button",
                role: "menuitem",
                onClick: t[5] || (t[5] = (e) => N(h.value.id))
              }, [
                v(d, {
                  name: "pencil",
                  size: 13
                }),
                m(i(o(s)("Rename")), 1)
              ]),
              l("button", {
                type: "button",
                role: "menuitem",
                class: "danger",
                onClick: t[6] || (t[6] = (e) => j(h.value.id))
              }, [
                v(d, {
                  name: "trash",
                  size: 13
                }),
                m(i(o(s)("Delete folder")), 1)
              ]),
              l("p", null, i(o(s)("Players in it stay in your favorites.")), 1)
            ])) : y("", !0)
          ])) : y("", !0)
        ], 8, ce),
        w.value ? (a(), r("p", Ce, i(w.value), 1)) : y("", !0),
        S.value.length ? (a(), r("ul", we, [
          (a(!0), r(b, null, L(S.value, (e) => (a(), r("li", {
            key: e.puuid,
            class: I(["iv-fav-tile", { menu: f.value === "p:" + e.puuid }])
          }, [
            l("button", {
              type: "button",
              class: "iv-fav-hit",
              "aria-label": `${o(s)("Open profile")} · ${e.gameName}#${e.tagLine}`,
              onClick: (u) => n.$emit("open", e)
            }, null, 8, ze),
            l("img", {
              src: o(G)("profileIcon", e.profileIconId ?? 1),
              alt: "",
              width: "34",
              height: "34"
            }, null, 8, Fe),
            l("span", Ie, [
              l("b", null, i(e.gameName), 1),
              e.tier ? (a(), r("small", Ne, [
                v(le, {
                  tier: e.tier,
                  size: 13
                }, null, 8, ["tier"]),
                l("span", {
                  style: X({ color: o(Z)(e.tier) })
                }, i(Q(e)), 5)
              ])) : (a(), r("small", xe, "#" + i(e.tagLine), 1))
            ]),
            l("span", Le, [
              l("button", {
                type: "button",
                class: "iv-fav-more",
                "aria-label": `${o(s)("Options")} · ${e.gameName}`,
                "aria-expanded": f.value === "p:" + e.puuid,
                onClick: (u) => D("p:" + e.puuid)
              }, [
                v(d, {
                  name: "more",
                  size: 15
                })
              ], 8, Ke),
              f.value === "p:" + e.puuid ? (a(), r("div", Be, [
                l("span", Se, i(o(s)("Move to")), 1),
                l("button", {
                  type: "button",
                  role: "menuitemradio",
                  "aria-checked": !e.folderId,
                  onClick: (u) => V(e, null)
                }, [
                  m(i(o(s)("No folder")), 1),
                  e.folderId ? y("", !0) : (a(), K(d, {
                    key: 0,
                    name: "check",
                    size: 13
                  }))
                ], 8, Ue),
                (a(!0), r(b, null, L(c.folders, (u) => (a(), r("button", {
                  key: u.id,
                  type: "button",
                  role: "menuitemradio",
                  "aria-checked": e.folderId === u.id,
                  onClick: (ne) => V(e, u.id)
                }, [
                  m(i(u.name), 1),
                  e.folderId === u.id ? (a(), K(d, {
                    key: 0,
                    name: "check",
                    size: 13
                  })) : y("", !0)
                ], 8, Ae))), 128)),
                t[15] || (t[15] = l("hr", null, null, -1)),
                l("button", {
                  type: "button",
                  role: "menuitem",
                  class: "danger",
                  onClick: (u) => J(e)
                }, [
                  v(d, {
                    name: "star",
                    size: 13
                  }),
                  m(i(o(s)("Remove from favorites")), 1)
                ], 8, De)
              ])) : y("", !0)
            ])
          ], 2))), 128)),
          H.value > 0 ? (a(), r("li", Ve, [
            l("button", {
              type: "button",
              class: "iv-fav-hit",
              onClick: t[8] || (t[8] = (e) => O.value = !0)
            }),
            l("span", null, i(o(s)("+{n} more", { n: H.value })), 1)
          ])) : y("", !0)
        ])) : (a(), r("div", ge, [
          l("p", null, i(c.profiles.length ? o(s)("Nobody in {folder} yet. Use a player’s menu to move them here.", { folder: h.value?.name ?? "" }) : o(s)("Star a player on their profile to keep them here.")), 1),
          c.profiles.length ? y("", !0) : (a(), K(ee, {
            key: 0,
            variant: "ghost",
            size: "sm",
            onClick: t[7] || (t[7] = (e) => n.$emit("search"))
          }, {
            default: W(() => [
              v(d, {
                name: "search",
                size: 13
              }),
              m(i(o(s)("Find a player")), 1)
            ]),
            _: 1
          }))
        ]))
      ], 64)) : (a(), r(b, { key: 1 }, [
        l("nav", {
          class: "iv-favs-rail",
          "aria-label": o(s)("Folders")
        }, [
          l("button", {
            type: "button",
            class: I({ on: k.value === "all" }),
            "aria-pressed": k.value === "all",
            onClick: t[9] || (t[9] = (e) => A("all"))
          }, [
            v(d, {
              name: "users",
              size: 14
            }),
            m(i(o(s)("All players")), 1),
            l("small", null, i(c.profiles.length), 1)
          ], 10, Me),
          (a(!0), r(b, null, L(c.folders, (e) => (a(), r(b, {
            key: e.id
          }, [
            $.value === e.id ? (a(), r("form", {
              key: 0,
              class: "iv-favs-name",
              onSubmit: g(C, ["prevent"])
            }, [
              M(l("input", {
                ref_for: !0,
                ref_key: "field",
                ref: z,
                "onUpdate:modelValue": t[10] || (t[10] = (u) => p.value = u),
                maxlength: "40",
                "aria-label": o(s)("Folder name"),
                onKeydown: U(g(x, ["stop"]), ["esc"]),
                onBlur: C
              }, null, 40, Re), [
                [R, p.value]
              ])
            ], 32)) : (a(), r("span", {
              key: 1,
              class: I(["iv-favs-rail-item iv-fav-anchor", { on: k.value === e.id }])
            }, [
              l("button", {
                type: "button",
                "aria-pressed": k.value === e.id,
                onClick: (u) => A(e.id),
                onDblclick: (u) => N(e.id)
              }, [
                v(d, {
                  name: "folder",
                  size: 14
                }),
                m(i(e.name), 1),
                l("small", null, i(Y(e.id)), 1)
              ], 40, Oe),
              l("button", {
                type: "button",
                class: "iv-fav-more",
                "aria-label": `${o(s)("Folder options")} · ${e.name}`,
                "aria-expanded": f.value === "f:" + e.id,
                onClick: (u) => D("f:" + e.id)
              }, [
                v(d, {
                  name: "more",
                  size: 15
                })
              ], 8, Pe),
              f.value === "f:" + e.id ? (a(), r("div", Te, [
                l("button", {
                  type: "button",
                  role: "menuitem",
                  onClick: (u) => N(e.id)
                }, [
                  v(d, {
                    name: "pencil",
                    size: 13
                  }),
                  m(i(o(s)("Rename")), 1)
                ], 8, Ge),
                l("button", {
                  type: "button",
                  role: "menuitem",
                  class: "danger",
                  onClick: (u) => j(e.id)
                }, [
                  v(d, {
                    name: "trash",
                    size: 13
                  }),
                  m(i(o(s)("Delete folder")), 1)
                ], 8, He),
                l("p", null, i(o(s)("Players in it stay in your favorites.")), 1)
              ])) : y("", !0)
            ], 2))
          ], 64))), 128)),
          $.value === "new" ? (a(), r("form", {
            key: 0,
            class: "iv-favs-name",
            onSubmit: g(C, ["prevent"])
          }, [
            M(l("input", {
              ref_key: "field",
              ref: z,
              "onUpdate:modelValue": t[11] || (t[11] = (e) => p.value = e),
              maxlength: "40",
              placeholder: o(s)("Folder name"),
              "aria-label": o(s)("Folder name"),
              onKeydown: U(g(x, ["stop"]), ["esc"]),
              onBlur: C
            }, null, 40, Ye), [
              [R, p.value]
            ])
          ], 32)) : (a(), r("button", {
            key: 1,
            type: "button",
            class: "iv-favs-new",
            disabled: c.busy,
            onClick: t[12] || (t[12] = (e) => N("new"))
          }, [
            v(d, {
              name: "plus",
              size: 14
            }),
            m(i(o(s)("New folder")), 1)
          ], 8, je)),
          w.value ? (a(), r("p", qe, i(w.value), 1)) : y("", !0)
        ], 8, Ee),
        l("div", Je, [
          l("header", Qe, [
            l("h2", null, i(h.value ? h.value.name : o(s)("All players")), 1),
            c.status ? (a(), r("span", We, i(c.status), 1)) : y("", !0)
          ]),
          S.value.length ? (a(), r("ul", Ze, [
            (a(!0), r(b, null, L(S.value, (e) => (a(), r("li", {
              key: e.puuid,
              class: I(["iv-fav-row", { menu: f.value === "p:" + e.puuid }])
            }, [
              l("button", {
                type: "button",
                class: "iv-fav-hit",
                "aria-label": `${o(s)("Open profile")} · ${e.gameName}#${e.tagLine}`,
                onClick: (u) => n.$emit("open", e)
              }, null, 8, el),
              l("img", {
                src: o(G)("profileIcon", e.profileIconId ?? 1),
                alt: "",
                width: "32",
                height: "32"
              }, null, 8, ll),
              l("span", tl, [
                l("b", null, [
                  m(i(e.gameName), 1),
                  l("small", null, "#" + i(e.tagLine), 1)
                ]),
                l("small", null, [
                  m(i(ae(e)), 1),
                  k.value === "all" && e.folderId ? (a(), r(b, { key: 0 }, [
                    t[16] || (t[16] = l("i", null, "·", -1)),
                    v(d, {
                      name: "folder",
                      size: 11
                    }),
                    m(i(T(e.folderId)), 1)
                  ], 64)) : y("", !0)
                ])
              ]),
              l("span", al, [
                e.tier ? (a(), r(b, { key: 0 }, [
                  v(le, {
                    tier: e.tier,
                    size: 18
                  }, null, 8, ["tier"]),
                  l("b", {
                    style: X({ color: o(Z)(e.tier) })
                  }, i(Q(e)), 5),
                  e.lp != null ? (a(), r("small", nl, i(e.lp) + " " + i(o(s)("LP")), 1)) : y("", !0)
                ], 64)) : y("", !0)
              ]),
              l("span", ol, [
                l("button", {
                  type: "button",
                  class: "iv-fav-more",
                  "aria-label": `${o(s)("Options")} · ${e.gameName}`,
                  "aria-expanded": f.value === "p:" + e.puuid,
                  onClick: (u) => D("p:" + e.puuid)
                }, [
                  v(d, {
                    name: "more",
                    size: 15
                  })
                ], 8, il),
                f.value === "p:" + e.puuid ? (a(), r("div", sl, [
                  l("span", rl, i(o(s)("Move to")), 1),
                  l("button", {
                    type: "button",
                    role: "menuitemradio",
                    "aria-checked": !e.folderId,
                    onClick: (u) => V(e, null)
                  }, [
                    m(i(o(s)("No folder")), 1),
                    e.folderId ? y("", !0) : (a(), K(d, {
                      key: 0,
                      name: "check",
                      size: 13
                    }))
                  ], 8, ul),
                  (a(!0), r(b, null, L(c.folders, (u) => (a(), r("button", {
                    key: u.id,
                    type: "button",
                    role: "menuitemradio",
                    "aria-checked": e.folderId === u.id,
                    onClick: (ne) => V(e, u.id)
                  }, [
                    m(i(u.name), 1),
                    e.folderId === u.id ? (a(), K(d, {
                      key: 0,
                      name: "check",
                      size: 13
                    })) : y("", !0)
                  ], 8, dl))), 128)),
                  t[17] || (t[17] = l("hr", null, null, -1)),
                  l("button", {
                    type: "button",
                    role: "menuitem",
                    class: "danger",
                    onClick: (u) => J(e)
                  }, [
                    v(d, {
                      name: "star",
                      size: 13
                    }),
                    m(i(o(s)("Remove from favorites")), 1)
                  ], 8, vl)
                ])) : y("", !0)
              ]),
              v(d, {
                name: "right",
                size: 15,
                class: "iv-fav-go"
              })
            ], 2))), 128))
          ])) : (a(), r("div", Xe, [
            l("p", null, i(c.profiles.length ? o(s)("Nobody in {folder} yet. Use a player’s menu to move them here.", { folder: h.value?.name ?? "" }) : o(s)("Star a player on their profile to keep them here.")), 1),
            c.profiles.length ? y("", !0) : (a(), K(ee, {
              key: 0,
              variant: "ghost",
              size: "sm",
              onClick: t[13] || (t[13] = (e) => n.$emit("search"))
            }, {
              default: W(() => [
                v(d, {
                  name: "search",
                  size: 13
                }),
                m(i(o(s)("Find a player")), 1)
              ]),
              _: 1
            }))
          ]))
        ])
      ], 64))
    ], 42, de));
  }
});
export {
  _l as default
};
