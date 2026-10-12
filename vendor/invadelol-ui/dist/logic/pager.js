const n = 15, P = 3, A = 12e4;
function e(E, t) {
  const a = Math.max(E, t) + 12e4, _ = a - t - 3 * 12e4;
  return _ > 0 ? { wait: _, tat: E } : { wait: 0, tat: a };
}
function G(E = Date.now) {
  let t = 0;
  return {
    /** Ms before the next page may load (0: now). */
    wait: () => e(t, E()).wait,
    /** Counts a page that loaded. */
    take() {
      t = Math.max(t, E()) + 12e4;
    },
    /** The source said to wait `ms` (its own count, a server's): the next page waits as long. */
    hold(a) {
      t = Math.max(t, E() + a + 2 * 12e4);
    }
  };
}
export {
  P as PAGE_BURST,
  A as PAGE_EVERY_MS,
  n as PAGE_SIZE,
  e as nextPage,
  G as pager
};
