const i = /* @__PURE__ */ new Map();
function a(t, e = 0, n = "en") {
  const r = `${n}|${e}`;
  let o = i.get(r);
  return o || i.set(r, o = new Intl.NumberFormat(n, { minimumFractionDigits: e, maximumFractionDigits: e })), o.format(t);
}
function f(t) {
  const e = Math.max(0, Math.floor(t));
  return `${Math.floor(e / 60)}:${String(e % 60).padStart(2, "0")}`;
}
function c(t, e = "en") {
  const n = t > 0 ? "+" : t < 0 ? "-" : "", r = Math.abs(t);
  return n + (r >= 1e3 ? `${a(r / 1e3, 1, e)}k` : a(r, 0, e));
}
function h(t, e = "en") {
  return `${a(Math.round(t * 100), 0, e)}%`;
}
function d(t, e = "en") {
  return t >= 1e5 ? `${a(Math.round(t / 1e3), 0, e)}k` : t >= 1e3 ? `${a(t / 1e3, 1, e)}k` : a(t, 0, e);
}
function M(t, e = "en") {
  if (e.startsWith("en")) {
    const n = t % 100, r = n >= 11 && n <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[t % 10] ?? "th";
    return `${t}${r}`;
  }
  return e.startsWith("fr") ? t === 1 ? "1er" : `${t}e` : `#${t}`;
}
const g = (t) => Math.round(Math.max(0, Math.min(10, t)) * 10), $ = (t, e, n, r = "en") => e === 0 ? t + n > 0 ? "∞" : "0" : a((t + n) / e, 2, r), l = (t) => `${t > 0 ? "+" : t < 0 ? "−" : "±"}${Math.abs(t)}`;
function w(t, e = "en") {
  const n = (t - Date.now()) / 1e3, r = new Intl.RelativeTimeFormat(e, { numeric: "auto", style: "short" }), o = Math.abs(n);
  return o < 3600 ? r.format(Math.round(n / 60), "minute") : o < 86400 ? r.format(Math.round(n / 3600), "hour") : o < 86400 * 30 ? r.format(Math.round(n / 86400), "day") : r.format(Math.round(n / (86400 * 30)), "month");
}
function D(t, e, n, r = "en") {
  const o = new Date(t), u = /* @__PURE__ */ new Date();
  u.setHours(0, 0, 0, 0);
  const s = Math.round((u.getTime() - new Date(o.getFullYear(), o.getMonth(), o.getDate()).getTime()) / 864e5);
  if (s <= 0) return e;
  if (s === 1) return n;
  const m = o.getFullYear() === u.getFullYear();
  return new Intl.DateTimeFormat(r, { weekday: "long", day: "numeric", month: "long", year: m ? void 0 : "numeric" }).format(o);
}
const y = (t) => {
  const e = new Date(t);
  return `${e.getFullYear()}-${e.getMonth()}-${e.getDate()}`;
};
export {
  w as ago,
  d as compact,
  y as dayKey,
  D as dayLabel,
  $ as kdaRatio,
  f as mmss,
  a as num,
  M as ordinal,
  h as pct,
  g as score100,
  c as signedGold,
  l as signedLp
};
