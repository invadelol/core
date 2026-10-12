const G = 15;
const A = [
  { id: "early", from: 0, to: 840 },
  { id: "mid", from: 840, to: 1500 },
  { id: "late", from: 1500, to: 1 / 0 }
], M = (n) => n === 100 ? 200 : 100;
function E(n, e) {
  const r = new Map(n.players.map((t) => [t.participantId, t])), o = (t) => r.get(t)?.teamId ?? 0, s = [...e.kills].sort((t, i) => t.t - i.t), d = /* @__PURE__ */ new Map(), h = /* @__PURE__ */ new Map();
  s.forEach((t, i) => {
    if (!t.killer) return;
    const c = h.get(t.killer);
    c && t.t - c.at <= 10 ? (c.n++, c.at = t.t, d.set(i, Math.min(5, c.n))) : h.set(t.killer, { n: 1, at: t.t });
  });
  const a = [], g = /* @__PURE__ */ new Map();
  let l = [];
  const u = () => {
    if (l.length >= 2) {
      const t = { start: s[l[0]].t, end: s[l[l.length - 1]].t, kills: /* @__PURE__ */ new Map() };
      for (const i of l) {
        const c = m(s[i]);
        t.kills.set(c, (t.kills.get(c) ?? 0) + 1), g.set(i, a.length);
      }
      a.push(t);
    }
    l = [];
  };
  function m(t) {
    return o(t.killer) || M(o(t.victim));
  }
  s.forEach((t, i) => {
    l.length && t.t - s[l[l.length - 1]].t > 15 && u(), l.push(i);
  }), u();
  const k = s.map((t, i) => ({
    kind: "kill",
    key: `k${i}`,
    t: t.t,
    kill: t,
    team: m(t),
    first: i === 0,
    multi: d.get(i) ?? 0,
    fight: g.get(i) ?? -1
  })), p = [...e.objectives].sort((t, i) => t.t - i.t);
  let f;
  return p.forEach((t, i) => {
    if (f && f.obj.kind === t.kind && t.kind !== "tower" && t.kind !== "inhibitor" && f.team === t.team && t.t - f.t <= 45) {
      f.count++;
      return;
    }
    f = { kind: "objective", key: `o${i}`, t: t.t, obj: t, team: t.team, count: 1 }, k.push(f);
  }), k.sort((t, i) => t.t - i.t || (t.kind === i.kind ? 0 : t.kind === "kill" ? -1 : 1)), { events: k, fights: a, byId: r };
}
function w(n, e) {
  return n.kind === "objective" ? n.obj.killer === e : n.kill.killer === e || n.kill.victim === e || n.kill.assists.includes(e);
}
const I = (n) => n.kind === "objective" && n.obj.kind !== "tower";
function y(n, e) {
  const r = /* @__PURE__ */ new Map();
  for (const o of n.events) {
    if (o.t > e) break;
    o.kind === "kill" && r.set(o.team, (r.get(o.team) ?? 0) + 1);
  }
  return r;
}
function P(n, e, r) {
  if (!e.length) return 0;
  if (r <= n[0]) return e[0];
  for (let o = 1; o < n.length && o < e.length; o++)
    if (r <= n[o]) {
      const s = n[o] - n[o - 1] || 1;
      return e[o - 1] + (e[o] - e[o - 1]) * (r - n[o - 1]) / s;
    }
  return e[Math.min(n.length, e.length) - 1];
}
const _ = (n, e) => e === 200 ? n.goldDiff.map((r) => -r) : n.goldDiff;
export {
  G as FIGHT_GAP,
  A as PHASES,
  w as involves,
  I as isEpic,
  _ as leadFor,
  y as scoreAt,
  E as storyOf,
  P as valueAt
};
