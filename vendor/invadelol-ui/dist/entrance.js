import { onMounted as r, onBeforeUnmount as i } from "vue";
const f = 900;
let n = 0, e = !0, t = 0;
function d() {
  r(() => {
    n++;
  }), i(() => {
    --n <= 0 && (n = 0, e = !0);
  });
}
function l() {
  if (typeof window > "u") return !0;
  const o = performance.now();
  return e && (e = !1, t = o + f), o <= t;
}
export {
  l as drawsIn,
  d as joinView
};
