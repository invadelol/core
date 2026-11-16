import { computed, reactive, ref, toValue, type MaybeRefOrGetter } from 'vue'

/**
 * Sortable tables: what `SortHead.vue` reads, and the two ways to give it rows.
 *
 * - `useSort` sorts the rows a page already holds, in the browser.
 * - `linkSort` is for a table the server pages: each head is an address with `sort` and `dir`,
 *   and the controller sorts the whole list before it cuts the page.
 *
 * A head clicked once sorts its column most first (or A to Z for a name, `first`), twice least
 * first, and a third time goes back to the table's own order. Rows without a value stay last
 * either way.
 */

export type SortDir = 'asc' | 'desc'
export type SortValue = number | string | boolean | null | undefined

/** The column a table follows and how to follow another one: what a `SortHead` reads. */
export interface Sorter {
  /** The column the rows follow, null for the table's own order (a tier list's tiers). */
  key: string | null
  dir: SortDir
  /** Sorts by `col` in the browser (`useSort`). */
  toggle?: (col: string) => void
  /** The address that sorts by `col` (`linkSort`, a table the server pages). */
  href?: (col: string) => string
}

export interface SortOptions {
  /** The table's own order: a column, or null when the rows come in an order of their own. */
  key?: string | null
  dir?: SortDir
  /** The direction a column sorts in on its first click when it is not `desc` (names: `asc`). */
  first?: Partial<Record<string, SortDir>>
}

/** The state after a click on `col`, from `state`, in a table whose own order is `options`. */
export function nextSort(
  state: { key: string | null; dir: SortDir },
  col: string,
  options: SortOptions = {}
): { key: string | null; dir: SortDir } {
  const home = { key: options.key ?? null, dir: options.dir ?? 'desc' }
  const first = options.first?.[col] ?? 'desc'
  if (state.key !== col) return { key: col, dir: first }
  if (state.dir === first) return { key: col, dir: first === 'desc' ? 'asc' : 'desc' }
  // Third click: back to the table's own order, or round again on the column that is that order.
  return home.key === col ? { key: col, dir: first } : home
}

/** A comparison of rows by `value` in `dir`: numbers, then words; nothing known always last. */
export function compareBy<T>(value: (row: T) => SortValue, dir: SortDir) {
  const sign = dir === 'desc' ? -1 : 1
  return (a: T, b: T) => {
    const x = value(a)
    const y = value(b)
    const xNone = x === null || x === undefined || (typeof x === 'number' && Number.isNaN(x))
    const yNone = y === null || y === undefined || (typeof y === 'number' && Number.isNaN(y))
    if (xNone || yNone) return xNone === yNone ? 0 : xNone ? 1 : -1
    if (typeof x === 'string' || typeof y === 'string') {
      return sign * String(x).localeCompare(String(y), 'en', { sensitivity: 'base' })
    }
    return sign * (Number(x) - Number(y))
  }
}

/**
 * Rows sorted in the browser by the column a head picked. `columns` gives each sortable column's
 * value; `sort.rows` are the rows in order (the same array while no column is picked).
 */
export function useSort<T>(
  rows: MaybeRefOrGetter<readonly T[]>,
  columns: MaybeRefOrGetter<Record<string, (row: T) => SortValue>>,
  options: SortOptions = {}
) {
  const key = ref<string | null>(options.key ?? null)
  const dir = ref<SortDir>(options.dir ?? 'desc')
  const home = () => key.value === (options.key ?? null) && dir.value === (options.dir ?? 'desc')
  const sorted = computed<T[]>(() => {
    const list = toValue(rows) as T[]
    const value = key.value ? toValue(columns)[key.value] : undefined
    if (!value) return list
    // Array.prototype.sort is stable: equal rows keep the order they came in.
    return [...list].sort(compareBy(value, dir.value))
  })
  return reactive({
    key,
    dir,
    rows: sorted,
    /** True once a head moved the table off its own order. */
    active: computed(() => !home()),
    toggle(col: string) {
      const next = nextSort({ key: key.value, dir: dir.value }, col, options)
      key.value = next.key
      dir.value = next.dir
    },
    reset() {
      key.value = options.key ?? null
      dir.value = options.dir ?? 'desc'
    },
  })
}

/**
 * Heads that are addresses, for a table the server pages: `to(key, dir)` writes the address of a
 * state (null `key`: the table's own order, so the address drops `sort` and `dir`).
 */
export function linkSort(
  state: { key: string | null; dir: SortDir },
  to: (key: string | null, dir: SortDir | null) => string,
  options: SortOptions = {}
): Sorter {
  const home = { key: options.key ?? null, dir: options.dir ?? 'desc' }
  return {
    key: state.key ?? home.key,
    dir: state.dir,
    href(col: string) {
      const next = nextSort({ key: state.key ?? home.key, dir: state.dir }, col, options)
      const isHome = next.key === home.key && next.dir === home.dir
      return isHome ? to(null, null) : to(next.key, next.dir)
    },
  }
}
