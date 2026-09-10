/**
 * Column plans for ClickHouse reads.
 *
 * Every analytics query names its columns explicitly, so we always know the
 * exact shape of a result row before it arrives. That lets us ask ClickHouse
 * for `JSONCompactEachRow` — an array of values per row rather than an object
 * with every key repeated. On a match list of 150 rows x ~45 columns the
 * repeated key names are several times larger than the data itself, and every
 * one of those bytes costs transfer, `JSON.parse` work and garbage collection.
 *
 * The plan below is the single source of truth: the same list builds the
 * `SELECT` clause and the positional reader, so the two cannot drift.
 */

/** Maps an output property to the source column it reads. */
export type FieldPlan = Record<string, string>

export interface ColumnPlan<T> {
  /** The `SELECT` clause, in the order the reader expects. */
  select: string
  /** Reads one `JSONCompactEachRow` row into an output object. */
  read: (row: readonly unknown[]) => T
  /** Position of a column in a raw row, for values read outside `read`. */
  at: (column: string) => number
}

/**
 * Pairs a `SELECT` clause with a reader for the rows it produces.
 *
 * `derive` receives the raw positional row for values that are assembled
 * rather than read straight out of a single column.
 */
export function plan<T extends object>(
  columns: readonly string[],
  fields: FieldPlan,
  derive?: (row: readonly unknown[], at: (column: string) => number) => Record<string, unknown>
): ColumnPlan<T> {
  const index = new Map(columns.map((column, position) => [column, position]))
  const at = (column: string) => {
    const position = index.get(column)
    if (position === undefined) throw new Error(`Column "${column}" is not selected`)
    return position
  }

  // Resolved once at module load, so reading a row is a flat walk over integer
  // offsets rather than a string lookup per field per row.
  const steps = Object.entries(fields).map(([key, column]) => [key, at(column)] as const)

  return {
    select: columns.join(', '),
    at,
    read: (row) => {
      const out: Record<string, unknown> = {}
      for (const [key, position] of steps) out[key] = row[position]
      if (derive) Object.assign(out, derive(row, at))
      return out as T
    },
  }
}
