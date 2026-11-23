import db from '@adonisjs/lucid/services/db'
import accountService from '#services/accounts/account_service'
import { AccountError } from '#services/accounts/errors'
import type { Catalogue } from '#services/skins/skin_catalogue'
import type { CollectionSummary, DiaryEntry } from '../../../inertia/lib/skin_types.js'

/** At most this many skins in one read: more than the game has. */
export const MAX_COLLECTION = 5000
/** How far ahead of core's clock a read may claim to be (the app's clock may run fast). */
const CLOCK_SKEW_MS = 5 * 60_000
/** Riot's store opened in 2009: nothing was bought before. */
const FIRST_PURCHASE = Date.UTC(2009, 0, 1)

export interface CollectionRead {
  puuid: string
  skins: { id: number; purchasedAt: string | null }[]
  readAt: string
}

/** The person's League accounts that count: the ones they own and did not say are not theirs. */
const OWNED_ACCOUNTS = `SELECT puuid FROM invade_owned_account WHERE user_id = ? AND removed_at IS NULL`

/**
 * The skins people own, as the desktop app reads them from the League client
 * (docs/desktop-sync.md §13). Kept per League account; a person's collection is the union over
 * the accounts they own, so it follows an account that changes owner. "Owned" comes from here
 * only: nobody can say on the site that they own a skin.
 */
class CollectionService {
  /**
   * The newest read of a League account replaces its whole set. Only an account this device saw
   * signed in to the League client (a client link, §2.3) and that the connected person owns
   * (§10.3); an older read than the one stored changes nothing.
   */
  async replace(deviceId: string, read: CollectionRead) {
    const user = await accountService.deviceUser(deviceId)
    if (!user) throw AccountError.notConnected()
    const readAt = Date.parse(read.readAt)
    if (!Number.isFinite(readAt) || readAt > Date.now() + CLOCK_SKEW_MS) {
      throw AccountError.invalid('The read time is not valid.')
    }
    const skins = new Map<number, Date | null>()
    for (const skin of read.skins) {
      const bought = skin.purchasedAt === null ? null : Date.parse(skin.purchasedAt)
      if (
        bought !== null &&
        (!Number.isFinite(bought) || bought < FIRST_PURCHASE || bought > readAt + CLOCK_SKEW_MS)
      ) {
        throw AccountError.invalid('A purchase date is not valid.')
      }
      skins.set(skin.id, bought === null ? null : new Date(bought))
    }

    const proven = await db
      .from('desktop_device_account as l')
      .join('invade_owned_account as o', 'o.puuid', 'l.puuid')
      .where({ 'l.device_id': deviceId, 'l.puuid': read.puuid, 'l.source': 'lcu' })
      .where('o.user_id', user.id)
      .whereNull('o.removed_at')
      .first()
    if (!proven) throw AccountError.notDetected()

    await db.transaction(async (trx) => {
      const stored = await trx
        .from('invade_collection_read')
        .where('puuid', read.puuid)
        .forUpdate()
        .first()
      if (stored && new Date(stored.read_at).getTime() >= readAt) return
      await trx.from('invade_owned_skin').where('puuid', read.puuid).delete()
      const rows = [...skins].map(([id, purchasedAt]) => ({
        puuid: read.puuid,
        skin_id: id,
        purchased_at: purchasedAt,
      }))
      for (let i = 0; i < rows.length; i += 1000) {
        await trx.table('invade_owned_skin').multiInsert(rows.slice(i, i + 1000))
      }
      await trx
        .knexQuery()
        .table('invade_collection_read')
        .insert({
          puuid: read.puuid,
          device_id: deviceId,
          read_at: new Date(readAt),
          received_at: new Date(),
        })
        .onConflict('puuid')
        .merge(['device_id', 'read_at', 'received_at'])
    })
  }

  /** Every skin the person owns across their League accounts, with the earliest purchase date. */
  async owned(userId: string): Promise<Map<number, Date | null>> {
    const result = await db.rawQuery(
      `SELECT skin_id, min(purchased_at) AS purchased_at FROM invade_owned_skin
       WHERE puuid IN (${OWNED_ACCOUNTS}) GROUP BY skin_id`,
      [userId]
    )
    return new Map(
      result.rows.map((row: { skin_id: number; purchased_at: Date | null }) => [
        row.skin_id,
        row.purchased_at ? new Date(row.purchased_at) : null,
      ])
    )
  }

  /** Whether the app ever read a collection of the person's: "owned" is unknown before. */
  async lastRead(userId: string): Promise<Date | null> {
    const row = await db
      .from('invade_collection_read')
      .whereRaw(`puuid IN (${OWNED_ACCOUNTS})`, [userId])
      .max('read_at as at')
      .first()
    return row?.at ? new Date(row.at) : null
  }

  /** The count by Riot's rarity, out of the game's skins, as the profile's Skins tab draws it. */
  async summary(userId: string, catalogue: Catalogue): Promise<CollectionSummary | null> {
    const [owned, readAt] = await Promise.all([this.owned(userId), this.lastRead(userId)])
    if (!readAt) return null
    const byRarity: CollectionSummary['byRarity'] = {}
    let count = 0
    for (const skin of catalogue.pick(owned.keys())) {
      count++
      byRarity[skin.rarity] = (byRarity[skin.rarity] ?? 0) + 1
    }
    return { owned: count, total: catalogue.skins.size, byRarity, readAt: readAt.toISOString() }
  }

  /**
   * The purchases with a date, newest first, with what the person said of each: their stars, a
   * like, a review.
   */
  async diary(
    userId: string,
    catalogue: Catalogue,
    limit: number
  ): Promise<{ entries: DiaryEntry[]; total: number }> {
    const owned = await this.owned(userId)
    const bought = catalogue
      .pick(owned.keys())
      .flatMap((skin) => {
        const at = owned.get(skin.id)
        return at ? [{ skin, at }] : []
      })
      .sort((a, b) => b.at.getTime() - a.at.getTime())
    const shown = bought.slice(0, limit)
    const ids = shown.map((b) => b.skin.id)
    const [ratings, likes, reviews] = ids.length
      ? await Promise.all([
          db.from('invade_skin_rating').where('user_id', userId).whereIn('skin_id', ids),
          db.from('invade_skin_like').where('user_id', userId).whereIn('skin_id', ids),
          db.from('invade_skin_review').where('user_id', userId).whereIn('skin_id', ids),
        ])
      : [[], [], []]
    const rating = new Map(ratings.map((r) => [r.skin_id as number, r.rating as number]))
    const liked = new Set(likes.map((r) => r.skin_id as number))
    const reviewed = new Set(reviews.map((r) => r.skin_id as number))
    return {
      total: bought.length,
      entries: shown.map(({ skin, at }) => ({
        skin: {
          id: skin.id,
          championId: skin.championId,
          num: skin.num,
          name: skin.name,
          championName: skin.championName,
          rarity: skin.rarity,
          lines: skin.lines,
        },
        purchasedAt: at.toISOString(),
        rating: rating.get(skin.id) ?? null,
        liked: liked.has(skin.id),
        reviewed: reviewed.has(skin.id),
      })),
    }
  }
}

export default new CollectionService()
