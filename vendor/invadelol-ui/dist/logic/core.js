import { SCORE_CATEGORIES as as, PINGS as os } from "./detail.js";
import { rankValue as ls } from "./labels.js";
const rs = Object.keys(os), q = { TOP: "TOP", JUNGLE: "JUNGLE", MIDDLE: "MID", BOTTOM: "ADC", UTILITY: "SUPPORT" }, ds = /* @__PURE__ */ new Set(["carry_damage", "tank", "vision", "cc", "objectives", "first_blood", "triple", "quadra", "penta", "deathless", "lane_won"]), X = 300, cs = 900 * 1e3, ks = (e) => q[e ?? ""] ?? null, us = (e) => Number(e.slice(e.lastIndexOf("_") + 1)) || 0, Q = (e) => {
  const m = Object.keys(q).indexOf(e.position);
  return m < 0 ? 5 : m;
};
function ms(e, m) {
  if (m.position) {
    const f = e.find((o) => o.teamId !== m.teamId && o.position === m.position);
    if (f) return f;
  }
  const c = e.filter((f) => f.teamId === m.teamId), n = e.filter((f) => f.teamId !== m.teamId);
  return n[c.indexOf(m)] ?? n[0];
}
function Is(e, m = {}) {
  const c = [...e.participants].sort((s, i) => s.teamId - i.teamId || Q(s) - Q(i)), n = e.timeline ?? [], f = e.events ?? [], o = f.length > 0, I = Math.max(e.duration / 60, 1), g = c.some((s) => s.position in q), v = e.completeness?.pings !== !1 && c.some((s) => s.allInPings !== void 0), T = /* @__PURE__ */ new Map();
  for (const s of n) s.puuid && !T.has(s.puuid) && T.set(s.puuid, s.participantId);
  const h = (s) => T.get(s.puuid) ?? c.indexOf(s) + 1, w = [...new Set(n.map((s) => s.frameMs))].sort((s, i) => s - i), x = new Map(w.map((s, i) => [s, i])), b = (s, i) => {
    const r = new Array(w.length).fill(0);
    for (const p of n) p.puuid === s && (r[x.get(p.frameMs)] = i(p));
    for (let p = 1; p < r.length; p++) !r[p] && r[p - 1] && (r[p] = r[p - 1]);
    return r;
  }, O = c.map((s) => b(s.puuid, (i) => i.goldTotal)), t = c.map((s) => b(s.puuid, (i) => i.xp)), a = c.map((s) => b(s.puuid, (i) => i.cs + i.jungleCs)), l = c.map((s) => b(s.puuid, (i) => i.level)), y = x.get(cs), D = f.filter((s) => s.kind === "kill").map((s) => ({ t: s.t, killer: s.killer, victim: s.victim, assists: s.assists ?? [], x: s.x, y: s.y })).sort((s, i) => s.t - i.t), j = f.filter((s) => s.kind !== "kill").map((s) => ({ t: s.t, kind: s.kind, sub: s.sub, team: s.team, lane: s.lane, killer: s.killer })).sort((s, i) => s.t - i.t), G = D[0]?.killer ?? 0, S = /* @__PURE__ */ new Map();
  for (const s of e.shop ?? [])
    s.item && (S.has(s.player) || S.set(s.player, []), S.get(s.player).push({ t: s.t, item: s.item, sold: s.sold }));
  const K = /* @__PURE__ */ new Map(), U = /* @__PURE__ */ new Map(), F = /* @__PURE__ */ new Map(), H = (s, i, r) => s.set(i, (s.get(i) ?? 0) + (r || 0));
  for (const s of c)
    H(K, s.teamId, s.kills), H(U, s.teamId, s.goldEarned), H(F, s.teamId, s.totalDamageDealtToChampions);
  const N = m.scores ?? {}, W = c.filter((s) => N[s.puuid] !== void 0).sort((s, i) => N[i.puuid] - N[s.puuid]), P = e.duration < X, $ = P ? void 0 : W.find((s) => s.win), Z = P ? void 0 : W.find((s) => !s.win), Y = c.map((s, i) => {
    const r = g ? ms(c, s) : void 0, p = r ? c.indexOf(r) : -1, d = (u) => y !== void 0 && p >= 0 ? u[i][y] - u[p][y] : null, k = n.find((u) => u.puuid === s.puuid && u.perks?.keystone)?.perks, L = k?.statPerks ? [k.statPerks.offense, k.statPerks.flex, k.statPerks.defense] : [], _ = k ? k.runes.filter((u) => u > 0) : [], A = k?.keystone || s.perks.keystone, is = _.length ? (_[0] === A ? _ : [A, ..._]).slice(0, 6) : A ? [A] : [], M = [];
    s === $ ? M.push("mvp") : s === Z && M.push("ace");
    for (const u of m.badges?.[s.puuid] ?? []) ds.has(u) && !M.includes(u) && M.push(u);
    o && G === h(s) && !M.includes("first_blood") && M.push("first_blood");
    const B = P ? void 0 : N[s.puuid], R = B === void 0 ? void 0 : m.parts?.[s.puuid];
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
      perks: is,
      styles: [k?.primaryStyle || s.perks.primary, k?.secondaryStyle || s.perks.sub],
      items: s.items,
      kills: s.kills,
      deaths: s.deaths,
      assists: s.assists,
      kp: K.get(s.teamId) ? (s.kills + s.assists) / K.get(s.teamId) : 0,
      cs: s.cs,
      jungleCs: s.neutralMinionsKilled,
      csMin: s.cs / I,
      gold: s.goldEarned,
      goldShare: U.get(s.teamId) ? s.goldEarned / U.get(s.teamId) : 0,
      damage: s.totalDamageDealtToChampions,
      physical: s.physicalDamageDealtToChampions,
      magic: s.magicDamageDealtToChampions,
      trueDamage: s.trueDamageDealtToChampions,
      damageShare: F.get(s.teamId) ? s.totalDamageDealtToChampions / F.get(s.teamId) : 0,
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
      firstBlood: o && G === h(s),
      position: g ? q[s.position] ?? null : null,
      opponent: r ? h(r) : null,
      gold15: d(O),
      xp15: d(t),
      cs15: d(a),
      score: B === void 0 ? null : B / 10,
      parts: R ? as.filter((u) => R.weights[u] > 0).map((u) => ({ key: u, value: R.categories[u], weight: R.weights[u] })) : [],
      rank: B === void 0 ? 0 : W.indexOf(s) + 1,
      badges: M,
      skills: n.find((u) => u.puuid === s.puuid && u.skillOrder?.length)?.skillOrder ?? [],
      augments: [],
      placement: 0,
      ...L.every(Boolean) ? { shards: L } : {},
      ...S.size ? { purchases: S.get(h(s)) ?? [] } : {},
      ...v ? { pings: Object.fromEntries(rs.map((u) => [u, s[`${u}Pings`] ?? 0])) } : {}
    };
  }), ss = new Map(Y.map((s) => [s.participantId, s])), es = (s) => s === 100, E = (s, i, r) => s === 100 ? i : s === 200 ? r : 0, C = (s, i) => {
    if (!o) return null;
    const r = j.find((p) => p.kind === i);
    return !!r && r.team === s;
  }, ts = [...new Set(c.map((s) => s.teamId))].sort((s, i) => s - i).map((s) => {
    const i = Y.filter((d) => d.teamId === s), r = (d) => i.reduce((k, L) => k + d(L), 0), p = (d) => j.filter((k) => k.kind === d && k.team === s);
    return {
      teamId: s,
      win: i.some((d) => d.win),
      bans: ((es(s) ? e.t1Bans : s === 200 ? e.t2Bans : []) ?? []).filter((d) => d > 0),
      kills: r((d) => d.kills),
      deaths: r((d) => d.deaths),
      assists: r((d) => d.assists),
      gold: r((d) => d.gold),
      damage: r((d) => d.damage),
      towers: E(s, e.t1Towers, e.t2Towers),
      inhibitors: E(s, e.t1Inhibs, e.t2Inhibs),
      dragons: E(s, e.t1Dragons, e.t2Dragons),
      barons: E(s, e.t1Barons, e.t2Barons),
      heralds: E(s, e.t1Heralds, e.t2Heralds),
      grubs: o ? p("grubs").length : null,
      dragonTypes: p("dragon").map((d) => d.sub),
      firstBlood: o ? ss.get(G)?.teamId === s : null,
      firstTower: C(s, "tower"),
      firstDragon: C(s, "dragon"),
      firstBaron: C(s, "baron"),
      firstInhibitor: C(s, "inhibitor")
    };
  }), z = (s) => w.map((i, r) => s.reduce((p, d, k) => p + (c[k].teamId === 100 ? 1 : c[k].teamId === 200 ? -1 : 0) * d[r], 0)), ns = w.length > 1 ? { t: w.map((s) => Math.round(s / 1e3)), gold: O, xp: t, cs: a, level: l, goldDiff: z(O), xpDiff: z(t), kills: D, objectives: j } : null;
  return {
    gameId: us(e.matchId),
    creation: Number(e.gameStartMs),
    duration: e.duration,
    queueId: e.queueId,
    mapId: e.mapId,
    version: e.patch,
    remake: P,
    teams: ts,
    players: Y,
    timeline: ns,
    fromCore: !0
  };
}
function hs(e, m, c = null) {
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
}), J = { solo: "RANKED_SOLO_5x5", flex: "RANKED_FLEX_SR" };
function vs({ summoner: e, ranks: m, mastery: c, games: n }) {
  const f = (t) => {
    const a = m?.current.find((l) => l.queueType === J[t] && l.tier);
    return a ? V(a) : null;
  }, o = n.filter((t) => !t.remake), I = /* @__PURE__ */ new Map(), g = /* @__PURE__ */ new Map();
  for (const t of o) {
    const a = I.get(t.championId) ?? { championId: t.championId, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, cs: 0, seconds: 0, damage: 0, gold: 0, vision: 0 };
    a.games++, t.win && a.wins++, a.kills += t.kills, a.deaths += t.deaths, a.assists += t.assists, a.cs += t.cs, a.seconds += t.duration, a.damage += t.damage, a.gold += t.gold, a.vision += t.vision, I.set(t.championId, a), t.lane && g.set(t.lane, (g.get(t.lane) ?? 0) + 1);
  }
  const v = [...I.values()].sort((t, a) => a.games - t.games || a.wins - t.wins), T = (t) => {
    const a = (l) => t.reduce((y, D) => y + l(D), 0);
    return { games: a((l) => l.games), wins: a((l) => l.wins), kills: a((l) => l.kills), deaths: a((l) => l.deaths), assists: a((l) => l.assists), cs: a((l) => l.cs), seconds: a((l) => l.seconds) };
  }, h = o.map((t) => t.win), w = h.findIndex((t) => t !== h[0]), x = h.length ? (w < 0 ? h.length : w) * (h[0] ? 1 : -1) : 0, b = [...g].sort((t, a) => a[1] - t[1]), O = (m?.history ?? []).flatMap((t) => {
    const a = t.queueType === J.solo ? "solo" : t.queueType === J.flex ? "flex" : null, l = V(t), y = ls(l), D = Date.parse(t.fetchedAt);
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
        streak: x,
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
function ws(e, m) {
  const c = /* @__PURE__ */ new Map(), f = [...e.filter((o) => o.duration >= X && o.participants.some((I) => I.puuid === m))].sort((o, I) => Number(I.gameStartMs) - Number(o.gameStartMs)).slice(0, 40);
  for (const o of f) {
    const I = o.participants.find((g) => g.puuid === m).teamId;
    for (const g of o.participants) {
      if (!g.puuid || g.puuid === m || g.teamId !== I) continue;
      const v = c.get(g.puuid) ?? { puuid: g.puuid, gameName: g.gameName, tagLine: g.tagLine, icon: g.profileIconId ?? 0, games: 0, wins: 0, last: Number(o.gameStartMs) };
      v.games++, g.win && v.wins++, c.set(g.puuid, v);
    }
  }
  return {
    mates: [...c.values()].filter((o) => o.games >= 2).sort((o, I) => I.games - o.games || I.last - o.last).slice(0, 8),
    games: f.length
  };
}
export {
  Is as fromCoreMatch,
  us as gameIdOf,
  ws as playedWithFromCore,
  ks as positionOf,
  vs as profileFromCore,
  V as rankFromCore,
  hs as summaryOf
};
