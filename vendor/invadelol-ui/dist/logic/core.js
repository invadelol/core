import { SCORE_CATEGORIES as is, PINGS as as } from "./detail.js";
import { rankValue as os } from "./labels.js";
const ls = Object.keys(as), R = { TOP: "TOP", JUNGLE: "JUNGLE", MIDDLE: "MID", BOTTOM: "ADC", UTILITY: "SUPPORT" }, rs = /* @__PURE__ */ new Set(["carry_damage", "tank", "vision", "cc", "objectives", "first_blood", "triple", "quadra", "penta", "deathless", "lane_won"]), X = 300, ds = 900 * 1e3, fs = (e) => R[e ?? ""] ?? null, cs = (e) => Number(e.slice(e.lastIndexOf("_") + 1)) || 0, Q = (e) => {
  const m = Object.keys(R).indexOf(e.position);
  return m < 0 ? 5 : m;
};
function us(e, m) {
  if (m.position) {
    const f = e.find((o) => o.teamId !== m.teamId && o.position === m.position);
    if (f) return f;
  }
  const c = e.filter((f) => f.teamId === m.teamId), n = e.filter((f) => f.teamId !== m.teamId);
  return n[c.indexOf(m)] ?? n[0];
}
function ks(e, m = {}) {
  const c = [...e.participants].sort((s, i) => s.teamId - i.teamId || Q(s) - Q(i)), n = e.timeline ?? [], f = e.events ?? [], o = f.length > 0, I = Math.max(e.duration / 60, 1), p = c.some((s) => s.position in R), v = e.completeness?.pings !== !1 && c.some((s) => s.allInPings !== void 0), T = /* @__PURE__ */ new Map();
  for (const s of n) s.puuid && !T.has(s.puuid) && T.set(s.puuid, s.participantId);
  const h = (s) => T.get(s.puuid) ?? c.indexOf(s) + 1, w = [...new Set(n.map((s) => s.frameMs))].sort((s, i) => s - i), E = new Map(w.map((s, i) => [s, i])), b = (s, i) => {
    const r = new Array(w.length).fill(0);
    for (const g of n) g.puuid === s && (r[E.get(g.frameMs)] = i(g));
    for (let g = 1; g < r.length; g++) !r[g] && r[g - 1] && (r[g] = r[g - 1]);
    return r;
  }, O = c.map((s) => b(s.puuid, (i) => i.goldTotal)), t = c.map((s) => b(s.puuid, (i) => i.xp)), a = c.map((s) => b(s.puuid, (i) => i.cs + i.jungleCs)), l = c.map((s) => b(s.puuid, (i) => i.level)), y = E.get(ds), D = f.filter((s) => s.kind === "kill").map((s) => ({ t: s.t, killer: s.killer, victim: s.victim, assists: s.assists ?? [], x: s.x, y: s.y })).sort((s, i) => s.t - i.t), q = f.filter((s) => s.kind !== "kill").map((s) => ({ t: s.t, kind: s.kind, sub: s.sub, team: s.team, lane: s.lane, killer: s.killer })).sort((s, i) => s.t - i.t), j = D[0]?.killer ?? 0, G = /* @__PURE__ */ new Map(), K = /* @__PURE__ */ new Map(), U = /* @__PURE__ */ new Map(), F = (s, i, r) => s.set(i, (s.get(i) ?? 0) + (r || 0));
  for (const s of c)
    F(G, s.teamId, s.kills), F(K, s.teamId, s.goldEarned), F(U, s.teamId, s.totalDamageDealtToChampions);
  const x = m.scores ?? {}, H = c.filter((s) => x[s.puuid] !== void 0).sort((s, i) => x[i.puuid] - x[s.puuid]), N = e.duration < X, $ = N ? void 0 : H.find((s) => s.win), z = N ? void 0 : H.find((s) => !s.win), W = c.map((s, i) => {
    const r = p ? us(c, s) : void 0, g = r ? c.indexOf(r) : -1, d = (u) => y !== void 0 && g >= 0 ? u[i][y] - u[g][y] : null, k = n.find((u) => u.puuid === s.puuid && u.perks?.keystone)?.perks, C = k?.statPerks ? [k.statPerks.offense, k.statPerks.flex, k.statPerks.defense] : [], L = k ? k.runes.filter((u) => u > 0) : [], _ = k?.keystone || s.perks.keystone, ns = L.length ? (L[0] === _ ? L : [_, ...L]).slice(0, 6) : _ ? [_] : [], M = [];
    s === $ ? M.push("mvp") : s === z && M.push("ace");
    for (const u of m.badges?.[s.puuid] ?? []) rs.has(u) && !M.includes(u) && M.push(u);
    o && j === h(s) && !M.includes("first_blood") && M.push("first_blood");
    const A = N ? void 0 : x[s.puuid], B = A === void 0 ? void 0 : m.parts?.[s.puuid];
    return {
      participantId: h(s),
      teamId: s.teamId,
      win: !!s.win,
      puuid: s.puuid,
      gameName: s.gameName,
      tagLine: s.tagLine,
      championId: s.championId,
      level: s.champLevel || s.level,
      spells: s.spells,
      perks: ns,
      styles: [k?.primaryStyle || s.perks.primary, k?.secondaryStyle || s.perks.sub],
      items: s.items,
      kills: s.kills,
      deaths: s.deaths,
      assists: s.assists,
      kp: G.get(s.teamId) ? (s.kills + s.assists) / G.get(s.teamId) : 0,
      cs: s.cs,
      jungleCs: s.neutralMinionsKilled,
      csMin: s.cs / I,
      gold: s.goldEarned,
      goldShare: K.get(s.teamId) ? s.goldEarned / K.get(s.teamId) : 0,
      damage: s.totalDamageDealtToChampions,
      physical: s.physicalDamageDealtToChampions,
      magic: s.magicDamageDealtToChampions,
      trueDamage: s.trueDamageDealtToChampions,
      damageShare: U.get(s.teamId) ? s.totalDamageDealtToChampions / U.get(s.teamId) : 0,
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
      firstBlood: o && j === h(s),
      position: p ? R[s.position] ?? null : null,
      opponent: r ? h(r) : null,
      gold15: d(O),
      xp15: d(t),
      cs15: d(a),
      score: A === void 0 ? null : A / 10,
      parts: B ? is.filter((u) => B.weights[u] > 0).map((u) => ({ key: u, value: B.categories[u], weight: B.weights[u] })) : [],
      rank: A === void 0 ? 0 : H.indexOf(s) + 1,
      badges: M,
      skills: n.find((u) => u.puuid === s.puuid && u.skillOrder?.length)?.skillOrder ?? [],
      augments: [],
      placement: 0,
      ...C.every(Boolean) ? { shards: C } : {},
      ...v ? { pings: Object.fromEntries(ls.map((u) => [u, s[`${u}Pings`] ?? 0])) } : {}
    };
  }), Z = new Map(W.map((s) => [s.participantId, s])), ss = (s) => s === 100, S = (s, i, r) => s === 100 ? i : s === 200 ? r : 0, P = (s, i) => {
    if (!o) return null;
    const r = q.find((g) => g.kind === i);
    return !!r && r.team === s;
  }, es = [...new Set(c.map((s) => s.teamId))].sort((s, i) => s - i).map((s) => {
    const i = W.filter((d) => d.teamId === s), r = (d) => i.reduce((k, C) => k + d(C), 0), g = (d) => q.filter((k) => k.kind === d && k.team === s);
    return {
      teamId: s,
      win: i.some((d) => d.win),
      bans: ((ss(s) ? e.t1Bans : s === 200 ? e.t2Bans : []) ?? []).filter((d) => d > 0),
      kills: r((d) => d.kills),
      deaths: r((d) => d.deaths),
      assists: r((d) => d.assists),
      gold: r((d) => d.gold),
      damage: r((d) => d.damage),
      towers: S(s, e.t1Towers, e.t2Towers),
      inhibitors: S(s, e.t1Inhibs, e.t2Inhibs),
      dragons: S(s, e.t1Dragons, e.t2Dragons),
      barons: S(s, e.t1Barons, e.t2Barons),
      heralds: S(s, e.t1Heralds, e.t2Heralds),
      grubs: o ? g("grubs").length : null,
      dragonTypes: g("dragon").map((d) => d.sub),
      firstBlood: o ? Z.get(j)?.teamId === s : null,
      firstTower: P(s, "tower"),
      firstDragon: P(s, "dragon"),
      firstBaron: P(s, "baron"),
      firstInhibitor: P(s, "inhibitor")
    };
  }), J = (s) => w.map((i, r) => s.reduce((g, d, k) => g + (c[k].teamId === 100 ? 1 : c[k].teamId === 200 ? -1 : 0) * d[r], 0)), ts = w.length > 1 ? { t: w.map((s) => Math.round(s / 1e3)), gold: O, xp: t, cs: a, level: l, goldDiff: J(O), xpDiff: J(t), kills: D, objectives: q } : null;
  return {
    gameId: cs(e.matchId),
    creation: Number(e.gameStartMs),
    duration: e.duration,
    queueId: e.queueId,
    mapId: e.mapId,
    version: e.patch,
    remake: N,
    teams: es,
    players: W,
    timeline: ts,
    fromCore: !0
  };
}
function Is(e, m, c = null) {
  const n = e.players.find((o) => o.puuid === m);
  if (!n) return null;
  const f = e.players.find((o) => o.participantId === n.opponent);
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
      opponent: f?.championId ?? null,
      kp: n.kp,
      badges: n.badges.filter((o) => o !== "mvp" && o !== "ace")
    }
  };
}
const V = (e) => ({
  tier: e.tier,
  division: ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(e.tier) ? "" : e.division,
  lp: e.leaguePoints,
  wins: e.wins,
  losses: e.losses ?? 0,
  provisional: !1,
  previous: ""
}), Y = { solo: "RANKED_SOLO_5x5", flex: "RANKED_FLEX_SR" };
function hs({ summoner: e, ranks: m, mastery: c, games: n }) {
  const f = (t) => {
    const a = m?.current.find((l) => l.queueType === Y[t] && l.tier);
    return a ? V(a) : null;
  }, o = n.filter((t) => !t.remake), I = /* @__PURE__ */ new Map(), p = /* @__PURE__ */ new Map();
  for (const t of o) {
    const a = I.get(t.championId) ?? { championId: t.championId, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, cs: 0, seconds: 0, damage: 0, gold: 0, vision: 0 };
    a.games++, t.win && a.wins++, a.kills += t.kills, a.deaths += t.deaths, a.assists += t.assists, a.cs += t.cs, a.seconds += t.duration, a.damage += t.damage, a.gold += t.gold, a.vision += t.vision, I.set(t.championId, a), t.lane && p.set(t.lane, (p.get(t.lane) ?? 0) + 1);
  }
  const v = [...I.values()].sort((t, a) => a.games - t.games || a.wins - t.wins), T = (t) => {
    const a = (l) => t.reduce((y, D) => y + l(D), 0);
    return { games: a((l) => l.games), wins: a((l) => l.wins), kills: a((l) => l.kills), deaths: a((l) => l.deaths), assists: a((l) => l.assists), cs: a((l) => l.cs), seconds: a((l) => l.seconds) };
  }, h = o.map((t) => t.win), w = h.findIndex((t) => t !== h[0]), E = h.length ? (w < 0 ? h.length : w) * (h[0] ? 1 : -1) : 0, b = [...p].sort((t, a) => a[1] - t[1]), O = (m?.history ?? []).flatMap((t) => {
    const a = t.queueType === Y.solo ? "solo" : t.queueType === Y.flex ? "flex" : null, l = V(t), y = os(l), D = Date.parse(t.fetchedAt);
    return a && y !== null && D ? [{ t: D, queue: a, tier: l.tier, division: l.division, lp: l.lp, wins: l.wins, losses: l.losses, value: Math.round(y * 100) }] : [];
  }).sort((t, a) => t.t - a.t);
  return {
    card: {
      puuid: e.puuid,
      gameName: e.gameName,
      tagLine: e.tagLine,
      icon: e.profileIconId ?? 0,
      level: e.summonerLevel ?? 0,
      private: !1,
      solo: f("solo"),
      flex: f("flex"),
      recent: {
        ...T(v),
        results: h,
        streak: E,
        lanes: b,
        champions: v.map((t) => ({ championId: t.championId, games: t.games, wins: t.wins, kills: t.kills, deaths: t.deaths, assists: t.assists, cs: t.cs, seconds: t.seconds })),
        ranked: o.filter((t) => t.queueId === 420).length
      },
      mastery: [...c].sort((t, a) => a.championPoints - t.championPoints),
      offline: !1
    },
    isSelf: !1,
    isOwn: !1,
    champions: v,
    lanes: b,
    lp: O
  };
}
function vs(e, m) {
  const c = /* @__PURE__ */ new Map(), f = [...e.filter((o) => o.duration >= X && o.participants.some((I) => I.puuid === m))].sort((o, I) => Number(I.gameStartMs) - Number(o.gameStartMs)).slice(0, 40);
  for (const o of f) {
    const I = o.participants.find((p) => p.puuid === m).teamId;
    for (const p of o.participants) {
      if (!p.puuid || p.puuid === m || p.teamId !== I) continue;
      const v = c.get(p.puuid) ?? { puuid: p.puuid, gameName: p.gameName, tagLine: p.tagLine, icon: p.profileIconId ?? 0, games: 0, wins: 0, last: Number(o.gameStartMs) };
      v.games++, p.win && v.wins++, c.set(p.puuid, v);
    }
  }
  return {
    mates: [...c.values()].filter((o) => o.games >= 2).sort((o, I) => I.games - o.games || I.last - o.last).slice(0, 8),
    games: f.length
  };
}
export {
  ks as fromCoreMatch,
  cs as gameIdOf,
  vs as playedWithFromCore,
  fs as positionOf,
  hs as profileFromCore,
  V as rankFromCore,
  Is as summaryOf
};
