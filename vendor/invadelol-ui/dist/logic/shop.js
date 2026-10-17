function m(l) {
  const s = [];
  let i = -1 / 0;
  for (const t of [...l].sort((o, e) => o.t - e.t)) {
    (t.t - i > 45 || !s.length) && s.push({ t: t.t, items: [] }), i = t.t;
    const o = s[s.length - 1], e = o.items.find((n) => n.item === t.item && n.sold === t.sold);
    e ? e.count++ : o.items.push({ item: t.item, sold: t.sold, count: 1, t: t.t });
  }
  for (const t of s) t.items.sort((o, e) => Number(o.sold) - Number(e.sold));
  return s;
}
export {
  m as shopVisits
};
