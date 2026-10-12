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
const p = {
  8e3: [[8005, 8008, 8021, 8010], [9101, 9111, 8009], [9104, 9105, 9103], [8014, 8017, 8299]],
  8100: [[8112, 8128, 9923], [8126, 8139, 8143], [8137, 8140, 8141], [8135, 8105, 8106]],
  8200: [[8214, 8229, 8230, 8992], [8224, 8226, 8275], [8210, 8234, 8233], [8237, 8232, 8236]],
  8400: [[8437, 8439, 8465], [8446, 8463, 8401], [8429, 8444, 8473], [8451, 8453, 8242]],
  8300: [[8351, 8360, 8369], [8306, 8304, 8321], [8313, 8345, 8352], [8347, 8410, 8316]]
}, y = (e) => !!e.timeline && (e.timeline.kills.length > 0 || e.timeline.objectives.length > 0), r = {
  fighting: i("Fighting"),
  damage: i("Damage"),
  farming: i("Farming"),
  vision: i("Vision"),
  objectives: i("Objectives")
}, I = Object.keys(r), h = {
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
function E(e) {
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
function k(e, n, l, t) {
  const s = t * 60;
  if (!e.t.length || e.t[e.t.length - 1] < s) return null;
  let a = 0;
  for (; a + 1 < e.t.length && e.t[a + 1] <= s; ) a++;
  return { minute: t, gold: e.gold[n][a] - e.gold[l][a], cs: e.cs[n][a] - e.cs[l][a], xp: e.xp[n][a] - e.xp[l][a] };
}
export {
  h as PINGS,
  p as RUNE_SLOTS,
  I as SCORE_CATEGORIES,
  r as SCORE_PARTS,
  y as hasEvents,
  k as laneLead,
  m as lineColor,
  d as relation,
  f as riotId,
  g as side,
  E as skillMatrix,
  v as skillPriority,
  u as teamsOf
};
