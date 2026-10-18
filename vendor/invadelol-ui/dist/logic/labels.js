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
function I(n, a = !0, t = l) {
  if (!n) return t("Unranked");
  const o = `${t(s[n.tier] ?? n.tier)}${n.division ? ` ${n.division}` : ""}`;
  return a ? `${o} · ${n.lp} ${t("LP")}` : o;
}
function M(n) {
  if (!n) return "–";
  const a = n.tier === "GRANDMASTER" ? "GM" : n.tier === "CHALLENGER" ? "C" : n.tier[0], t = { I: "1", II: "2", III: "3", IV: "4" }[n.division] ?? "";
  return a + t;
}
function N(n) {
  if (!n) return null;
  const a = i.indexOf(n.tier);
  if (a < 0) return null;
  if (a >= 7) return 28 + n.lp / 100;
  const t = { IV: 0, III: 1, II: 2, I: 3 }[n.division] ?? 0;
  return a * 4 + t + n.lp / 100;
}
function b(n) {
  return n && i.includes(n) ? `var(--tier-${n.toLowerCase()})` : "var(--text-2)";
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
}, g = (n) => r[n ?? ""] ?? null, h = (n) => n.games ? n.wins / n.games : 0, k = (n) => (n.kills + n.assists) / Math.max(1, n.deaths), S = 65535, u = {
  0: e("Custom"),
  4: e("Ranked Solo/Duo"),
  6: e("Ranked Premade"),
  42: e("Ranked Team"),
  400: e("Normal Draft"),
  410: e("Ranked Dynamic"),
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
  2400: e("ARAM: Mayhem"),
  3140: e("Practice Tool")
}, d = (n, a = l) => a(u[n] ?? e("Unknown queue")), c = [
  { id: e("all"), label: e("All queues"), queues: null },
  { id: e("solo"), label: e("Ranked Solo/Duo"), queues: [420] },
  { id: e("flex"), label: e("Ranked Flex"), queues: [440] },
  { id: e("normal"), label: e("Normal"), queues: [400, 430, 480, 490] },
  { id: e("aram"), label: e("ARAM"), queues: [450, 720, 2400] },
  { id: e("arena"), label: e("Arena"), queues: [1700, 1710, 1750] }
], R = { all: e("All"), solo: e("Solo/Duo"), flex: e("Flex") };
function D(n, a = l) {
  const t = c.find((o) => o.queues?.includes(n));
  return t ? a(R[t.id] ?? t.label) : d(n, a);
}
const A = {
  TOP: e("Top"),
  JUNGLE: e("Jungle"),
  MID: e("Mid"),
  ADC: e("Bot"),
  SUPPORT: e("Support")
}, v = (n, a = l) => n ? a(A[n]) : "", f = {
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
}, m = ["penta", "quadra", "triple", "lane_won", "carry_damage", "deathless", "first_blood", "objectives", "vision", "tank", "cc"], L = (n, a = 2) => m.filter((t) => n?.includes(t)).slice(0, a), E = {
  games: [e("{n} game"), e("{n} games")],
  wins: [e("{n} win"), e("{n} wins")],
  kills: [e("{n} kill"), e("{n} kills")],
  deaths: [e("{n} death"), e("{n} deaths")],
  events: [e("{n} event"), e("{n} events")],
  changes: [e("{n} change"), e("{n} changes")]
}, T = (n, a, t = l) => t(E[a][n === 1 ? 0 : 1], { n });
export {
  f as BADGES,
  A as POSITIONS,
  c as QUEUE_FILTERS,
  R as QUEUE_SHORT,
  i as TIERS,
  S as UNKNOWN_QUEUE,
  T as count,
  k as kda,
  v as positionName,
  d as queueName,
  D as queueShort,
  I as rankLabel,
  M as rankShort,
  N as rankValue,
  b as tierColor,
  g as tierRgb,
  L as topBadges,
  h as winRate
};
