import { SCORE_CATEGORIES as ns, PINGS as is } from "./detail.js";
import { rankValue as as } from "./labels.js";
const os = Object.keys(is), Y = { TOP: "TOP", JUNGLE: "JUNGLE", MIDDLE: "MID", BOTTOM: "ADC", UTILITY: "SUPPORT" }, ls = /* @__PURE__ */ new Set(["carry_damage", "tank", "vision", "cc", "objectives", "first_blood", "triple", "quadra", "penta", "deathless", "lane_won"]), V = 300, rs = 900 * 1e3, ps = (e) => Y[e ?? ""] ?? null, ds = (e) => Number(e.slice(e.lastIndexOf("_") + 1)) || 0;
function us(e, g) {
  if (g.position) {
    const f = e.find((o) => o.teamId !== g.teamId && o.position === g.position);
    if (f) return f;
  }
  const u = e.filter((f) => f.teamId === g.teamId), n = e.filter((f) => f.teamId !== g.teamId);
  return n[u.indexOf(g)] ?? n[0];
}
function fs(e, g = {}) {
  const u = e.participants, n = e.timeline ?? [], f = e.events ?? [], o = f.length > 0, I = Math.max(e.duration / 60, 1), p = u.some((s) => s.position in Y), v = e.completeness?.pings !== !1 && u.some((s) => s.allInPings !== void 0), T = /* @__PURE__ */ new Map();
  for (const s of n) s.puuid && !T.has(s.puuid) && T.set(s.puuid, s.participantId);
  const h = (s) => T.get(s.puuid) ?? u.indexOf(s) + 1, w = [...new Set(n.map((s) => s.frameMs))].sort((s, a) => s - a), E = new Map(w.map((s, a) => [s, a])), y = (s, a) => {
    const r = new Array(w.length).fill(0);
    for (const m of n) m.puuid === s && (r[E.get(m.frameMs)] = a(m));
    for (let m = 1; m < r.length; m++) !r[m] && r[m - 1] && (r[m] = r[m - 1]);
    return r;
  }, O = u.map((s) => y(s.puuid, (a) => a.goldTotal)), t = u.map((s) => y(s.puuid, (a) => a.xp)), i = u.map((s) => y(s.puuid, (a) => a.cs + a.jungleCs)), l = u.map((s) => y(s.puuid, (a) => a.level)), b = E.get(rs), D = f.filter((s) => s.kind === "kill").map((s) => ({ t: s.t, killer: s.killer, victim: s.victim, assists: s.assists ?? [], x: s.x, y: s.y })).sort((s, a) => s.t - a.t), R = f.filter((s) => s.kind !== "kill").map((s) => ({ t: s.t, kind: s.kind, sub: s.sub, team: s.team, lane: s.lane, killer: s.killer })).sort((s, a) => s.t - a.t), q = D[0]?.killer ?? 0, G = /* @__PURE__ */ new Map(), j = /* @__PURE__ */ new Map(), K = /* @__PURE__ */ new Map(), U = (s, a, r) => s.set(a, (s.get(a) ?? 0) + (r || 0));
  for (const s of u)
    U(G, s.teamId, s.kills), U(j, s.teamId, s.goldEarned), U(K, s.teamId, s.totalDamageDealtToChampions);
  const x = g.scores ?? {}, F = u.filter((s) => x[s.puuid] !== void 0).sort((s, a) => x[a.puuid] - x[s.puuid]), N = e.duration < V, X = N ? void 0 : F.find((s) => s.win), $ = N ? void 0 : F.find((s) => !s.win), H = u.map((s, a) => {
    const r = p ? us(u, s) : void 0, m = r ? u.indexOf(r) : -1, d = (c) => b !== void 0 && m >= 0 ? c[a][b] - c[m][b] : null, k = n.find((c) => c.puuid === s.puuid && c.perks?.keystone)?.perks, C = k?.statPerks ? [k.statPerks.offense, k.statPerks.flex, k.statPerks.defense] : [], L = k ? k.runes.filter((c) => c > 0) : [], _ = k?.keystone || s.perks.keystone, ts = L.length ? (L[0] === _ ? L : [_, ...L]).slice(0, 6) : _ ? [_] : [], M = [];
    s === X ? M.push("mvp") : s === $ && M.push("ace");
    for (const c of g.badges?.[s.puuid] ?? []) ls.has(c) && !M.includes(c) && M.push(c);
    o && q === h(s) && !M.includes("first_blood") && M.push("first_blood");
    const A = N ? void 0 : x[s.puuid], B = A === void 0 ? void 0 : g.parts?.[s.puuid];
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
      perks: ts,
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
      goldShare: j.get(s.teamId) ? s.goldEarned / j.get(s.teamId) : 0,
      damage: s.totalDamageDealtToChampions,
      physical: s.physicalDamageDealtToChampions,
      magic: s.magicDamageDealtToChampions,
      trueDamage: s.trueDamageDealtToChampions,
      damageShare: K.get(s.teamId) ? s.totalDamageDealtToChampions / K.get(s.teamId) : 0,
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
      firstBlood: o && q === h(s),
      position: p ? Y[s.position] ?? null : null,
      opponent: r ? h(r) : null,
      gold15: d(O),
      xp15: d(t),
      cs15: d(i),
      score: A === void 0 ? null : A / 10,
      parts: B ? ns.filter((c) => B.weights[c] > 0).map((c) => ({ key: c, value: B.categories[c], weight: B.weights[c] })) : [],
      rank: A === void 0 ? 0 : F.indexOf(s) + 1,
      badges: M,
      skills: n.find((c) => c.puuid === s.puuid && c.skillOrder?.length)?.skillOrder ?? [],
      augments: [],
      placement: 0,
      ...C.every(Boolean) ? { shards: C } : {},
      ...v ? { pings: Object.fromEntries(os.map((c) => [c, s[`${c}Pings`] ?? 0])) } : {}
    };
  }), z = new Map(H.map((s) => [s.participantId, s])), Z = (s) => s === 100, S = (s, a, r) => s === 100 ? a : s === 200 ? r : 0, P = (s, a) => {
    if (!o) return null;
    const r = R.find((m) => m.kind === a);
    return !!r && r.team === s;
  }, ss = [...new Set(u.map((s) => s.teamId))].sort((s, a) => s - a).map((s) => {
    const a = H.filter((d) => d.teamId === s), r = (d) => a.reduce((k, C) => k + d(C), 0), m = (d) => R.filter((k) => k.kind === d && k.team === s);
    return {
      teamId: s,
      win: a.some((d) => d.win),
      bans: ((Z(s) ? e.t1Bans : s === 200 ? e.t2Bans : []) ?? []).filter((d) => d > 0),
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
      grubs: o ? m("grubs").length : null,
      dragonTypes: m("dragon").map((d) => d.sub),
      firstBlood: o ? z.get(q)?.teamId === s : null,
      firstTower: P(s, "tower"),
      firstDragon: P(s, "dragon"),
      firstBaron: P(s, "baron"),
      firstInhibitor: P(s, "inhibitor")
    };
  }), J = (s) => w.map((a, r) => s.reduce((m, d, k) => m + (u[k].teamId === 100 ? 1 : u[k].teamId === 200 ? -1 : 0) * d[r], 0)), es = w.length > 1 ? { t: w.map((s) => Math.round(s / 1e3)), gold: O, xp: t, cs: i, level: l, goldDiff: J(O), xpDiff: J(t), kills: D, objectives: R } : null;
  return {
    gameId: ds(e.matchId),
    creation: Number(e.gameStartMs),
    duration: e.duration,
    queueId: e.queueId,
    mapId: e.mapId,
    version: e.patch,
    remake: N,
    teams: ss,
    players: H,
    timeline: es,
    fromCore: !0
  };
}
function ks(e, g, u = null) {
  const n = e.players.find((o) => o.puuid === g);
  if (!n) return null;
  const f = e.players.find((o) => o.participantId === n.opponent);
  return {
    gameId: e.gameId,
    matchId: u,
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
const Q = (e) => ({
  tier: e.tier,
  division: ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(e.tier) ? "" : e.division,
  lp: e.leaguePoints,
  wins: e.wins,
  losses: e.losses ?? 0,
  provisional: !1,
  previous: ""
}), W = { solo: "RANKED_SOLO_5x5", flex: "RANKED_FLEX_SR" };
function Is({ summoner: e, ranks: g, mastery: u, games: n }) {
  const f = (t) => {
    const i = g?.current.find((l) => l.queueType === W[t] && l.tier);
    return i ? Q(i) : null;
  }, o = n.filter((t) => !t.remake), I = /* @__PURE__ */ new Map(), p = /* @__PURE__ */ new Map();
  for (const t of o) {
    const i = I.get(t.championId) ?? { championId: t.championId, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, cs: 0, seconds: 0, damage: 0, gold: 0, vision: 0 };
    i.games++, t.win && i.wins++, i.kills += t.kills, i.deaths += t.deaths, i.assists += t.assists, i.cs += t.cs, i.seconds += t.duration, i.damage += t.damage, i.gold += t.gold, i.vision += t.vision, I.set(t.championId, i), t.lane && p.set(t.lane, (p.get(t.lane) ?? 0) + 1);
  }
  const v = [...I.values()].sort((t, i) => i.games - t.games || i.wins - t.wins), T = (t) => {
    const i = (l) => t.reduce((b, D) => b + l(D), 0);
    return { games: i((l) => l.games), wins: i((l) => l.wins), kills: i((l) => l.kills), deaths: i((l) => l.deaths), assists: i((l) => l.assists), cs: i((l) => l.cs), seconds: i((l) => l.seconds) };
  }, h = o.map((t) => t.win), w = h.findIndex((t) => t !== h[0]), E = h.length ? (w < 0 ? h.length : w) * (h[0] ? 1 : -1) : 0, y = [...p].sort((t, i) => i[1] - t[1]), O = (g?.history ?? []).flatMap((t) => {
    const i = t.queueType === W.solo ? "solo" : t.queueType === W.flex ? "flex" : null, l = Q(t), b = as(l), D = Date.parse(t.fetchedAt);
    return i && b !== null && D ? [{ t: D, queue: i, tier: l.tier, division: l.division, lp: l.lp, wins: l.wins, losses: l.losses, value: Math.round(b * 100) }] : [];
  }).sort((t, i) => t.t - i.t);
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
        lanes: y,
        champions: v.map((t) => ({ championId: t.championId, games: t.games, wins: t.wins, kills: t.kills, deaths: t.deaths, assists: t.assists, cs: t.cs, seconds: t.seconds })),
        ranked: o.filter((t) => t.queueId === 420).length
      },
      mastery: [...u].sort((t, i) => i.championPoints - t.championPoints),
      offline: !1
    },
    isSelf: !1,
    isOwn: !1,
    champions: v,
    lanes: y,
    lp: O
  };
}
function hs(e, g) {
  const u = /* @__PURE__ */ new Map(), f = [...e.filter((o) => o.duration >= V && o.participants.some((I) => I.puuid === g))].sort((o, I) => Number(I.gameStartMs) - Number(o.gameStartMs)).slice(0, 40);
  for (const o of f) {
    const I = o.participants.find((p) => p.puuid === g).teamId;
    for (const p of o.participants) {
      if (!p.puuid || p.puuid === g || p.teamId !== I) continue;
      const v = u.get(p.puuid) ?? { puuid: p.puuid, gameName: p.gameName, tagLine: p.tagLine, icon: p.profileIconId ?? 0, games: 0, wins: 0, last: Number(o.gameStartMs) };
      v.games++, p.win && v.wins++, u.set(p.puuid, v);
    }
  }
  return {
    mates: [...u.values()].filter((o) => o.games >= 2).sort((o, I) => I.games - o.games || I.last - o.last).slice(0, 8),
    games: f.length
  };
}
export {
  fs as fromCoreMatch,
  ds as gameIdOf,
  hs as playedWithFromCore,
  ps as positionOf,
  Is as profileFromCore,
  Q as rankFromCore,
  ks as summaryOf
};
