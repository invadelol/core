import { defineComponent as V, computed as I, openBlock as t, createElementBlock as a, createElementVNode as m, Fragment as v, renderList as _, normalizeClass as f, unref as s, toDisplayString as h, createTextVNode as y, createCommentVNode as k } from "vue";
import { useInvadeUi as $, useNames as B } from "../context.js";
import { positionName as E } from "../logic/labels.js";
const P = { class: "iv-pp" }, w = { class: "iv-pp-row" }, z = ["title", "aria-pressed", "onClick"], D = ["src"], F = {
  key: 0,
  class: "iv-pp-name"
}, j = /* @__PURE__ */ V({
  __name: "PlayerPicker",
  props: {
    detail: {},
    selected: {},
    me: {}
  },
  emits: ["select"],
  setup(p, { emit: N }) {
    const l = p, g = N, { t: C } = $(), { champIcon: b, champName: c } = B(), x = I(() => {
      const i = l.detail.players.map((e, r) => ({ p: e, i: r })), d = l.me?.teamId ?? i[0]?.p.teamId;
      return [i.filter((e) => e.p.teamId === d), i.filter((e) => e.p.teamId !== d)].filter((e) => e.length);
    }), n = I(() => l.detail.players[l.selected]);
    return (i, d) => (t(), a("div", P, [
      m("div", w, [
        (t(!0), a(v, null, _(x.value, (e, r) => (t(), a("span", {
          key: r,
          class: f(["iv-pp-team", r ? "enemy" : "ally"])
        }, [
          (t(!0), a(v, null, _(e, ({ p: o, i: u }) => (t(), a("button", {
            key: o.participantId,
            type: "button",
            class: f({ on: u === p.selected }),
            title: `${o.gameName || s(c)(o.championId)} · ${s(c)(o.championId)}`,
            "aria-pressed": u === p.selected,
            onClick: (L) => g("select", u)
          }, [
            m("img", {
              src: s(b)(o.championId),
              alt: ""
            }, null, 8, D)
          ], 10, z))), 128))
        ], 2))), 128))
      ]),
      n.value ? (t(), a("p", F, [
        m("b", null, h(n.value.gameName || s(c)(n.value.championId)), 1),
        m("small", null, [
          y(h(s(c)(n.value.championId)), 1),
          n.value.position ? (t(), a(v, { key: 0 }, [
            y(" · " + h(s(E)(n.value.position, s(C))), 1)
          ], 64)) : k("", !0)
        ])
      ])) : k("", !0)
    ]));
  }
});
export {
  j as default
};
