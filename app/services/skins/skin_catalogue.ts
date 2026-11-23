import logger from '@adonisjs/core/services/logger'
import riotAssets from '#services/riot/assets'
import { RARITY_GEMS } from '#constants/assets'
import type { SkinFacts, SkinRarity } from '../../../inertia/lib/skin_types.js'

/**
 * The game's skins, from Community Dragon's catalogue (`v1/skins.json`) of the live patch: names,
 * Riot's rarity, skin lines, chromas and descriptions. The file is fetched once per patch and
 * cached by the asset service (Redis); this module keeps the parsed index in memory and rebuilds
 * it when the patch changes. Base skins (a champion's own art) and the tiers of a skin that grows
 * in game are not skins one rates, owns or lists here.
 */

const FILE = 'v1/skins.json'
/** How often the live patch is asked again, i.e. how soon a new patch's skins appear. */
const REFRESH_MS = 10 * 60_000
/** Patches compared to tell the new skins: the live one and the two before it. */
const NEW_PATCHES = 3
/** A champion's skins have ids `champion * 1000 + n`; anything at or above is a tier variant. */
const MAX_SKIN_ID = 1_000_000

const RARITIES: Record<string, SkinRarity> = {
  kNoRarity: 'standard',
  kRare: 'rare',
  kEpic: 'epic',
  kLegendary: 'legendary',
  kMythic: 'mythic',
  kUltimate: 'ultimate',
  kTranscendent: 'transcendent',
  kExalted: 'exalted',
}
const HEX = /^#[0-9a-f]{6}$/i

/** A skin as the catalogue holds it, before champion and line names are joined in. */
interface RawSkin {
  id: number
  name: string
  rarity: SkinRarity
  legacy: boolean
  lines: number[]
  chromas: { name: string; colors: string[] }[]
  description: string | null
}

/** The fields of `v1/skins.json` the pages need, so only those are cached. */
export function parseSkins(raw: unknown): RawSkin[] | null {
  if (!raw || typeof raw !== 'object') return null
  const out: RawSkin[] = []
  for (const entry of Object.values(raw as Record<string, any>)) {
    const id = Number(entry?.id)
    if (!Number.isInteger(id) || id <= 0 || id >= MAX_SKIN_ID || entry.isBase) continue
    if (entry.skinClassification !== 'kChampion' || typeof entry.name !== 'string') continue
    const chromas = (Array.isArray(entry.chromas) ? entry.chromas : []).flatMap((c: any) =>
      typeof c?.name === 'string' && c.name
        ? [
            {
              name: c.name,
              colors: (Array.isArray(c.colors) ? c.colors : []).filter(
                (x: unknown): x is string => typeof x === 'string' && HEX.test(x)
              ),
            },
          ]
        : []
    )
    out.push({
      id,
      name: entry.name.trim(),
      rarity: RARITIES[entry.rarity] ?? 'standard',
      legacy: entry.isLegacy === true,
      lines: (Array.isArray(entry.skinLines) ? entry.skinLines : [])
        .map((l: any) => Number(l?.id))
        .filter((n: number) => Number.isInteger(n) && n > 0),
      chromas,
      description:
        typeof entry.description === 'string' && entry.description.trim()
          ? entry.description.trim()
          : null,
    })
  }
  return out.length ? out.sort((a, b) => a.id - b.id) : null
}

const parseIds = (raw: unknown) => parseSkins(raw)?.map((skin) => skin.id) ?? null

/** Lower case, accents and punctuation gone: how search compares names ("kda" finds K/DA). */
export const searchKey = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

export const hasGem = (rarity: SkinRarity) => (RARITY_GEMS as readonly string[]).includes(rarity)

/** One patch's index: every skin by id, by champion and by line, and which ones are new. */
export class Catalogue {
  readonly byChampion = new Map<number, SkinFacts[]>()
  readonly byLine = new Map<number, SkinFacts[]>()
  readonly #keys = new Map<number, string>()

