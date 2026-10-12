function l(e, t) {
  return t && e.participantId === t.participantId ? "var(--brand)" : !t || e.teamId === t.teamId ? "var(--win)" : "var(--loss)";
}
const m = (e, t) => !t || e === t.teamId ? "ally" : "enemy", s = (e) => e === 100 ? "blue" : e === 200 ? "red" : "", c = (e) => e.gameName ? `${e.gameName}#${e.tagLine}` : "";
function o(e, t) {
  return e.teams.map((n) => {
    const a = e.players.filter((r) => r.teamId === n.teamId);
    return { team: n, players: a, placement: a[0]?.placement ?? 0 };
  }).sort((n, a) => {
    if (t) {
      if (n.team.teamId === t.teamId) return -1;
      if (a.team.teamId === t.teamId) return 1;
    }
    return n.placement && a.placement ? n.placement - a.placement : n.team.teamId - a.team.teamId;
  });
}
const d = {
  8e3: [[8005, 8008, 8021, 8010], [9101, 9111, 8009], [9104, 9105, 9103], [8014, 8017, 8299]],
  8100: [[8112, 8128, 9923], [8126, 8139, 8143], [8137, 8140, 8141], [8135, 8105, 8106]],
  8200: [[8214, 8229, 8230, 8992], [8224, 8226, 8275], [8210, 8234, 8233], [8237, 8232, 8236]],
  8400: [[8437, 8439, 8465], [8446, 8463, 8401], [8429, 8444, 8473], [8451, 8453, 8242]],
  8300: [[8351, 8360, 8369], [8306, 8304, 8321], [8313, 8345, 8352], [8347, 8410, 8316]]
}, I = (e) => !!e.timeline && (e.timeline.kills.length > 0 || e.timeline.objectives.length > 0);
export {
  d as RUNE_SLOTS,
  I as hasEvents,
  l as lineColor,
  m as relation,
  c as riotId,
  s as side,
  o as teamsOf
};
