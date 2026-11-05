import { tk as i } from "./i18n.js";
function m(e, n) {
  return n && e.participantId === n.participantId ? "var(--brand)" : !n || e.teamId === n.teamId ? "var(--win)" : "var(--loss)";
}
const d = (e, n) => !n || e === n.teamId ? "ally" : "enemy", g = (e) => e === 100 ? "blue" : e === 200 ? "red" : "", f = (e) => e.gameName ? `${e.gameName}#${e.tagLine}` : "";
function u(e, n) {
  return e.teams.map((t) => {
    const s = e.players.filter((a) => a.teamId === t.teamId);
    return { team: t, players: s, placement: s[0]?.placement ?? 0 };
  }).sort((t, s) => {
    if (n) {
      if (t.team.teamId === n.teamId) return -1;
      if (s.team.teamId === n.teamId) return 1;
    }
    return t.placement && s.placement ? t.placement - s.placement : t.team.teamId - s.team.teamId;
  });
}
const p = (e) => !!e.timeline && (e.timeline.kills.length > 0 || e.timeline.objectives.length > 0), r = {
  fighting: i("Fighting"),
  damage: i("Damage"),
  farming: i("Farming"),
  vision: i("Vision"),
  objectives: i("Objectives")
}, y = Object.keys(r), I = {
  enemyMissing: i("Enemy missing"),
  onMyWay: i("On my way"),
  danger: i("Danger"),
  assist: i("Assist me"),
  allIn: i("All in"),
  push: i("Push"),
  getBack: i("Get back"),
  command: i("Command"),
  needVision: i("Need vision"),
  enemyVision: i("Enemy vision"),
  visionCleared: i("Vision cleared"),
  bait: i("Bait"),
  hold: i("Hold")
}, o = ["Q", "W", "E", "R"];
function h(e) {
  const n = Object.fromEntries(o.map((l) => [l, new Array(18).fill(null)]));
  return e.slice(0, 18).forEach((l, t) => {
    const s = o[l - 1];
    s && (n[s][t] = t + 1);
  }), n;
}
function v(e) {
  const n = [];
  for (const l of e) {
    const t = o[l - 1];
    t && t !== "R" && !n.includes(t) && n.push(t);
  }
  return n;
}
function E(e, n, l, t) {
  const s = t * 60;
  if (!e.t.length || e.t[e.t.length - 1] < s) return null;
  let a = 0;
  for (; a + 1 < e.t.length && e.t[a + 1] <= s; ) a++;
  return { minute: t, gold: e.gold[n][a] - e.gold[l][a], cs: e.cs[n][a] - e.cs[l][a], xp: e.xp[n][a] - e.xp[l][a] };
}
const k = (e) => !!e && !(e >= 1200 && e < 1300) && e !== 2055;
export {
  I as PINGS,
  y as SCORE_CATEGORIES,
  r as SCORE_PARTS,
  p as hasEvents,
  E as laneLead,
  m as lineColor,
  d as relation,
  f as riotId,
  k as roleSlot,
  g as side,
  h as skillMatrix,
  v as skillPriority,
  u as teamsOf
};
