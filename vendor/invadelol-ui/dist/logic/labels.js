import { english as l, tk as e } from "./i18n.js";
const i = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"], s = {
  IRON: e("Iron"),
  BRONZE: e("Bronze"),
  SILVER: e("Silver"),
  GOLD: e("Gold"),
  PLATINUM: e("Platinum"),
  EMERALD: e("Emerald"),
  DIAMOND: e("Diamond"),
  MASTER: e("Master"),
  GRANDMASTER: e("Grandmaster"),
  CHALLENGER: e("Challenger")
};
function I(t, n = !0, a = l) {
  if (!t) return a("Unranked");
  const o = `${a(s[t.tier] ?? t.tier)}${t.division ? ` ${t.division}` : ""}`;
  return n ? `${o} · ${t.lp} ${a("LP")}` : o;
}
function M(t) {
  if (!t) return "–";
  const n = t.tier === "GRANDMASTER" ? "GM" : t.tier === "CHALLENGER" ? "C" : t.tier[0], a = { I: "1", II: "2", III: "3", IV: "4" }[t.division] ?? "";
  return n + a;
}
function N(t) {
  if (!t) return null;
  const n = i.indexOf(t.tier);
  if (n < 0) return null;
  if (n >= 7) return 28 + t.lp / 100;
  const a = { IV: 0, III: 1, II: 2, I: 3 }[t.division] ?? 0;
  return n * 4 + a + t.lp / 100;
}
function b(t) {
  return t && i.includes(t) ? `var(--tier-${t.toLowerCase()})` : "var(--text-2)";
}
const r = {
  IRON: "138 127 122",
  BRONZE: "176 113 77",
  SILVER: "159 177 189",
  GOLD: "225 183 90",
  PLATINUM: "79 184 168",
  EMERALD: "46 194 126",
  DIAMOND: "111 140 255",
  MASTER: "179 107 255",
  GRANDMASTER: "255 93 108",
  CHALLENGER: "244 210 122"
}, g = (t) => r[t ?? ""] ?? null, h = (t) => t.games ? t.wins / t.games : 0, S = (t) => (t.kills + t.assists) / Math.max(1, t.deaths), u = {
  0: e("Custom"),
  400: e("Normal Draft"),
  420: e("Ranked Solo/Duo"),
  430: e("Normal Blind"),
  440: e("Ranked Flex"),
  450: e("ARAM"),
  480: e("Swiftplay"),
  490: e("Quickplay"),
  700: e("Clash"),
  720: e("ARAM Clash"),
  830: e("Co-op vs AI"),
  840: e("Co-op vs AI"),
  850: e("Co-op vs AI"),
  870: e("Co-op vs AI"),
  880: e("Co-op vs AI"),
  890: e("Co-op vs AI"),
  900: e("ARURF"),
  1020: e("One for All"),
  1300: e("Nexus Blitz"),
  1700: e("Arena"),
  1710: e("Arena"),
  1750: e("Arena"),
  1810: e("Swarm"),
  1900: e("URF"),
  2300: e("Brawl"),
  2400: e("ARAM: Mayhem")
}, d = (t, n = l) => n(u[t] ?? e("Custom")), c = [
  { id: e("all"), label: e("All queues"), queues: null },
  { id: e("solo"), label: e("Ranked Solo/Duo"), queues: [420] },
  { id: e("flex"), label: e("Ranked Flex"), queues: [440] },
  { id: e("normal"), label: e("Normal"), queues: [400, 430, 480, 490] },
  { id: e("aram"), label: e("ARAM"), queues: [450, 720, 2400] },
  { id: e("arena"), label: e("Arena"), queues: [1700, 1710, 1750] }
], A = { all: e("All"), solo: e("Solo/Duo"), flex: e("Flex") };
function v(t, n = l) {
  const a = c.find((o) => o.queues?.includes(t));
  return a ? n(A[a.id] ?? a.label) : d(t, n);
}
const R = {
  TOP: e("Top"),
  JUNGLE: e("Jungle"),
  MID: e("Mid"),
  ADC: e("Bot"),
  SUPPORT: e("Support")
}, D = (t, n = l) => t ? n(R[t]) : "", f = {
  mvp: { label: e("MVP"), tip: e("Best player of the winning team") },
  ace: { label: e("ACE"), tip: e("Best player of the losing team") },
  carry_damage: { label: e("Most damage"), tip: e("Most damage to champions in the game") },
  tank: { label: e("Most tanked"), tip: e("Most damage taken and mitigated in the game") },
  vision: { label: e("Best vision"), tip: e("Highest vision score in the game") },
  cc: { label: e("Most CC"), tip: e("Most crowd control in the game") },
  objectives: { label: e("Objectives"), tip: e("Most damage to objectives in the game") },
  first_blood: { label: e("First blood"), tip: e("First blood") },
  triple: { label: e("Triple kill"), tip: e("Triple kill") },
  quadra: { label: e("Quadra kill"), tip: e("Quadra kill") },
  penta: { label: e("Penta kill"), tip: e("Penta kill") },
  deathless: { label: e("Deathless"), tip: e("No deaths in a game of 15 minutes or more") },
  lane_won: { label: e("Lane won"), tip: e("1000+ gold ahead of the lane opponent at 15 minutes") }
}, m = ["penta", "quadra", "triple", "lane_won", "carry_damage", "deathless", "first_blood", "objectives", "vision", "tank", "cc"], L = (t, n = 2) => m.filter((a) => t?.includes(a)).slice(0, n), E = {
  games: [e("{n} game"), e("{n} games")],
  wins: [e("{n} win"), e("{n} wins")],
  kills: [e("{n} kill"), e("{n} kills")],
  deaths: [e("{n} death"), e("{n} deaths")],
  events: [e("{n} event"), e("{n} events")],
  changes: [e("{n} change"), e("{n} changes")]
}, k = (t, n, a = l) => a(E[n][t === 1 ? 0 : 1], { n: t });
export {
  f as BADGES,
  R as POSITIONS,
  c as QUEUE_FILTERS,
  A as QUEUE_SHORT,
  i as TIERS,
  k as count,
  S as kda,
  D as positionName,
  d as queueName,
  v as queueShort,
  I as rankLabel,
  M as rankShort,
  N as rankValue,
  b as tierColor,
  g as tierRgb,
  L as topBadges,
  h as winRate
};
