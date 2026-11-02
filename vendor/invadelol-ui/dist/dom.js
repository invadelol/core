function t(e) {
  e.target.style.visibility = "hidden";
}
function i(e) {
  if (typeof requestAnimationFrame > "u") return e();
  requestAnimationFrame(() => setTimeout(e, 0));
}
export {
  i as afterPaint,
  t as hideBroken
};
