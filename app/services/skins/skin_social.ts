import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { AccountError } from '#services/accounts/errors'
import type { SignedIn } from '#services/accounts/session_service'
import { PERSON_COLUMNS, PERSON_JOINS, personOf } from '#services/profiles/people'
import type { Catalogue } from '#services/skins/skin_catalogue'
import { cardOf } from '#services/skins/skin_ratings'
import { SKIN_LIMITS, type SkinListCard, type SkinReview } from '../../../inertia/lib/skin_types.js'

/**
 * What people say about skins: reviews and their likes, lists and theirs, and the marks one
 * leaves on a skin (half-star rating, like, wishlist). Every write is the signed-in person's own;
 * every skin is checked against the catalogue first.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const cleanText = (value: unknown, max: number, multiline: boolean) => {
  if (typeof value !== 'string') return null
  const text = multiline
    ? value
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    : value.replace(/\s+/g, ' ').trim()
  return text.length <= max ? text : null
}

/** The person's League accounts that count, for "owns it". */
const OWNS = (user: string, skin: string) => `EXISTS (
  SELECT 1 FROM invade_owned_skin os
  JOIN invade_owned_account oa ON oa.puuid = os.puuid AND oa.removed_at IS NULL
  WHERE os.skin_id = ${skin} AND oa.user_id = ${user}
)`

/* ── Reviews ─────────────────────────────────────────────────── */

const REVIEW_SELECT = `
  SELECT r.id, r.skin_id, r.body, r.created_at, r.user_id, rt.rating, ${PERSON_COLUMNS},
    ${OWNS('r.user_id', 'r.skin_id')} AS owns,
    (SELECT count(*)::int FROM invade_skin_review_like l WHERE l.review_id = r.id) AS likes,
    EXISTS (
      SELECT 1 FROM invade_skin_review_like l WHERE l.review_id = r.id AND l.user_id = ?
    ) AS liked
  FROM invade_skin_review r
  JOIN invade_user u ON u.id = r.user_id
  ${PERSON_JOINS}
  LEFT JOIN invade_skin_rating rt ON rt.user_id = r.user_id AND rt.skin_id = r.skin_id
`

export type ReviewOrder = 'popular' | 'recent'

export interface ReviewQuery {
  skinId?: number
  authors?: string[]
  since?: Date
  order: ReviewOrder
  limit: number
}

export async function reviews(
  catalogue: Catalogue,
  viewerId: string | null,
  query: ReviewQuery
): Promise<SkinReview[]> {
  const where: string[] = []
  const bindings: unknown[] = [viewerId]
  if (query.skinId !== undefined) {
    where.push('r.skin_id = ?')
    bindings.push(query.skinId)
  }
  if (query.authors) {
    if (!query.authors.length) return []
    where.push('r.user_id = ANY(?)')
    bindings.push(query.authors)
  }
  if (query.since) {
    where.push('r.created_at >= ?')
    bindings.push(query.since)
  }
  const order = query.order === 'popular' ? 'likes DESC, r.created_at DESC' : 'r.created_at DESC'
  const result = await db.rawQuery(
    `${REVIEW_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY ${order} LIMIT ${Math.trunc(query.limit)}`,
    bindings
  )
  return result.rows.flatMap((row: Record<string, any>) => {
    const skin = catalogue.get(row.skin_id)
    if (!skin) return []
    return [
      {
        id: row.id,
        skin: cardOf(skin),
        author: personOf(row),
        rating: row.rating ?? null,
        owns: row.owns,
        body: row.body,
        createdAt: new Date(row.created_at).toISOString(),
        likes: row.likes,
        liked: row.liked,
        mine: row.user_id === viewerId,
      },
    ]
  })
}

export async function countReviews(where: { skinId?: number; userId?: string }) {
  const query = db.from('invade_skin_review')
  if (where.skinId !== undefined) query.where('skin_id', where.skinId)
  if (where.userId) query.where('user_id', where.userId)
  const [{ total }] = await query.count('* as total')
  return Number(total)
}

/* ── Lists ───────────────────────────────────────────────────── */

const LIST_SELECT = `
  SELECT l.id, l.title, l.body, l.user_id, l.updated_at, ${PERSON_COLUMNS},
    (SELECT count(*)::int FROM invade_skin_list_item i WHERE i.list_id = l.id) AS count,
    (SELECT count(*)::int FROM invade_skin_list_like k WHERE k.list_id = l.id) AS likes,
    EXISTS (
      SELECT 1 FROM invade_skin_list_like k WHERE k.list_id = l.id AND k.user_id = ?
    ) AS liked,
    ARRAY(
      SELECT i.skin_id FROM invade_skin_list_item i WHERE i.list_id = l.id
      ORDER BY i.position LIMIT 5
    ) AS posters
  FROM invade_skin_list l
  JOIN invade_user u ON u.id = l.user_id
  ${PERSON_JOINS}
`

