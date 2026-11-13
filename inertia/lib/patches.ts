/**
 * Patch ranges: the statistics read one patch (`?patch=16.22`) or several patches in a row
 * (`?patch=16.20-16.22`, oldest first). Shared by the server, which reads the address, and the
 * pages, which build the Patch menu and say which patches a figure counts.
 */

/** One patch or a range of them, as an address (and the API's `patch`) writes it. */
export const PATCH_PATTERN = /^\d{1,2}\.\d{1,2}(-\d{1,2}\.\d{1,2})?$/

/** The most patches a range reads: each one is a patch's worth of games. */
export const MAX_RANGE = 5

/** The ranges the Patch menu offers, as a number of the newest patches. */
export const RANGE_SIZES = [2, 3] as const

/**
 * The patches an address value reads among the `offered` ones (newest first), newest first: one
 * patch, or every offered patch from one end of the range to the other (either order). Null when
 * a patch is not offered, the value is not a patch, or the range is over `MAX_RANGE`.
 */
export function patchRange(value: unknown, offered: readonly string[]): string[] | null {
  const s = String(value ?? '').trim()
  if (!PATCH_PATTERN.test(s)) return null
  const [from, to = from] = s.split('-')
  const a = offered.indexOf(from)
  const b = offered.indexOf(to)
  if (a < 0 || b < 0) return null
  const [newest, oldest] = a < b ? [a, b] : [b, a]
  if (oldest - newest + 1 > MAX_RANGE) return null
  return offered.slice(newest, oldest + 1)
}

/** The address value of patches (newest first): `16.22`, or `16.20-16.22` for several. */
export function patchValue(patches: readonly string[]) {
  if (patches.length < 2) return patches[0] ?? ''
  return `${patches[patches.length - 1]}-${patches[0]}`
}

/** Whether an address value names several patches. */
export const isRange = (value: string | null | undefined) => Boolean(value?.includes('-'))

/** The newest patch of an address value (`16.22` for `16.20-16.22`). */
export const newestOf = (value: string) => value.split('-').pop() ?? value

/** An address value as text: `16.22`, `16.20–16.22`. */
export const patchName = (value: string) => value.replace('-', '–')

/** An address value in a sentence: "patch 16.22", "patches 16.20–16.22". */
export const patchText = (value: string) =>
  `${isRange(value) ? 'patches' : 'patch'} ${patchName(value)}`

/** An address value as a heading or a menu entry: "Patch 16.22", "Patches 16.20–16.22". */
export const patchHeading = (value: string) =>
  `${isRange(value) ? 'Patches' : 'Patch'} ${patchName(value)}`

/**
 * The same number of patches just before a range (or the patch before one patch), among the
 * `offered` ones (newest first): what a "since" column compares with. Null when there are not
 * that many older patches offered.
 */
export function previousRange(patches: readonly string[], offered: readonly string[]) {
  const at = offered.indexOf(patches[patches.length - 1])
  if (at < 0 || !patches.length) return null
  const before = offered.slice(at + 1, at + 1 + patches.length)
  return before.length === patches.length ? before : null
}

/**
 * The Patch menu: each offered patch (newest first), then the newest two and three together.
 * The value in the address is kept as an option of its own when it is none of these (an older
 * range someone linked).
 */
export function patchOptions(offered: readonly string[], current?: string | null) {
  const options: { value: string; label: string }[] = offered.map((p) => ({
    value: p,
    label: `Patch ${p}`,
  }))
  for (const n of RANGE_SIZES) {
    if (offered.length < n) break
    const value = patchValue(offered.slice(0, n))
    options.push({ value, label: `Last ${n} patches` })
  }
  if (current && !options.some((o) => o.value === current)) {
    options.push({ value: current, label: patchHeading(current) })
  }
  return options
}
