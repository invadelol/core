import { reactive as r, provide as e, inject as n } from "vue";
const o = /* @__PURE__ */ Symbol("iv-stat-groups");
function s() {
  const t = r(/* @__PURE__ */ new Map());
  return e(o, t), t;
}
const u = () => n(o, null);
export {
  s as provideStatGroups,
  u as useStatGroups
};