export interface ListQuery {
  ownerId?: string
  /** Lists holding this skin. */
  skinId?: number
  listId?: string
  order: 'popular' | 'recent'
  limit: number
}

export function listCardOf(catalogue: Catalogue, row: Record<string, any>): SkinListCard {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    owner: personOf(row),
    count: row.count,
    likes: row.likes,
    liked: row.liked,
    posters: catalogue.pick(row.posters as number[]).map(cardOf),
  }
}

export async function lists(viewerId: string | null, query: ListQuery) {
  const where: string[] = []
  const bindings: unknown[] = [viewerId]
  if (query.ownerId) {
    where.push('l.user_id = ?')
    bindings.push(query.ownerId)
  } else if (!query.listId) {
    // Among everyone's lists, an empty one says nothing.
    where.push('EXISTS (SELECT 1 FROM invade_skin_list_item i WHERE i.list_id = l.id)')
  }
  if (query.skinId !== undefined) {
    where.push(
      'EXISTS (SELECT 1 FROM invade_skin_list_item i WHERE i.list_id = l.id AND i.skin_id = ?)'
    )
    bindings.push(query.skinId)
  }
  if (query.listId) {
    where.push('l.id = ?')
    bindings.push(query.listId)
  }
  const order = query.order === 'popular' ? 'likes DESC, l.updated_at DESC' : 'l.updated_at DESC'
  const result = await db.rawQuery(
    `${LIST_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ${Math.trunc(query.limit)}`,
    bindings
  )
  return result.rows as Record<string, any>[]
}

export async function countListsWith(skinId: number) {
  const [{ total }] = await db
    .from('invade_skin_list_item as i')
    .where('i.skin_id', skinId)
    .countDistinct('i.list_id as total')
  return Number(total)
}

/** A list's skins in the owner's order. */
export async function listSkinIds(listId: string) {
  const rows = await db
    .from('invade_skin_list_item')
    .where('list_id', listId)
    .orderBy('position')
    .select('skin_id')
  return rows.map((r) => r.skin_id as number)
}

/* ── Writes ──────────────────────────────────────────────────── */

function knownSkin(catalogue: Catalogue, skinId: unknown) {
  const skin = typeof skinId === 'number' ? catalogue.get(skinId) : null
  if (!skin) throw AccountError.notFound('This skin is not in the game.')
  return skin
}

async function ownList(trx: TransactionClientContract, user: SignedIn, listId: unknown) {
  const list =
    typeof listId === 'string' && UUID.test(listId)
      ? await trx.from('invade_skin_list').where('id', listId).forUpdate().first()
      : null
  if (!list) throw AccountError.notFound('This list no longer exists.')
  if (list.user_id !== user.id) throw AccountError.notFound('This list no longer exists.')
  return list
}

/** Half stars, 1 to 10; null takes the rating back. */
export async function rate(catalogue: Catalogue, user: SignedIn, skinId: unknown, rating: unknown) {
  const skin = knownSkin(catalogue, skinId)
  if (rating === null) {
    await db.from('invade_skin_rating').where({ user_id: user.id, skin_id: skin.id }).delete()
    return
  }
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 10) {
    throw AccountError.invalid('Rate from half a star to five stars.')
  }
  await db
    .knexQuery()
    .table('invade_skin_rating')
    .insert({ user_id: user.id, skin_id: skin.id, rating, rated_at: new Date() })
    .onConflict(['user_id', 'skin_id'])
    .merge(['rating', 'rated_at'])
}

/** A like or a wish, on or off. The wishlist holds at most `SKIN_LIMITS.wishlist` skins. */
export async function mark(
  catalogue: Catalogue,
  user: SignedIn,
  kind: 'like' | 'wish',
  skinId: unknown,
  on: boolean
) {
  const skin = knownSkin(catalogue, skinId)
  const table = kind === 'like' ? 'invade_skin_like' : 'invade_skin_wish'
  if (!on) {
    await db.from(table).where({ user_id: user.id, skin_id: skin.id }).delete()
    return
  }
  await db.transaction(async (trx) => {
    await trx.from('invade_user').where('id', user.id).forUpdate().firstOrFail()
    if (kind === 'wish') {
      const [{ total }] = await trx.from(table).where('user_id', user.id).count('* as total')
      if (Number(total) >= SKIN_LIMITS.wishlist) {
        throw AccountError.limit(`Your wishlist holds up to ${SKIN_LIMITS.wishlist} skins.`)
      }
    }
    await trx
      .knexQuery()
      .table(table)
      .insert({ user_id: user.id, skin_id: skin.id })
      .onConflict(['user_id', 'skin_id'])
      .ignore()
  })
}

