import db from '@adonisjs/lucid/services/db'
import type { SignedIn } from '#services/accounts/session_service'
import collectionService from '#services/skins/collection_service'
import skinCatalogue, { type Catalogue } from '#services/skins/skin_catalogue'
import {
  bestRated,
  cardOf,
  personRatings,
  placeAmongChampion,
  rated,
  skinRatings,
} from '#services/skins/skin_ratings'
import {
  countListsWith,
  countReviews,
  listCardOf,
  listSkinIds,
  lists,
  reviews,
} from '#services/skins/skin_social'
import {
  PERSON_COLUMNS,
  PERSON_JOINS,
  friendIds,
  loadPeople,
  personOf,
} from '#services/profiles/people'
import type {
  FriendSkinState,
  ProfileSkinsData,
  RatedSkin,
  SkinActivity,
  SkinListPage,
  SkinPageData,
  SkinsHubData,
  ViewerSkinState,
} from '../../../inertia/lib/skin_types.js'

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS

/** The signed-in visitor and one skin: owned, wished, liked, their stars, review and lists. */
async function viewerState(viewer: SignedIn, skinId: number): Promise<ViewerSkinState> {
  const [owned, read, wish, liked, rating, review, ownLists] = await Promise.all([
    collectionService.owned(viewer.id),
    collectionService.lastRead(viewer.id),
    db.from('invade_skin_wish').where({ user_id: viewer.id, skin_id: skinId }).first(),
    db.from('invade_skin_like').where({ user_id: viewer.id, skin_id: skinId }).first(),
    db.from('invade_skin_rating').where({ user_id: viewer.id, skin_id: skinId }).first(),
    db.from('invade_skin_review').where({ user_id: viewer.id, skin_id: skinId }).first(),
    db.rawQuery(
      `SELECT l.id, l.title, EXISTS (
         SELECT 1 FROM invade_skin_list_item i WHERE i.list_id = l.id AND i.skin_id = ?
       ) AS has
       FROM invade_skin_list l WHERE l.user_id = ? ORDER BY l.updated_at DESC`,
      [skinId, viewer.id]
    ),
  ])
  return {
    owned: read ? owned.has(skinId) : null,
    wishedAt: wish ? new Date(wish.created_at).toISOString() : null,
    liked: Boolean(liked),
    rating: rating?.rating ?? null,
    review: review ? { id: review.id, body: review.body } : null,
    lists: ownLists.rows.map((l: { id: string; title: string; has: boolean }) => ({
      id: l.id,
      title: l.title,
      has: l.has,
    })),
  }
}

/** What each of the viewer's friends did with a skin: owns it, rated it, wishes for it. */
async function friendsOn(skinId: number, friends: string[]): Promise<FriendSkinState[]> {
  if (!friends.length) return []
  const result = await db.rawQuery(
    `SELECT ${PERSON_COLUMNS}, rt.rating,
       EXISTS (
         SELECT 1 FROM invade_owned_skin os
         JOIN invade_owned_account oa ON oa.puuid = os.puuid AND oa.removed_at IS NULL
         WHERE os.skin_id = ? AND oa.user_id = u.id
       ) AS owns,
       w.user_id IS NOT NULL AS wished
     FROM invade_user u ${PERSON_JOINS}
     LEFT JOIN invade_skin_rating rt ON rt.user_id = u.id AND rt.skin_id = ?
     LEFT JOIN invade_skin_wish w ON w.user_id = u.id AND w.skin_id = ?
     WHERE u.id = ANY(?)`,
    [skinId, skinId, skinId, friends]
  )
  return result.rows
    .map((row: Record<string, any>) => ({
      person: personOf(row),
      owns: row.owns,
      rating: row.rating ?? null,
      wished: row.wished,
    }))
    .filter((f: FriendSkinState) => f.owns || f.rating !== null || f.wished)
    .sort(
      (a: FriendSkinState, b: FriendSkinState) =>
        Number(b.owns) - Number(a.owns) || (b.rating ?? 0) - (a.rating ?? 0)
    )
    .slice(0, 6)
}

/** `rated` skins first, then the rest of `pool` (newest first) until `limit`. */
function fill(best: RatedSkin[], pool: RatedSkin[], limit: number) {
  const out = [...best]
  for (const skin of pool) {
    if (out.length >= limit) break
    if (!out.some((s) => s.id === skin.id)) out.push(skin)
  }
  return out.slice(0, limit)
}

