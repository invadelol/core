import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import sessionService from '#services/accounts/session_service'
import { Catalogue } from '#services/skins/skin_catalogue'
import type { SkinFacts, SkinRarity } from '../../inertia/lib/skin_types.js'

/**
 * A small catalogue, so the skins code runs without the network: two lines, five champions, the
 * rarities the pages draw. Its ids are the game's shape (`champion * 1000 + n`) on champion ids
 * no real champion has, so nothing a test writes meets anything already in the database.
 */
export const SKINS = {
  firestarterAhri: 990097,
  kdaAhri: 990015,
  spiritBlossomAhri: 990027,
  faerieCourtEzreal: 991033,
  psyopsEzreal: 991022,
  kdaKaisa: 992014,
  darkCosmicJhin: 993005,
  firestarterEvelynn: 994065,
} as const

const LINES = new Map([
  [91, 'K/DA'],
  [130, 'Faerie Court'],
])

function skin(
  id: number,
  name: string,
  championName: string,
  rarity: SkinRarity,
  line?: number
): SkinFacts {
  return {
    id,
    championId: Math.floor(id / 1000),
    num: id % 1000,
    name,
    championName,
    rarity,
    legacy: false,
    lines: line ? [{ id: line, name: LINES.get(line)! }] : [],
    chromas: [],
    description: null,
    newIn: null,
  }
}

export function fakeCatalogue() {
  const skins = [
    skin(SKINS.firestarterAhri, 'K/DA FIRESTARTER Ahri', 'Ahri', 'epic', 91),
    skin(SKINS.kdaAhri, 'K/DA Ahri', 'Ahri', 'epic', 91),
    skin(SKINS.spiritBlossomAhri, 'Spirit Blossom Ahri', 'Ahri', 'legendary'),
    skin(SKINS.faerieCourtEzreal, 'Faerie Court Ezreal', 'Ezreal', 'epic', 130),
    skin(SKINS.psyopsEzreal, 'PsyOps Ezreal', 'Ezreal', 'epic'),
    skin(SKINS.kdaKaisa, "K/DA Kai'Sa", "Kai'Sa", 'epic', 91),
    skin(SKINS.darkCosmicJhin, 'Dark Cosmic Jhin', 'Jhin', 'legendary'),
    skin(SKINS.firestarterEvelynn, 'K/DA FIRESTARTER Evelynn', 'Evelynn', 'legendary', 91),
  ]
  return new Catalogue('16.23', new Map(skins.map((s) => [s.id, s])), LINES)
}

/** Awaits a request and checks its status: `await expectStatus(client.get('/skins'), 200)`. */
export async function expectStatus<T extends { assertStatus(code: number): void }>(
  request: PromiseLike<T>,
  code: number
) {
  const response = await request
  response.assertStatus(code)
  return response
}

export interface Person {
  id: string
  name: string
  handle: string
  token: string
}

/** People with handles and sessions, removed (and everything of theirs) after each test. */
export class ProfileSeed {
  users: string[] = []
  pros: string[] = []

  async person(name = 'Ember'): Promise<Person> {
    const { userId } = await sessionService.signIn('discord', randomUUID(), name, null)
    const handle = `t${randomUUID().replaceAll('-', '').slice(0, 12)}`
    await db.from('invade_user').where('id', userId).update({ handle })
    this.users.push(userId)
    return { id: userId, name, handle, token: await sessionService.create(userId) }
  }

  /** A League account the person owns (as a connected app proved it), shown or not. */
  async own(person: Person, puuid: string, options: { shown?: boolean; main?: boolean } = {}) {
    await db.table('invade_owned_account').insert({
      puuid,
      user_id: person.id,
      shown: options.shown ?? true,
    })
    if (options.main ?? true) {
      await db.from('invade_user').where('id', person.id).update({ main_puuid: puuid })
    }
  }

  /** Follows each way between two people: they are friends. */
  async befriend(a: Person, b: Person) {
    await db.table('invade_follow').multiInsert([
      { follower_id: a.id, target_kind: 'user', target_id: b.id },
      { follower_id: b.id, target_kind: 'user', target_id: a.id },
    ])
  }

  /** A pro in the pro data, with one ranked account. */
  async pro(name = 'Testpro') {
    const id = randomUUID()
    const slug = `t-${id.slice(0, 8)}`
    await db.table('pro_player').insert({ id, slug, name, role: 'MID', country: 'DK' })
    await db.table('pro_account').insert({
      id: randomUUID(),
      player_id: id,
      platform: 'EUW1',
      game_name: `${name} Main`,
      tag_line: 'EUW',
      tier: 'MASTER',
      lp: 420,
      wins: 30,
      losses: 20,
    })
    this.pros.push(id)
    return { id, slug, name }
  }

  async cleanup() {
    if (this.users.length) await db.from('invade_user').whereIn('id', this.users).delete()
    if (this.pros.length) await db.from('pro_player').whereIn('id', this.pros).delete()
  }
}
