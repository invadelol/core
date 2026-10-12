const h = { solo: 420, flex: 440 };
function m(r, a) {
  const o = /* @__PURE__ */ new Map();
  if (!r.length) return o;
  for (const [f, d] of Object.entries(h)) {
    const s = r.filter((e) => e.queue === f), w = a.filter((e) => e.queueId === d && !e.remake);
    for (let e = 1; e < s.length; e++) {
      const t = s[e - 1], n = s[e], i = n.wins - t.wins, u = n.losses - t.losses;
      if (i < 0 || u < 0 || i + u !== 1) continue;
      const c = w.filter((l) => l.creation > t.t && l.creation + l.duration * 1e3 <= n.t);
      c.length !== 1 || c[0].win !== (i === 1) || o.set(c[0].gameId, Math.round(n.value - t.value));
    }
  }
  return o;
}
export {
  m as lpByGame
};
