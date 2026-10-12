import { rankValue as ss } from "./labels.js";
const F = { TOP: "TOP", JUNGLE: "JUNGLE", MIDDLE: "MID", BOTTOM: "ADC", UTILITY: "SUPPORT" }, es = /* @__PURE__ */ new Set(["carry_damage", "tank", "vision", "cc", "objectives", "first_blood", "triple", "quadra", "penta", "deathless", "lane_won"]), Y = 300, ts = 900 * 1e3, ls = (e) => F[e ?? ""] ?? null, ns = (e) => Number(e.slice(e.lastIndexOf("_") + 1)) || 0;
function is(e, g) {
  if (g.position) {
    const p = e.find((o) => o.teamId !== g.teamId && o.position === g.position);
    if (p) return p;
  }
  const c = e.filter((p) => p.teamId === g.teamId), n = e.filter((p) => p.teamId !== g.teamId);
  return n[c.indexOf(g)] ?? n[0];
}
function rs(e, g = {}) {
  const c = e.participants, n = e.timeline ?? [], p = e.events ?? [], o = p.length > 0, f = Math.max(e.duration / 60, 1), m = c.some((s) => s.position in F), h = /* @__PURE__ */ new Map();
  for (const s of n) s.puuid && !h.has(s.puuid) && h.set(s.puuid, s.participantId);
  const D = (s) => h.get(s.puuid) ?? c.indexOf(s) + 1, I = [...new Set(n.map((s) => s.frameMs))].sort((s, a) => s - a), E = new Map(I.map((s, a) => [s, a])), M = (s, a) => {
    const r = new Array(I.length).fill(0);
    for (const u of n) u.puuid === s && (r[E.get(u.frameMs)] = a(u));
    for (let u = 1; u < r.length; u++) !r[u] && r[u - 1] && (r[u] = r[u - 1]);
    return r;
  }, T = c.map((s) => M(s.puuid, (a) => a.goldTotal)), O = c.map((s) => M(s.puuid, (a) => a.xp)), t = c.map((s) => M(s.puuid, (a) => a.cs + a.jungleCs)), i = c.map((s) => M(s.puuid, (a) => a.level)), l = E.get(ts), y = p.filter((s) => s.kind === "kill").map((s) => ({ t: s.t, killer: s.killer, victim: s.victim, assists: s.assists ?? [], x: s.x, y: s.y })).sort((s, a) => s.t - a.t), w = p.filter((s) => s.kind !== "kill").map((s) => ({ t: s.t, kind: s.kind, sub: s.sub, team: s.team, lane: s.lane, killer: s.killer })).sort((s, a) => s.t - a.t), A = y[0]?.killer ?? 0, B = /* @__PURE__ */ new Map(), P = /* @__PURE__ */ new Map(), q = /* @__PURE__ */ new Map(), R = (s, a, r) => s.set(a, (s.get(a) ?? 0) + (r || 0));
  for (const s of c)
    R(B, s.teamId, s.kills), R(P, s.teamId, s.goldEarned), R(q, s.teamId, s.totalDamageDealtToChampions);
  const N = g.scores ?? {}, G = c.filter((s) => N[s.puuid] !== void 0).sort((s, a) => N[a.puuid] - N[s.puuid]), L = e.duration < Y, J = L ? void 0 : G.find((s) => s.win), Q = L ? void 0 : G.find((s) => !s.win), K = c.map((s, a) => {
    const r = m ? is(c, s) : void 0, u = r ? c.indexOf(r) : -1, d = (v) => l !== void 0 && u >= 0 ? v[a][l] - v[u][l] : null, k = n.find((v) => v.puuid === s.puuid && v.perks?.keystone)?.perks, S = k ? k.runes.filter((v) => v > 0) : [], _ = k?.keystone || s.perks.keystone, $ = S.length ? (S[0] === _ ? S : [_, ...S]).slice(0, 6) : _ ? [_] : [], b = [];
    s === J ? b.push("mvp") : s === Q && b.push("ace");
    for (const v of g.badges?.[s.puuid] ?? []) es.has(v) && !b.includes(v) && b.push(v);
    o && A === D(s) && !b.includes("first_blood") && b.push("first_blood");
    const j = L ? void 0 : N[s.puuid];
    return {
      participantId: D(s),
      teamId: s.teamId,
      win: !!s.win,
      puuid: s.puuid,
      gameName: s.gameName,
      tagLine: s.tagLine,
      championId: s.championId,
      level: s.champLevel || s.level,
      spells: s.spells,
      perks: $,
      styles: [k?.primaryStyle || s.perks.primary, k?.secondaryStyle || s.perks.sub],
      items: s.items,
      kills: s.kills,
      deaths: s.deaths,
      assists: s.assists,
      kp: B.get(s.teamId) ? (s.kills + s.assists) / B.get(s.teamId) : 0,
      cs: s.cs,
      csMin: s.cs / f,
      gold: s.goldEarned,
      goldShare: P.get(s.teamId) ? s.goldEarned / P.get(s.teamId) : 0,
      damage: s.totalDamageDealtToChampions,
      physical: s.physicalDamageDealtToChampions,
      magic: s.magicDamageDealtToChampions,
      trueDamage: s.trueDamageDealtToChampions,
      damageShare: q.get(s.teamId) ? s.totalDamageDealtToChampions / q.get(s.teamId) : 0,
      damageTaken: s.damageTaken,
      mitigated: null,
      healing: null,
      vision: s.visionScore,
      wardsPlaced: s.wardsPlaced,
      wardsKilled: s.wardsKilled,
      controlWards: s.visionWardsBoughtInGame,
      ccTime: null,
      objectiveDamage: s.damageDealtToObjectives,
      turretDamage: s.damageDealtToTurrets,
      doubles: null,
      triples: null,
      quadras: null,
      pentas: null,
      largestSpree: null,
      largestMulti: null,
      firstBlood: o && A === D(s),
      position: m ? F[s.position] ?? null : null,
      opponent: r ? D(r) : null,
      gold15: d(T),
      xp15: d(O),
      cs15: d(t),
      score: j === void 0 ? null : j / 10,
      rank: j === void 0 ? 0 : G.indexOf(s) + 1,
      badges: b,
      augments: [],
      placement: 0
    };
  }), V = new Map(K.map((s) => [s.participantId, s])), X = (s) => s === 100, x = (s, a, r) => s === 100 ? a : s === 200 ? r : 0, C = (s, a) => {
    if (!o) return null;
    const r = w.find((u) => u.kind === a);
    return !!r && r.team === s;
  }, z = [...new Set(c.map((s) => s.teamId))].sort((s, a) => s - a).map((s) => {
    const a = K.filter((d) => d.teamId === s), r = (d) => a.reduce((k, S) => k + d(S), 0), u = (d) => w.filter((k) => k.kind === d && k.team === s);
    return {
      teamId: s,
      win: a.some((d) => d.win),
      bans: ((X(s) ? e.t1Bans : s === 200 ? e.t2Bans : []) ?? []).filter((d) => d > 0),
      kills: r((d) => d.kills),
      deaths: r((d) => d.deaths),
      assists: r((d) => d.assists),
      gold: r((d) => d.gold),
      damage: r((d) => d.damage),
      towers: x(s, e.t1Towers, e.t2Towers),
      inhibitors: x(s, e.t1Inhibs, e.t2Inhibs),
      dragons: x(s, e.t1Dragons, e.t2Dragons),
      barons: x(s, e.t1Barons, e.t2Barons),
      heralds: x(s, e.t1Heralds, e.t2Heralds),
      grubs: o ? u("grubs").length : null,
      dragonTypes: u("dragon").map((d) => d.sub),
      firstBlood: o ? V.get(A)?.teamId === s : null,
      firstTower: C(s, "tower"),
      firstDragon: C(s, "dragon"),
      firstBaron: C(s, "baron"),
      firstInhibitor: C(s, "inhibitor")
    };
  }), H = (s) => I.map((a, r) => s.reduce((u, d, k) => u + (c[k].teamId === 100 ? 1 : c[k].teamId === 200 ? -1 : 0) * d[r], 0)), Z = I.length > 1 ? { t: I.map((s) => Math.round(s / 1e3)), gold: T, xp: O, cs: t, level: i, goldDiff: H(T), xpDiff: H(O), kills: y, objectives: w } : null;
  return {
    gameId: ns(e.matchId),
    creation: Number(e.gameStartMs),
    duration: e.duration,
    queueId: e.queueId,
    mapId: e.mapId,
    version: e.patch,
    remake: L,
    teams: z,
    players: K,
    timeline: Z,
    fromCore: !0
  };
}
function ds(e, g, c = null) {
  const n = e.players.find((o) => o.puuid === g);
  if (!n) return null;
  const p = e.players.find((o) => o.participantId === n.opponent);
  return {
    gameId: e.gameId,
    matchId: c,
    creation: e.creation,
    duration: e.duration,
    queueId: e.queueId,
    mapId: e.mapId,
    championId: n.championId,
    win: n.win,
    remake: e.remake,
    kills: n.kills,
    deaths: n.deaths,
    assists: n.assists,
    cs: n.cs,
    csMin: n.csMin,
    gold: n.gold,
    damage: n.damage,
    vision: n.vision,
    level: n.level,
    items: n.items,
    spells: n.spells,
    keystone: n.perks[0] ?? 0,
    primaryStyle: n.styles[0] ?? 0,
    subStyle: n.styles[1] ?? 0,
    lane: n.position,
    placement: n.placement,
    score: n.score === null ? null : {
      gameId: e.gameId,
      score: n.score,
      rank: n.rank,
      tag: n.badges.includes("mvp") ? "mvp" : n.badges.includes("ace") ? "ace" : "",
      opponent: p?.championId ?? null,
      kp: n.kp,
      badges: n.badges.filter((o) => o !== "mvp" && o !== "ace")
    }
  };
}
const W = (e) => ({
  tier: e.tier,
  division: ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(e.tier) ? "" : e.division,
  lp: e.leaguePoints,
  wins: e.wins,
  losses: e.losses ?? 0,
  provisional: !1,
  previous: ""
}), U = { solo: "RANKED_SOLO_5x5", flex: "RANKED_FLEX_SR" };
function cs({ summoner: e, ranks: g, mastery: c, games: n }) {
  const p = (t) => {
    const i = g?.current.find((l) => l.queueType === U[t] && l.tier);
    return i ? W(i) : null;
  }, o = n.filter((t) => !t.remake), f = /* @__PURE__ */ new Map(), m = /* @__PURE__ */ new Map();
  for (const t of o) {
    const i = f.get(t.championId) ?? { championId: t.championId, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, cs: 0, seconds: 0, damage: 0, gold: 0, vision: 0 };
    i.games++, t.win && i.wins++, i.kills += t.kills, i.deaths += t.deaths, i.assists += t.assists, i.cs += t.cs, i.seconds += t.duration, i.damage += t.damage, i.gold += t.gold, i.vision += t.vision, f.set(t.championId, i), t.lane && m.set(t.lane, (m.get(t.lane) ?? 0) + 1);
  }
  const h = [...f.values()].sort((t, i) => i.games - t.games || i.wins - t.wins), D = (t) => {
    const i = (l) => t.reduce((y, w) => y + l(w), 0);
    return { games: i((l) => l.games), wins: i((l) => l.wins), kills: i((l) => l.kills), deaths: i((l) => l.deaths), assists: i((l) => l.assists), cs: i((l) => l.cs), seconds: i((l) => l.seconds) };
  }, I = o.map((t) => t.win), E = I.findIndex((t) => t !== I[0]), M = I.length ? (E < 0 ? I.length : E) * (I[0] ? 1 : -1) : 0, T = [...m].sort((t, i) => i[1] - t[1]), O = (g?.history ?? []).flatMap((t) => {
    const i = t.queueType === U.solo ? "solo" : t.queueType === U.flex ? "flex" : null, l = W(t), y = ss(l), w = Date.parse(t.fetchedAt);
    return i && y !== null && w ? [{ t: w, queue: i, tier: l.tier, division: l.division, lp: l.lp, wins: l.wins, losses: l.losses, value: Math.round(y * 100) }] : [];
  }).sort((t, i) => t.t - i.t);
  return {
    card: {
      puuid: e.puuid,
      gameName: e.gameName,
      tagLine: e.tagLine,
      icon: e.profileIconId ?? 0,
      level: e.summonerLevel ?? 0,
      private: !1,
      solo: p("solo"),
      flex: p("flex"),
      recent: {
        ...D(h),
        results: I,
        streak: M,
        lanes: T,
        champions: h.map((t) => ({ championId: t.championId, games: t.games, wins: t.wins, kills: t.kills, deaths: t.deaths, assists: t.assists, cs: t.cs, seconds: t.seconds })),
        ranked: o.filter((t) => t.queueId === 420).length
      },
      mastery: [...c].sort((t, i) => i.championPoints - t.championPoints),
      offline: !1
    },
    isSelf: !1,
    isOwn: !1,
    champions: h,
    lanes: T,
    lp: O
  };
}
function us(e, g) {
  const c = /* @__PURE__ */ new Map(), p = [...e.filter((o) => o.duration >= Y && o.participants.some((f) => f.puuid === g))].sort((o, f) => Number(f.gameStartMs) - Number(o.gameStartMs)).slice(0, 40);
  for (const o of p) {
    const f = o.participants.find((m) => m.puuid === g).teamId;
    for (const m of o.participants) {
      if (!m.puuid || m.puuid === g || m.teamId !== f) continue;
      const h = c.get(m.puuid) ?? { puuid: m.puuid, gameName: m.gameName, tagLine: m.tagLine, icon: m.profileIconId ?? 0, games: 0, wins: 0, last: Number(o.gameStartMs) };
      h.games++, m.win && h.wins++, c.set(m.puuid, h);
    }
  }
  return {
    mates: [...c.values()].filter((o) => o.games >= 2).sort((o, f) => f.games - o.games || f.last - o.last).slice(0, 8),
    games: p.length
  };
}
export {
  rs as fromCoreMatch,
  ns as gameIdOf,
  us as playedWithFromCore,
  ls as positionOf,
  cs as profileFromCore,
  W as rankFromCore,
  ds as summaryOf
};