/** The person's review of a skin, written or rewritten; an empty one takes it back. */
export async function review(catalogue: Catalogue, user: SignedIn, skinId: unknown, body: unknown) {
  const skin = knownSkin(catalogue, skinId)
  // An emptied review arrives as null (the body parser's empty strings).
  const text = cleanText(body ?? '', SKIN_LIMITS.review, true)
  if (text === null) {
    throw AccountError.invalid(`Keep a review to ${SKIN_LIMITS.review} characters.`)
  }
  if (!text) {
    await db.from('invade_skin_review').where({ user_id: user.id, skin_id: skin.id }).delete()
    return null
  }
  const [row] = await db
    .knexQuery()
    .table('invade_skin_review')
    .insert({ user_id: user.id, skin_id: skin.id, body: text })
    .onConflict(['user_id', 'skin_id'])
    .merge({ body: text, updated_at: new Date() })
    .returning('id')
  return (row as { id: string }).id
}

/** A like on someone's review or list, on or off. */
export async function like(user: SignedIn, kind: 'review' | 'list', id: unknown, on: boolean) {
  const [table, likes, column] =
    kind === 'review'
      ? ['invade_skin_review', 'invade_skin_review_like', 'review_id']
      : ['invade_skin_list', 'invade_skin_list_like', 'list_id']
  const found =
    typeof id === 'string' && UUID.test(id) ? await db.from(table).where('id', id).first() : null
  if (!found) {
    throw AccountError.notFound(`This ${kind} no longer exists.`)
  }
  if (!on) {
    await db
      .from(likes)
      .where({ [column]: id, user_id: user.id })
      .delete()
    return
  }
  await db
    .knexQuery()
    .table(likes)
    .insert({ [column]: id, user_id: user.id })
    .onConflict([column, 'user_id'])
    .ignore()
}

/** A new list of the person's. */
export async function createList(user: SignedIn, input: { title: string; body?: string | null }) {
  const title = cleanText(input.title, SKIN_LIMITS.listTitle, false)
  const body = cleanText(input.body ?? '', SKIN_LIMITS.listBody, true)
  if (!title)
    throw AccountError.invalid(`Name the list in 1 to ${SKIN_LIMITS.listTitle} characters.`)
  if (body === null)
    throw AccountError.invalid(`Keep its description to ${SKIN_LIMITS.listBody} characters.`)
  return db.transaction(async (trx) => {
    await trx.from('invade_user').where('id', user.id).forUpdate().firstOrFail()
    const [{ total }] = await trx
      .from('invade_skin_list')
      .where('user_id', user.id)
      .count('* as total')
    if (Number(total) >= SKIN_LIMITS.lists) {
      throw AccountError.limit(`You can keep up to ${SKIN_LIMITS.lists} lists.`)
    }
    const [row] = await trx
      .table('invade_skin_list')
      .insert({ user_id: user.id, title, body })
      .returning('id')
    return (row as { id: string }).id
  })
}

export async function updateList(
  user: SignedIn,
  listId: unknown,
  input: { title: string; body?: string | null }
) {
  const title = cleanText(input.title, SKIN_LIMITS.listTitle, false)
  const body = cleanText(input.body ?? '', SKIN_LIMITS.listBody, true)
  if (!title)
    throw AccountError.invalid(`Name the list in 1 to ${SKIN_LIMITS.listTitle} characters.`)
  if (body === null)
    throw AccountError.invalid(`Keep its description to ${SKIN_LIMITS.listBody} characters.`)
  await db.transaction(async (trx) => {
    await ownList(trx, user, listId)
    await trx
      .from('invade_skin_list')
      .where('id', listId as string)
      .update({ title, body, updated_at: new Date() })
  })
}

export async function deleteList(user: SignedIn, listId: unknown) {
  await db.transaction(async (trx) => {
    await ownList(trx, user, listId)
    await trx
      .from('invade_skin_list')
      .where('id', listId as string)
      .delete()
  })
}

/** A skin into one of the person's lists (at its end) or out of it. */
export async function listSkin(
  catalogue: Catalogue,
  user: SignedIn,
  listId: unknown,
  skinId: unknown,
  on: boolean
) {
  const skin = knownSkin(catalogue, skinId)
  await db.transaction(async (trx) => {
    await ownList(trx, user, listId)
    const id = listId as string
    if (!on) {
      await trx.from('invade_skin_list_item').where({ list_id: id, skin_id: skin.id }).delete()
    } else {
      const items = await trx
        .from('invade_skin_list_item')
        .where('list_id', id)
        .select('skin_id', 'position')
      if (items.some((i) => i.skin_id === skin.id)) return
      if (items.length >= SKIN_LIMITS.listSkins) {
        throw AccountError.limit(`A list holds up to ${SKIN_LIMITS.listSkins} skins.`)
      }
      const position = items.reduce((max, i) => Math.max(max, i.position), 0) + 1
      await trx.table('invade_skin_list_item').insert({ list_id: id, skin_id: skin.id, position })
    }
    await trx.from('invade_skin_list').where('id', id).update({ updated_at: new Date() })
  })
}
