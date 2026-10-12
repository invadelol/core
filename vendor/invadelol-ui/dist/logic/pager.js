const n = 15;
function r(t = Date.now) {
  let e = !1, l = 0;
  return {
    /** Whether reaching the end now asks for the next page (never before the source's window). */
    ask: () => !e || t() >= l,
    /** Whether the source held older games back: the list ends quietly (it may ask again later). */
    held: () => e,
    /** The source held older games back for `ms`: the end stays quiet until a later reach after it. */
    hold(a) {
      e = !0, l = t() + Math.max(0, a);
    },
    /** A page loaded: the end asks freely again. */
    clear() {
      e = !1;
    }
  };
}
export {
  n as PAGE_SIZE,
  r as endOfList
};