/** A skin's page (`/skins/<id>`); null for an id the game does not have. */
export async function skinPage(id: number, viewer: SignedIn | null): Promise<SkinPageData | null> {
  const catalogue = await skinCatalogue.get()
  const skin = catalogue.get(id)
  if (!skin) return null
  const friends = viewer ? await friendIds(viewer.id) : []
  const line = skin.lines[0] ?? null
  const lineSkins = line
    ? (catalogue.byLine.get(line.id) ?? []).filter((s) => s.id !== skin.id)
    : []
  const championSkins = [...(catalogue.byChampion.get(skin.championId) ?? [])].reverse()
  const [
    ratings,
    place,
    viewerSkin,
    popular,
    recent,
    fromFriends,
    total,
    friendStates,
    lineBest,
    lineAll,
    listRows,
    listsTotal,
    championBest,
    championAll,
  ] = await Promise.all([
    skinRatings(id),
    placeAmongChampion(catalogue, skin),
    viewer ? viewerState(viewer, id) : null,
    reviews(catalogue, viewer?.id ?? null, { skinId: id, order: 'popular', limit: 4 }),
    reviews(catalogue, viewer?.id ?? null, { skinId: id, order: 'recent', limit: 4 }),
    reviews(catalogue, viewer?.id ?? null, {
      skinId: id,
      authors: friends,
      order: 'recent',
      limit: 4,
    }),
    countReviews({ skinId: id }),
    friendsOn(id, friends),
    bestRated(
      catalogue,
      4,
      lineSkins.map((s) => s.id)
    ),
    rated(lineSkins.slice(0, 4)),
    lists(viewer?.id ?? null, { skinId: id, order: 'popular', limit: 2 }),
    countListsWith(id),
    bestRated(
      catalogue,
      8,
      championSkins.map((s) => s.id)
    ),
    rated(championSkins.slice(0, 8)),
  ])
  return {
    skin,
    ratings,
    place,
    viewer: viewerSkin,
    reviews: { popular, recent, friends: fromFriends, total },
    friends: friendStates,
    line: line ? { id: line.id, name: line.name, skins: fill(lineBest, lineAll, 4) } : null,
    lists: listRows.map((row) => listCardOf(catalogue, row)),
    listsTotal,
    champion: {
      name: skin.championName,
      total: championSkins.length,
      best: fill(championBest, championAll, 8),
    },
  }
}

/** The friends' week on skins: what they rated, reviewed and wished for, newest first. */
async function activity(catalogue: Catalogue, friends: string[]): Promise<SkinActivity[]> {
  if (!friends.length) return []
  const since = new Date(Date.now() - WEEK_MS)
  const result = await db.rawQuery(
    `SELECT * FROM (
       SELECT 'reviewed' AS kind, r.user_id, r.skin_id, r.created_at AS at FROM invade_skin_review r
       WHERE r.user_id = ANY(?) AND r.created_at >= ?
       UNION ALL
       SELECT 'rated', t.user_id, t.skin_id, t.rated_at FROM invade_skin_rating t
       WHERE t.user_id = ANY(?) AND t.rated_at >= ?
         AND NOT EXISTS (
           SELECT 1 FROM invade_skin_review r WHERE r.user_id = t.user_id AND r.skin_id = t.skin_id
             AND r.created_at >= ?
         )
       UNION ALL
       SELECT 'wished', w.user_id, w.skin_id, w.created_at FROM invade_skin_wish w
       WHERE w.user_id = ANY(?) AND w.created_at >= ?
     ) a ORDER BY at DESC LIMIT 6`,
    [friends, since, friends, since, since, friends, since]
  )
  const rows = result.rows as {
    kind: SkinActivity['kind']
    user_id: string
    skin_id: number
    at: Date
  }[]
  if (!rows.length) return []
  const byId = await loadPeople(rows.map((r) => r.user_id))
  const ratings = await db
    .from('invade_skin_rating')
    .whereIn('user_id', [...byId.keys()])
    .whereIn(
      'skin_id',
      rows.map((r) => r.skin_id)
    )
  return rows.flatMap((row) => {
    const skin = catalogue.get(row.skin_id)
    const person = byId.get(row.user_id)
    if (!skin || !person) return []
    const rating =
      ratings.find((r) => r.user_id === row.user_id && r.skin_id === row.skin_id)?.rating ?? null
    return [
      { person, kind: row.kind, skin: cardOf(skin), rating, at: new Date(row.at).toISOString() },
    ]
  })
}