  constructor(
    readonly patch: string,
    readonly skins: ReadonlyMap<number, SkinFacts>,
    readonly lines: ReadonlyMap<number, string>
  ) {
    for (const skin of skins.values()) {
      const champion = this.byChampion.get(skin.championId) ?? []
      champion.push(skin)
      this.byChampion.set(skin.championId, champion)
      for (const line of skin.lines) {
        const members = this.byLine.get(line.id) ?? []
        members.push(skin)
        this.byLine.set(line.id, members)
      }
      this.#keys.set(
        skin.id,
        searchKey([skin.name, skin.championName, ...skin.lines.map((line) => line.name)].join(' '))
      )
    }
  }

  get(id: number) {
    return this.skins.get(id) ?? null
  }

  /** The skins of `ids` the catalogue knows, in the order given. */
  pick(ids: Iterable<number>) {
    const out: SkinFacts[] = []
    for (const id of ids) {
      const skin = this.skins.get(id)
      if (skin) out.push(skin)
    }
    return out
  }

  /** The newest skins: those that arrived in the last patches, newest patch first. */
  newest() {
    return [...this.skins.values()]
      .filter((skin) => skin.newIn)
      .sort((a, b) => b.newIn!.localeCompare(a.newIn!, 'en', { numeric: true }) || b.id - a.id)
  }

  /** Skins whose name, champion or line holds every word of `query`, best match first. */
  search(query: string, limit: number) {
    const words = query.split(/\s+/).map(searchKey).filter(Boolean)
    if (!words.length) return []
    const whole = searchKey(query)
    const found: { skin: SkinFacts; score: number }[] = []
    for (const skin of this.skins.values()) {
      const key = this.#keys.get(skin.id)!
      if (!words.every((word) => key.includes(word))) continue
      const name = searchKey(skin.name)
      found.push({ skin, score: name === whole ? 0 : name.startsWith(whole) ? 1 : 2 })
    }
    return found
      .sort((a, b) => a.score - b.score || a.skin.name.localeCompare(b.skin.name))
      .slice(0, limit)
      .map((f) => f.skin)
  }
}

class SkinCatalogueService {
  #current: { at: number; value: Catalogue } | null = null
  #building: Promise<Catalogue | null> | null = null

  /** The live patch's catalogue; the last one built while game data is unreachable. */
  async get(): Promise<Catalogue> {
    if (this.#current && Date.now() - this.#current.at < REFRESH_MS) return this.#current.value
    this.#building ??= this.build().finally(() => (this.#building = null))
    const built = await this.#building
    if (built) this.#current = { at: Date.now(), value: built }
    else if (this.#current) this.#current = { ...this.#current, at: Date.now() - REFRESH_MS / 2 }
    return this.#current?.value ?? new Catalogue('', new Map(), new Map())
  }

  /**
   * Serves `catalogue` until the next patch check (null: forget it and build on the next read).
   * What a test uses to run without Community Dragon.
   */
  use(catalogue: Catalogue | null) {
    this.#current = catalogue ? { at: Date.now(), value: catalogue } : null
  }

  private async build(): Promise<Catalogue | null> {
    try {
      const live = await riotAssets.gameFile('skins:v1', FILE, parseSkins)
      if (!live) return null
      if (this.#current?.value.patch === live.patch) return this.#current.value
      const [champions, lines, introduced] = await Promise.all([
        riotAssets.names('champion'),
        riotAssets.skinLines(),
        this.introduced(
          live.patch,
          live.value.map((s) => s.id)
        ),
      ])
      const skins = new Map<number, SkinFacts>()
      for (const skin of live.value) {
        const championId = Math.floor(skin.id / 1000)
        skins.set(skin.id, {
          ...skin,
          championId,
          num: skin.id % 1000,
          championName: champions[String(championId)] ?? skin.name,
          lines: skin.lines.flatMap((id) => (lines[id] ? [{ id, name: lines[id] }] : [])),
          newIn: introduced.get(skin.id) ?? null,
        })
      }
      const names = new Map(Object.entries(lines).map(([id, name]) => [Number(id), name]))
      return new Catalogue(live.patch, skins, names)
    } catch (error) {
      logger.warn({ err: error }, 'skin catalogue unavailable')
      return null
    }
  }

  /** The patch each skin of the last patches arrived in, comparing each patch with the one before. */
  private async introduced(patch: string, ids: number[]) {
    const out = new Map<number, string>()
    const older = await Promise.all(
      Array.from({ length: NEW_PATCHES }, (_, i) =>
        riotAssets.gameFile('skin-ids:v1', FILE, parseIds, i + 1).catch(() => null)
      )
    )
    let newer = { patch, ids: new Set(ids) }
    for (const release of older) {
      // A patch Community Dragon does not hold yet stands in with another one: stop comparing.
      if (!release || release.patch === newer.patch) break
      const before = new Set(release.value)
      for (const id of newer.ids) if (!before.has(id) && !out.has(id)) out.set(id, newer.patch)
      newer = { patch: release.patch, ids: before }
    }
    return out
  }
}

export default new SkinCatalogueService()
