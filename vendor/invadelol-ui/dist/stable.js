import { shallowRef as s, watch as b, getCurrentScope as A, onScopeDispose as P } from "vue";
const w = 200;
function T(e, t = w) {
  const r = s(!1);
  let o;
  return b(
    e,
    (y) => {
      clearTimeout(o), o = void 0, y ? r.value || (o = setTimeout(() => r.value = !0, t)) : r.value = !1;
    },
    { immediate: !0, flush: "sync" }
  ), A() && P(() => clearTimeout(o)), r;
}
const O = (e) => !!e && typeof e == "object" && Object.getPrototypeOf(e) === Object.prototype;
function E(e, t) {
  if (Object.is(e, t)) return !0;
  if (Array.isArray(e) && Array.isArray(t)) return e.length === t.length && e.every((r, o) => Object.is(r, t[o]));
  if (O(e) && O(t)) {
    const r = Object.keys(e);
    return r.length === Object.keys(t).length && r.every((o) => Object.is(e[o], t[o]));
  }
  return !1;
}
const S = (e) => !!e && typeof e.then == "function";
function q(e, t, r = {}) {
  const { delay: o = w, same: y = E } = r, m = s(), d = s(), p = s(!1), l = s(!1), v = s(), D = T(l, o);
  let a = 0, i = null;
  function h(n, c) {
    m.value = c, d.value = n, p.value = !0, v.value = void 0, l.value = !1;
  }
  function g(n) {
    v.value = n ?? new Error("failed"), l.value = !1;
  }
  function j(n) {
    const c = ++a;
    i = { key: n };
    let f;
    try {
      f = t(n);
    } catch (u) {
      return g(u), Promise.resolve();
    }
    return S(f) ? (l.value = !0, Promise.resolve(f).then(
      (u) => {
        c === a && h(n, u);
      },
      (u) => {
        c === a && g(u);
      }
    )) : (h(n, f), Promise.resolve());
  }
  return b(e, (n) => {
    i && y(i.key, n) ? void 0 : j(n);
  }, { immediate: !0 }), A() && P(() => {
    a++;
  }), { data: m, key: d, ready: p, pending: l, busy: D, error: v, reload: () => i ? j(i.key) : Promise.resolve() };
}
export {
  w as QUIET_DELAY,
  E as sameKey,
  T as useDelayedFlag,
  q as useStableData
};