/** The most rated skins of the week, then of all time, then the newest: always a full row. */
async function popularThisWeek(catalogue: Catalogue, limit: number) {
  const result = await db.rawQuery(
    `SELECT skin_id, count(*) FILTER (WHERE rated_at >= ?)::int AS week, count(*)::int AS ever
     FROM invade_skin_rating GROUP BY skin_id
     ORDER BY week DESC, ever DESC LIMIT ?`,
    [new Date(Date.now() - WEEK_MS), limit * 2]
  )
  const picked = catalogue.pick(result.rows.map((r: { skin_id: number }) => r.skin_id))
  for (const skin of [...catalogue.newest(), ...[...catalogue.skins.values()].reverse()]) {
    if (picked.length >= limit) break
    if (!picked.includes(skin)) picked.push(skin)
  }
  return rated(picked.slice(0, limit))
}

/** The skins hub (`/skins`). */
export async function hub(viewer: SignedIn | null): Promise<SkinsHubData> {
  const catalogue = await skinCatalogue.get()
  const now = Date.now()
  const friends = viewer ? await friendIds(viewer.id) : []
  const [popular, weekReviews, friendsWeek, listRows, topRated] = await Promise.all([
    popularThisWeek(catalogue, 7),
    reviews(catalogue, viewer?.id ?? null, {
      since: new Date(now - WEEK_MS),
      order: 'popular',
      limit: 4,
    }),
    activity(catalogue, friends),
    lists(viewer?.id ?? null, { order: 'popular', limit: 3 }),
    bestRated(catalogue, 8),
  ])
  return {
    popular,
    week: { from: new Date(now - 6 * DAY_MS).toISOString(), to: new Date(now).toISOString() },
    reviews: weekReviews,
    activity: friendsWeek,
    newest: catalogue
      .newest()
      .slice(0, 6)
      .map((skin) => ({ ...cardOf(skin), newIn: skin.newIn! })),
    lists: listRows.map((row) => listCardOf(catalogue, row)),
    topRated,
    total: catalogue.skins.size,
  }
}

/** The skins that match a search, with their ratings, for the hub's results. */
export async function searchSkins(query: string) {
  const catalogue = await skinCatalogue.get()
  return rated(catalogue.search(query, 48))
}

/** A list opened (`/skins/lists/<id>`); null when it does not exist. */
export async function listPage(id: string, viewer: SignedIn | null): Promise<SkinListPage | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const catalogue = await skinCatalogue.get()
  const [row] = await lists(viewer?.id ?? null, {
    listId: id,
    order: 'recent',
    limit: 1,
  })
  if (!row) return null
  return {
    ...listCardOf(catalogue, row),
    skins: await rated(catalogue.pick(await listSkinIds(id))),
    mine: row.user_id === viewer?.id,
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

/** The favourite four, in the owner's order, each with the owner's own stars. */
export async function favoriteSkins(
  userId: string,
  favorites: number[]
): Promise<ProfileSkinsData['favorites']> {
  if (!favorites.length) return []
  const [catalogue, ratings] = await Promise.all([
    skinCatalogue.get(),
    db.from('invade_skin_rating').where('user_id', userId).whereIn('skin_id', favorites),
  ])
  return catalogue.pick(favorites).map((skin) => ({
    ...cardOf(skin),
    rating: ratings.find((r) => r.skin_id === skin.id)?.rating ?? null,
  }))
}

/** The profile's Skins tab. `favorites`: the owner's favourite four, in their order. */
export async function profileSkins(
  userId: string,
  viewerId: string | null,
  favorites: number[]
): Promise<ProfileSkinsData> {
  const catalogue = await skinCatalogue.get()
  const [fav, diary, ownReviews, reviewsTotal, collection, ratings, wishRows, listRows] =
    await Promise.all([
      favoriteSkins(userId, favorites),
      collectionService.diary(userId, catalogue, 8),
      reviews(catalogue, viewerId, { authors: [userId], order: 'recent', limit: 3 }),
      countReviews({ userId }),
      collectionService.summary(userId, catalogue),
      personRatings(userId),
      db.from('invade_skin_wish').where('user_id', userId).orderBy('created_at', 'desc'),
      lists(viewerId, { ownerId: userId, order: 'recent', limit: 4 }),
    ])
  const wished = catalogue.pick(wishRows.map((w) => w.skin_id as number))
  return {
    favorites: fav,
    diary: diary.entries,
    diaryTotal: diary.total,
    reviews: ownReviews,
    reviewsTotal,
    collection,
    ratings,
    wishlist: wished.slice(0, 6).map(cardOf),
    wishlistTotal: wished.length,
    lists: listRows.map((row) => listCardOf(catalogue, row)),
  }
}
