import { roleSlot as ae, SCORE_CATEGORIES as oe, PINGS as le } from "./detail.js";
import { rankValue as re } from "./labels.js";
const de = Object.keys(le), q = { TOP: "TOP", JUNGLE: "JUNGLE", MIDDLE: "MID", BOTTOM: "ADC", UTILITY: "SUPPORT" }, ce = /* @__PURE__ */ new Set(["carry_damage", "tank", "vision", "cc", "objectives", "first_blood", "triple", "quadra", "penta", "deathless", "lane_won"]), X = 300, ue = 900 * 1e3, ke = (s) => q[s ?? ""] ?? null, me = (s) => Number(s.slice(s.lastIndexOf("_") + 1)) || 0, Q = (s) => {
  const m = Object.keys(q).indexOf(s.position);
  return m < 0 ? 5 : m;
};
function pe(s, m) {
  if (m.position) {
    const f = s.find((i) => i.teamId !== m.teamId && i.position === m.position);
    if (f) return f;
  }
  const c = s.filter((f) => f.teamId === m.teamId), n = s.filter((f) => f.teamId !== m.teamId);
  return n[c.indexOf(m)] ?? n[0];
}
function he(s, m = {}) {
  const c = [...s.participants].sort((e, a) => e.teamId - a.teamId || Q(e) - Q(a)), n = s.timeline ?? [], f = s.events ?? [], i = f.length > 0, k = Math.max(s.duration / 60, 1), g = c.some((e) => e.position in q), v = s.completeness?.pings !== !1 && c.some((e) => e.allInPings !== void 0), T = /* @__PURE__ */ new Map();
  for (const e of n) e.puuid && !T.has(e.puuid) && T.set(e.puuid, e.participantId);
  const h = (e) => T.get(e.puuid) ?? c.indexOf(e) + 1, w = [...new Set(n.map((e) => e.frameMs))].sort((e, a) => e - a), x = new Map(w.map((e, a) => [e, a])), b = (e, a) => {
    const r = new Array(w.length).fill(0);
    for (const p of n) p.puuid === e && (r[x.get(p.frameMs)] = a(p));
    for (let p = 1; p < r.length; p++) !r[p] && r[p - 1] && (r[p] = r[p - 1]);
    return r;
  }, O = c.map((e) => b(e.puuid, (a) => a.goldTotal)), t = c.map((e) => b(e.puuid, (a) => a.xp)), o = c.map((e) => b(e.puuid, (a) => a.cs + a.jungleCs)), l = c.map((e) => b(e.puuid, (a) => a.level)), y = x.get(ue), D = f.filter((e) => e.kind === "kill").map((e) => ({ t: e.t, killer: e.killer, victim: e.victim, assists: e.assists ?? [], x: e.x, y: e.y })).sort((e, a) => e.t - a.t), j = f.filter((e) => e.kind !== "kill").map((e) => ({ t: e.t, kind: e.kind, sub: e.sub, team: e.team, lane: e.lane, killer: e.killer })).sort((e, a) => e.t - a.t), G = D[0]?.killer ?? 0, S = /* @__PURE__ */ new Map();
  for (const e of s.shop ?? [])
    e.item && (S.has(e.player) || S.set(e.player, []), S.get(e.player).push({ t: e.t, item: e.item, sold: e.sold }));
  const K = /* @__PURE__ */ new Map(), U = /* @__PURE__ */ new Map(), F = /* @__PURE__ */ new Map(), H = (e, a, r) => e.set(a, (e.get(a) ?? 0) + (r || 0));
  for (const e of c)
    H(K, e.teamId, e.kills), H(U, e.teamId, e.goldEarned), H(F, e.teamId, e.totalDamageDealtToChampions);
  const N = m.scores ?? {}, W = c.filter((e) => N[e.puuid] !== void 0).sort((e, a) => N[a.puuid] - N[e.puuid]), P = s.duration < X, $ = P ? void 0 : W.find((e) => e.win), Z = P ? void 0 : W.find((e) => !e.win), Y = c.map((e, a) => {
    const r = g ? pe(c, e) : void 0, p = r ? c.indexOf(r) : -1, d = (u) => y !== void 0 && p >= 0 ? u[a][y] - u[p][y] : null, I = n.find((u) => u.puuid === e.puuid && u.perks?.keystone)?.perks, L = I?.statPerks ? [I.statPerks.offense, I.statPerks.flex, I.statPerks.defense] : [], _ = I ? I.runes.filter((u) => u > 0) : [], A = I?.keystone || e.perks.keystone, ie = _.length ? (_[0] === A ? _ : [A, ..._]).slice(0, 6) : A ? [A] : [], M = [];
    e === $ ? M.push("mvp") : e === Z && M.push("ace");
    for (const u of m.badges?.[e.puuid] ?? []) ce.has(u) && !M.includes(u) && M.push(u);
    i && G === h(e) && !M.includes("first_blood") && M.push("first_blood");
    const B = P ? void 0 : N[e.puuid], R = B === void 0 ? void 0 : m.parts?.[e.puuid];
    return {
      participantId: h(e),
      teamId: e.teamId,
      win: !!e.win,
      puuid: e.puuid,
      gameName: e.gameName,
      tagLine: e.tagLine,
      championId: e.championId,
      level: e.champLevel || e.level,
      spells: e.spells,
      perks: ie,
      styles: [I?.primaryStyle || e.perks.primary, I?.secondaryStyle || e.perks.sub],
      items: e.items,
      kills: e.kills,
      deaths: e.deaths,
      assists: e.assists,
      kp: K.get(e.teamId) ? (e.kills + e.assists) / K.get(e.teamId) : 0,
      cs: e.cs,
      jungleCs: e.neutralMinionsKilled,
      csMin: e.cs / k,
      gold: e.goldEarned,
      goldShare: U.get(e.teamId) ? e.goldEarned / U.get(e.teamId) : 0,
      damage: e.totalDamageDealtToChampions,
      physical: e.physicalDamageDealtToChampions,
      magic: e.magicDamageDealtToChampions,
      trueDamage: e.trueDamageDealtToChampions,
      damageShare: F.get(e.teamId) ? e.totalDamageDealtToChampions / F.get(e.teamId) : 0,
      damageTaken: e.damageTaken,
      mitigated: null,
      healing: null,
      vision: e.visionScore,
      wardsPlaced: e.wardsPlaced,
      wardsKilled: e.wardsKilled,
      controlWards: e.visionWardsBoughtInGame,
      ccTime: null,
      objectiveDamage: e.damageDealtToObjectives,
      turretDamage: e.damageDealtToTurrets,
      doubles: null,
      triples: null,
      quadras: null,
      pentas: null,
      largestSpree: null,
      largestMulti: null,
      firstBlood: i && G === h(e),
      position: g ? q[e.position] ?? null : null,
      opponent: r ? h(r) : null,
      gold15: d(O),
      xp15: d(t),
      cs15: d(o),
      score: B === void 0 ? null : B / 10,
      parts: R ? oe.filter((u) => R.weights[u] > 0).map((u) => ({ key: u, value: R.categories[u], weight: R.weights[u] })) : [],
      rank: B === void 0 ? 0 : W.indexOf(e) + 1,
      badges: M,
      skills: n.find((u) => u.puuid === e.puuid && u.skillOrder?.length)?.skillOrder ?? [],
      augments: [],
      placement: 0,
      ...L.every(Boolean) ? { shards: L } : {},
      ...S.size ? { purchases: S.get(h(e)) ?? [] } : {},
      ...ae(e.roleItem) ? { roleItem: e.roleItem } : {},
      ...v ? { pings: Object.fromEntries(de.map((u) => [u, e[`${u}Pings`] ?? 0])) } : {}
    };
  }), ee = new Map(Y.map((e) => [e.participantId, e])), se = (e) => e === 100, E = (e, a, r) => e === 100 ? a : e === 200 ? r : 0, C = (e, a) => {
    if (!i) return null;
    const r = j.find((p) => p.kind === a);
    return !!r && r.team === e;
  }, te = [...new Set(c.map((e) => e.teamId))].sort((e, a) => e - a).map((e) => {
    const a = Y.filter((d) => d.teamId === e), r = (d) => a.reduce((I, L) => I + d(L), 0), p = (d) => j.filter((I) => I.kind === d && I.team === e);
    return {
      teamId: e,
      win: a.some((d) => d.win),
      bans: ((se(e) ? s.t1Bans : e === 200 ? s.t2Bans : []) ?? []).filter((d) => d > 0),
      kills: r((d) => d.kills),
      deaths: r((d) => d.deaths),
      assists: r((d) => d.assists),
      gold: r((d) => d.gold),
      damage: r((d) => d.damage),
      towers: E(e, s.t1Towers, s.t2Towers),
      inhibitors: E(e, s.t1Inhibs, s.t2Inhibs),
      dragons: E(e, s.t1Dragons, s.t2Dragons),
      barons: E(e, s.t1Barons, s.t2Barons),
      heralds: E(e, s.t1Heralds, s.t2Heralds),
      grubs: i ? p("grubs").length : null,
      dragonTypes: p("dragon").map((d) => d.sub),
      firstBlood: i ? ee.get(G)?.teamId === e : null,
      firstTower: C(e, "tower"),
      firstDragon: C(e, "dragon"),
      firstBaron: C(e, "baron"),
      firstInhibitor: C(e, "inhibitor")
    };
  }), z = (e) => w.map((a, r) => e.reduce((p, d, I) => p + (c[I].teamId === 100 ? 1 : c[I].teamId === 200 ? -1 : 0) * d[r], 0)), ne = w.length > 1 ? { t: w.map((e) => Math.round(e / 1e3)), gold: O, xp: t, cs: o, level: l, goldDiff: z(O), xpDiff: z(t), kills: D, objectives: j } : null;
  return {
    gameId: me(s.matchId),
    creation: Number(s.gameStartMs),
    duration: s.duration,
    queueId: s.queueId,
    mapId: s.mapId,
    version: s.patch,
    remake: P,
    teams: te,
    players: Y,
    timeline: ne,
    fromCore: !0
  };
}
function ve(s, m, c = null) {
  const n = s.players.find((i) => i.puuid === m);
  if (!n) return null;
  const f = s.players.find((i) => i.participantId === n.opponent);
  return {
    gameId: s.gameId,
    matchId: c,
    creation: s.creation,
    duration: s.duration,
    queueId: s.queueId,
    mapId: s.mapId,
    championId: n.championId,
    win: n.win,
    remake: s.remake,
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
      gameId: s.gameId,
      score: n.score,
      rank: n.rank,
      tag: n.badges.includes("mvp") ? "mvp" : n.badges.includes("ace") ? "ace" : "",
      opponent: f?.championId ?? null,
      kp: n.kp,
      badges: n.badges.filter((i) => i !== "mvp" && i !== "ace"),
      mates: s.players.filter((i) => i.teamId === n.teamId && i !== n).map((i) => i.score)
    }
  };
}
const V = (s) => ({
  tier: s.tier,
  division: ["MASTER", "GRANDMASTER", "CHALLENGER"].includes(s.tier) ? "" : s.division,
  lp: s.leaguePoints,
  wins: s.wins,
  losses: s.losses ?? 0,
  provisional: !1,
  previous: ""
}), J = { solo: "RANKED_SOLO_5x5", flex: "RANKED_FLEX_SR" };
function we({ summoner: s, ranks: m, mastery: c, games: n }) {
  const f = (t) => {
    const o = m?.current.find((l) => l.queueType === J[t] && l.tier);
    return o ? V(o) : null;
  }, i = n.filter((t) => !t.remake), k = /* @__PURE__ */ new Map(), g = /* @__PURE__ */ new Map();
  for (const t of i) {
    const o = k.get(t.championId) ?? { championId: t.championId, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, cs: 0, seconds: 0, damage: 0, gold: 0, vision: 0 };
    o.games++, t.win && o.wins++, o.kills += t.kills, o.deaths += t.deaths, o.assists += t.assists, o.cs += t.cs, o.seconds += t.duration, o.damage += t.damage, o.gold += t.gold, o.vision += t.vision, k.set(t.championId, o), t.lane && g.set(t.lane, (g.get(t.lane) ?? 0) + 1);
  }
  const v = [...k.values()].sort((t, o) => o.games - t.games || o.wins - t.wins), T = (t) => {
    const o = (l) => t.reduce((y, D) => y + l(D), 0);
    return { games: o((l) => l.games), wins: o((l) => l.wins), kills: o((l) => l.kills), deaths: o((l) => l.deaths), assists: o((l) => l.assists), cs: o((l) => l.cs), seconds: o((l) => l.seconds) };
  }, h = i.map((t) => t.win), w = h.findIndex((t) => t !== h[0]), x = h.length ? (w < 0 ? h.length : w) * (h[0] ? 1 : -1) : 0, b = [...g].sort((t, o) => o[1] - t[1]), O = (m?.history ?? []).flatMap((t) => {
    const o = t.queueType === J.solo ? "solo" : t.queueType === J.flex ? "flex" : null, l = V(t), y = re(l), D = Date.parse(t.fetchedAt);
    return o && y !== null && D ? [{ t: D, queue: o, tier: l.tier, division: l.division, lp: l.lp, wins: l.wins, losses: l.losses, value: Math.round(y * 100) }] : [];
  }).sort((t, o) => t.t - o.t);
  return {
    card: {
      puuid: s.puuid,
      gameName: s.gameName,
      tagLine: s.tagLine,
      icon: s.profileIconId ?? 0,
      level: s.summonerLevel ?? 0,
      private: !1,
      solo: f("solo"),
      flex: f("flex"),
      recent: {
        ...T(v),
        results: h,
        streak: x,
        lanes: b,
        champions: v.map((t) => ({ championId: t.championId, games: t.games, wins: t.wins, kills: t.kills, deaths: t.deaths, assists: t.assists, cs: t.cs, seconds: t.seconds })),
        ranked: i.filter((t) => t.queueId === 420).length
      },
      mastery: [...c].sort((t, o) => o.championPoints - t.championPoints),
      offline: !1
    },
    isSelf: !1,
    isOwn: !1,
    champions: v,
    lanes: b,
    lp: O
  };
}
function ye(s, m) {
  const c = /* @__PURE__ */ new Map(), f = [...s.filter((i) => i.duration >= X && i.participants.some((k) => k.puuid === m))].sort((i, k) => Number(k.gameStartMs) - Number(i.gameStartMs)).slice(0, 40);
  for (const i of f) {
    const k = i.participants.find((g) => g.puuid === m).teamId;
    for (const g of i.participants) {
      if (!g.puuid || g.puuid === m || g.teamId !== k) continue;
      const v = c.get(g.puuid) ?? { puuid: g.puuid, gameName: g.gameName, tagLine: g.tagLine, icon: g.profileIconId ?? 0, games: 0, wins: 0, last: Number(i.gameStartMs) };
      v.games++, g.win && v.wins++, c.set(g.puuid, v);
    }
  }
  return {
    mates: [...c.values()].filter((i) => i.games >= 2).sort((i, k) => k.games - i.games || k.last - i.last).slice(0, 8),
    games: f.length
  };
}
export {
  he as fromCoreMatch,
  me as gameIdOf,
  ye as playedWithFromCore,
  ke as positionOf,
  we as profileFromCore,
  V as rankFromCore,
  ve as summaryOf
};
