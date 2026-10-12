function M(t) {
  const s = (n) => n.toFixed(1);
  if (t.length < 3) return t.map(([n, o], a) => `${a ? "L" : "M"}${s(n)} ${s(o)}`).join("");
  const h = (n) => (t[n + 1][1] - t[n][1]) / (t[n + 1][0] - t[n][0] || 1), e = t.map((n, o) => {
    if (o === 0 || o === t.length - 1) return NaN;
    const a = t[o][0] - t[o - 1][0], l = t[o + 1][0] - t[o][0], $ = h(o - 1), c = h(o), g = ($ * l + c * a) / (a + l);
    return (Math.sign($) + Math.sign(c)) * Math.min(Math.abs($), Math.abs(c), 0.5 * Math.abs(g)) || 0;
  });
  e[0] = (3 * h(0) - e[1]) / 2, e[t.length - 1] = (3 * h(t.length - 2) - e[t.length - 2]) / 2;
  let r = `M${s(t[0][0])} ${s(t[0][1])}`;
  for (let n = 0; n < t.length - 1; n++) {
    const o = (t[n + 1][0] - t[n][0]) / 3;
    r += `C${s(t[n][0] + o)} ${s(t[n][1] + e[n] * o)} ${s(t[n + 1][0] - o)} ${s(t[n + 1][1] - e[n + 1] * o)} ${s(t[n + 1][0])} ${s(t[n + 1][1])}`;
  }
  return r;
}
export {
  M as monotone
};
