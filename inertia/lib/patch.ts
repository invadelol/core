/**
 * Patch names as players know them, for display only. Matches carry the game version ("16.20",
 * "16.20.734.5512"), but since 2026 Riot names each patch after the year: game version 16.N is
 * patch 26.N in the client, the patch notes and every stats site. Comparisons and data keys keep
 * the version; only what is printed changes. The same rule as the desktop app's.
 */
export function patchName(version: string | null | undefined): string {
  const v = (version ?? '').trim()
  const m = /^(\d+)\.(\d+)(?:\.\d+)*$/.exec(v)
  if (!m) return v
  const major = Number(m[1])
  // 2026 (16.x) onwards: the year's last two digits. Before that Riot's naming was irregular
  // (2025: "25.S1.1"...), so other forms are left as they are; a name already in the year form
  // (26.x and up) is kept, so mapping twice changes nothing.
  return major >= 16 && major < 26 ? `${major + 10}.${Number(m[2])}` : `${major}.${Number(m[2])}`
}
