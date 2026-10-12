const e = /\{(\w+)\}/g, i = (n, t) => t ? n.replace(e, (o, c) => c in t ? String(t[c]) : o) : n, l = i, g = (n) => n;
export {
  l as english,
  i as fill,
  g as tk
};
