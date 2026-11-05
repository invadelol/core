const f = {
  8e3: [[8005, 8008, 8021, 8010], [9101, 9111, 8009], [9104, 9105, 9103], [8014, 8017, 8299]],
  8100: [[8112, 8128, 9923], [8126, 8139, 8143], [8137, 8140, 8141], [8135, 8105, 8106]],
  8200: [[8214, 8229, 8230, 8992], [8224, 8226, 8275], [8210, 8234, 8233], [8237, 8232, 8236]],
  8400: [[8437, 8439, 8465], [8446, 8463, 8401], [8429, 8444, 8473], [8451, 8453, 8242]],
  8300: [[8351, 8360, 8369], [8306, 8304, 8321], [8313, 8345, 8352], [8347, 8410, 8316]]
}, S = [
  [5008, 5005, 5007],
  [5008, 5010, 5001],
  [5011, 5013, 5001]
];
function h(t, u = f, l = S) {
  const a = (e, o) => {
    const s = new Set(e.slice(1)), n = u[e[0]];
    if (!n) return { tree: e[0], rows: e.slice(1).map((r) => [{ id: r, on: !0 }]), keystones: !1 };
    const m = o ? n : n.slice(1);
    return { tree: e[0], rows: m.map((r) => r.map((c) => ({ id: c, on: s.has(c) }))), keystones: o };
  };
  return {
    primary: a(t.p, !0),
    secondary: a(t.s, !1),
    // A row may list the same shard twice across rows (health scaling): each row lights its own.
    shards: t.m.length ? l.map((e, o) => e.map((s, n) => ({ id: s, on: t.m[o] === s && e.indexOf(s) === n }))) : []
  };
}
export {
  f as RUNE_SLOTS,
  S as SHARD_ROWS,
  h as runePageView
};
