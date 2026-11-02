let o = null, e = null, l = 0;
function h() {
  return o || (o = document.createElement("div"), o.className = "iv-tip", o.setAttribute("role", "tooltip"), document.body.append(o)), o;
}
const u = (t) => {
  !e || t.target instanceof Node && e.contains(t.target) || f();
};
function d(t) {
  const s = t ? document.addEventListener : document.removeEventListener;
  s.call(document, "pointerdown", u, !0), s.call(document, "scroll", u, !0);
}
function v(t, s, c = 0) {
  const n = h();
  n.textContent = s, n.classList.toggle("iv-light", !!t.closest(".iv-light")), n.classList.toggle("iv-dark", !!t.closest(".iv-dark"));
  const i = t.getBoundingClientRect(), r = n.offsetWidth, a = n.offsetHeight, m = Math.min(Math.max(8, i.left + i.width / 2 - r / 2), window.innerWidth - r - 8), p = i.top - a - 6 >= 8 ? i.top - a - 6 : i.bottom + 6;
  n.style.transform = `translate(${Math.round(m)}px, ${Math.round(p)}px)`, n.classList.add("on"), e || d(!0), e = t, clearTimeout(l), c && (l = window.setTimeout(f, c));
}
function f(t) {
  !e || t && t !== e || (clearTimeout(l), o?.classList.remove("on"), e = null, d(!1));
}
const w = (t) => e === t;
export {
  f as hideTip,
  v as showTip,
  w as tipOn
};
