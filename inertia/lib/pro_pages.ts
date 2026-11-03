/**
 * The pro pages' props, read defensively: a page can get an answer cached by an older release, a
 * partial reload or a field the server left out, and a missing list or record must draw as empty,
 * never throw. Each page reads its props through these.
 */

const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
const object = <T extends object>(v: unknown): T =>
  (v && typeof v === 'object' && !Array.isArray(v) ? v : {}) as T
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export interface Record30 {
  games: number
  wins: number
  kills: number
  deaths: number
  assists: number
}

export function record(v: unknown): Record30 {
  const r = object<Partial<Record30>>(v)
  return {
    games: num(r.games),
    wins: num(r.wins),
    kills: num(r.kills),
    deaths: num(r.deaths),
    assists: num(r.assists),
  }
}

/** A pro's page (`pros/show`). */
export function proPage<T extends Record<string, any>>(raw: T | null | undefined) {
  const p = object<T>(raw)
  return {
    ...p,
    slug: String(p.slug ?? ''),
    name: String(p.name ?? ''),
    role: (p.role ?? null) as string | null,
    country: (p.country ?? null) as string | null,
    staff: Boolean(p.staff),
    team: p.team ?? null,
    league: p.league ?? null,
    socials: object<Record<string, string>>(p.socials),
    accounts: list<T['accounts'][number]>(p.accounts),
    teams: list<T['teams'][number]>(p.teams).filter((t) => t && t.team),
    games: list<T['games'][number]>(p.games),
    record: record(p.record),
    champions: list<T['champions'][number]>(p.champions),
    builds: list<T['builds'][number]>(p.builds).map((b) => ({
      ...b,
      core: list<number>(b.core),
      max: list<string>(b.max),
      form: list<boolean>(b.form),
    })),
  } as T & { record: Record30 }
}

/** A team's page (`pros/team`). */
export function teamPage<T extends Record<string, any>>(raw: T | null | undefined) {
  const t = object<T>(raw)
  return {
    ...t,
    id: String(t.id ?? ''),
    slug: String(t.slug ?? ''),
    name: String(t.name ?? ''),
    shortName: (t.shortName ?? null) as string | null,
    region: (t.region ?? null) as string | null,
    active: t.active !== false,
    socials: object<Record<string, string>>(t.socials),
    league: t.league ?? null,
    lp: typeof t.lp === 'number' ? t.lp : null,
    place: typeof t.place === 'number' ? t.place : null,
    roster: list<T['roster'][number]>(t.roster).map((m) => ({ ...m, now: m.now ?? null })),
    games: list<T['games'][number]>(t.games),
    record: record(t.record),
    champions: list<T['champions'][number]>(t.champions),
    pools: object<T['pools']>(t.pools),
  } as T & { record: Record30 }
}

/** `/pros` in its league view (`data`). */
export function leagueData<T extends Record<string, any>>(raw: T | null | undefined) {
  if (!raw || typeof raw !== 'object' || !raw.league) return null
  const counts = object<Partial<T['counts']>>(raw.counts)
  return {
    ...raw,
    teams: list<T['teams'][number]>(raw.teams),
    players: list<T['players'][number]>(raw.players).map((p) => ({
      ...p,
      champions: list(p.champions),
    })),
    counts: {
      teams: num(counts.teams),
      players: num(counts.players),
      accounts: num(counts.accounts),
    },
  } as T
}
