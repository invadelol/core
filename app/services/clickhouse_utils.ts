export function toInt(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.trunc(n)
}

export function toBool01(value: unknown): 0 | 1 {
  if (value === true) return 1
  if (value === false) return 0
  const n = toInt(value, 0)
  return n ? 1 : 0
}

export function patchFromGameVersion(version: unknown): string {
  if (typeof version !== 'string' || !version.trim()) return ''
  const [major, minor] = version.split('.', 3)
  if (!major || !minor) return version
  return `${major}.${minor}`
}

