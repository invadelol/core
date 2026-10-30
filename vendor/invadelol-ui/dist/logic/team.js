import { tk as e } from "./i18n.js";
const g = {
  rift: { win: [0.58, 0.35], loss: [-0.72, 0.39] },
  roleless: { win: [0.5, 0.38], loss: [-0.5, 0.38] }
}, l = 0.52, i = 1.28, c = 0.35, d = (t) => c - Math.log(100 / Math.min(99.5, Math.max(0.5, Math.round(t))) - 1);
function u(t, s) {
  if (t.remake || s?.length !== 4) return null;
  if (s.some((m) => m === null)) return { rating: "poor", afk: !0 };
  const a = s.reduce((m, w) => m + d(w * 10), 0) / 4, [n, o] = g[t.mapId === 11 ? "rift" : "roleless"][t.win ? "win" : "loss"], r = (a - n) / o;
  return { rating: r >= i ? "great" : r >= l ? "good" : r > -l ? "average" : r > -i ? "bad" : "poor", afk: !1 };
}
const y = (t, s) => u(t, s?.mates);
function Y(t, s) {
  const a = t.players.find((o) => o.puuid === s);
  if (!a || a.score === null) return null;
  const n = t.players.filter((o) => o.teamId === a.teamId && o !== a).map((o) => o.score);
  return u({ win: a.win, remake: t.remake, mapId: t.mapId }, n);
}
const p = {
  great: {
    label: e("Great team"),
    win: e("Your teammates played far better than most winning teams."),
    loss: e("Your teammates played far better than most losing teams.")
  },
  good: {
    label: e("Good team"),
    win: e("Your teammates played better than most winning teams."),
    loss: e("Your teammates held up better than most losing teams.")
  },
  average: {
    label: e("Average team"),
    win: e("Your teammates played like a usual winning team."),
    loss: e("Your teammates played like a usual losing team.")
  },
  bad: {
    label: e("Bad team"),
    win: e("You won with teammates below most winning teams."),
    loss: e("Your teammates played worse than most losing teams.")
  },
  poor: {
    label: e("Poor team"),
    win: e("You won with teammates far below most winning teams."),
    loss: e("Your teammates played far worse than most losing teams.")
  }
}, f = e("A teammate was AFK for much of the game."), h = e("From your four teammates’ Invade scores, against games with the same result.");
function k(t, s, a) {
  const n = t.afk ? f : p[t.rating][s ? "win" : "loss"];
  return `${a(n)}
${a(h)}`;
}
export {
  f as TEAM_AFK,
  h as TEAM_BASIS,
  p as TEAM_RATINGS,
  Y as detailTeamRating,
  y as rowTeamRating,
  u as teamRating,
  k as teamTip
};
