import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import rateLimiter from '#services/desktop/rate_limiter'
import replayGuard from '#services/desktop/signing'
import accountService from '#services/accounts/account_service'
import { accountOrigin } from '#services/accounts/session_service'
import matchRepository from '#services/analytics/match_repository'
import { loadProfileSocial } from '#services/social/profile_social'
import { DesktopSeed } from '#tests/fixtures/desktop_db'
import { AccountSeed, pageProps, site, type Person } from '#tests/fixtures/accounts'

/**
 * Follows, friends and saved items (docs/desktop-sync.md §10.2, §10.4): what can be followed, the
 * counts and lists around a person, friends as mutual follows, the Favorites of clips and
 * matches, and the limits.
 */
test.group('Follows and Favorites', (group) => {
  group.tap((t) => t.tags(['@accounts']))
  const prefixes = { limiter: rateLimiter.prefix, replay: replayGuard.prefix }
  let seed: DesktopSeed
  let accounts: AccountSeed
  let clips: string[] = []

  group.each.setup(() => {
    seed = new DesktopSeed()
    accounts = new AccountSeed(seed)
    clips = []
    rateLimiter.prefix = `desktop:rl:test:${randomUUID()}:`
    replayGuard.prefix = `desktop:sig:test:${randomUUID()}:`
  })
  group.each.teardown(async () => {
    rateLimiter.prefix = prefixes.limiter
    replayGuard.prefix = prefixes.replay
    if (clips.length) await db.from('invade_clip').whereIn('id', clips).delete()
    await accounts.cleanup()
    await seed.cleanup()
  })

  const follow = (person: Person, kind: string, id: string) =>
    accountService.change(person, [{ op: 'follow', kind, id } as never], 'site')

  /** A ready clip posted by `person` on a game of `puuid`. */
  async function clip(person: Person, puuid: string, visibility = 'everyone') {
    const id = randomUUID().replace(/-/g, '').slice(0, 10)
    clips.push(id)
    await db.table('invade_clip').insert({
      id,
      user_id: person.id,
      puuid,
      // One clip per game and account: each its own game.
      match_id: `EUW1_${clips.length}`,
      platform: 'EUW1',
      champion_id: 81,
      start_ms: 540_000,
      duration_ms: 21000,
      title: 'he really thought he had me',
      visibility,
      comments: 'everyone',
      status: 'ready',
    })
    return id
  }

  test('a person, a League account and a pro can be followed', async ({ assert }) => {
    const [me, briar] = [await accounts.person(), await accounts.person('Briar')]
    const player = await seed.player('EUW1', { game_name: 'Slow Comet', tag_line: 'EUW' })
    await accounts.owned(briar, player.puuid)
    const pro = await db.from('pro_player').orderBy('slug').first()

    await follow(me, 'user', briar.id)
    await follow(me, 'player', player.puuid)
    await follow(me, 'pro', pro.slug)
    // Following again is already done.
    const account = await follow(me, 'pro', pro.slug)

    assert.deepEqual(
      account.following.map((f) => [f.kind, f.id]),
      [
        ['pro', pro.slug],
        ['player', player.puuid],
        ['user', briar.id],
      ]
    )
    const person = account.following.find((f) => f.kind === 'user')!
    assert.equal(person.name, 'Briar')
    assert.equal(person.subtitle, 'Slow Comet#EUW')
    assert.equal(person.href, `/u/${briar.handle}`)
    const league = account.following.find((f) => f.kind === 'player')!
    assert.equal(league.name, 'Slow Comet')
    assert.equal(league.href, '/Slow%20Comet-EUW')
    assert.equal(account.following.find((f) => f.kind === 'pro')!.href, `/pro/${pro.slug}`)
    assert.equal(account.counts.following, 3)
  })

  test('nobody follows themselves or something that is not there', async ({ assert }) => {
    const me = await accounts.person()
    for (const [kind, id, message] of [
      ['user', me.id, /yourself/],
      ['user', randomUUID(), /not on Invade/],
      ['player', 'A'.repeat(78), /not on Invade/],
      ['pro', 'nobody-at-all-here', /not on Invade/],
      ['team', 'g2', /Unknown/],
      ['user', 'not-a-uuid', /Unknown/],
    ] as const) {
      try {
        await follow(me, kind, id)
        assert.fail(`${kind} ${id} was followed`)
      } catch (error) {
        assert.match((error as Error).message, message)
      }
    }
  })

  test('a hidden main account is never named in a follow', async ({ assert }) => {
    const [me, briar] = [await accounts.person(), await accounts.person('Briar')]
    const player = await seed.player()
    await accounts.owned(briar, player.puuid, { shown: false })
    const account = await follow(me, 'user', briar.id)
    assert.isNull(account.following[0].subtitle)
    assert.isNull(account.following[0].imageUrl)
  })

  test('friends follow each other', async ({ assert }) => {
    const [me, briar, copper] = [
      await accounts.person(),
      await accounts.person('Briar'),
      await accounts.person('Copper Lane'),
    ]
    await follow(me, 'user', briar.id)
    await follow(briar, 'user', me.id)
    await follow(copper, 'user', me.id)

    const mine = await accountService.snapshot(me)
    assert.deepEqual(mine.counts, { followers: 2, following: 1, friends: 1, saved: 0 })

    const social = await loadProfileSocial(copper.id, me.id)
    assert.equal(social.followers, 2)
    assert.equal(social.following, 1)
    assert.isTrue(social.viewerFollows)
    assert.isFalse(social.followsViewer)
    assert.deepEqual(
      social.friends.map((f) => [f.id, f.handle, f.isViewer]),
      [[briar.id, briar.handle, false]]
    )
    assert.deepEqual(social.playingNow, [])

    const seen = await loadProfileSocial(briar.id, me.id)
    assert.isTrue(seen.viewerFollows)
    assert.isTrue(seen.followsViewer)
    const own = await loadProfileSocial(me.id, me.id)
    assert.isFalse(own.viewerFollows)
  })

  test('a friend card shows the main account only when it is shown', async ({ assert }) => {
    const [me, briar] = [await accounts.person(), await accounts.person('Briar')]
    const player = await seed.player()
    await accounts.owned(briar, player.puuid, { shown: false })
    await follow(me, 'user', briar.id)
    await follow(briar, 'user', me.id)
    const hidden = await loadProfileSocial(null, me.id)
    assert.isNull(hidden.friends[0].main)
    assert.isNull(hidden.friends[0].avatarUrl)
    await accountService.change(briar, [{ op: 'show', puuid: player.puuid, shown: true }], 'site')
    const shown = await loadProfileSocial(null, me.id)
    assert.equal(shown.friends[0].main?.puuid, player.puuid)
  })

  test('the Follow button answers whether the visitor follows, and how many do', async ({
    client: http,
    assert,
  }) => {
    const [me, other] = [await accounts.person(), await accounts.person('Paper Moon')]
    const player = await seed.player()
    const path = `/api/follows/player/${player.puuid}`

    const anonymous = await http.put(path)
    anonymous.assertStatus(403)
    const signedOut = await http.put(path).header('Origin', accountOrigin())
    signedOut.assertStatus(401)

    const on = await site(http, me).put(path)
    on.assertStatus(200)
    assert.deepEqual(on.body(), { following: true, followers: 1 })
    const theirs = await site(http, other).put(path)
    theirs.assertStatus(200)
    const off = await site(http, me).delete(path)
    assert.deepEqual(off.body(), { following: false, followers: 1 })

    const unknown = await site(http, me).put(`/api/follows/player/${'Z'.repeat(78)}`)
    unknown.assertStatus(404)
  })

  test('a League account page tells the Follow button its state', async ({
    client: http,
    assert,
  }) => {
    const me = await accounts.person()
    // Its own Riot ID each run: the site keeps a Riot ID's PUUID in Redis between runs.
    const name = `Orchard ${randomUUID().slice(0, 6)}`
    const player = await seed.player('EUW1', { game_name: name, tag_line: 'EUW' })
    await follow(me, 'player', player.puuid)
    const url = `/${encodeURIComponent(name)}-EUW`
    const page = await site(http, me).get(url)
    page.assertStatus(200)
    assert.deepEqual(pageProps(page.text()).follow, { following: true, followers: 1 })
    const visitor = await http.get(url)
    assert.deepEqual(pageProps(visitor.text()).follow, { following: false, followers: 1 })
  })

  test('followers and following are lists a page at a time', async ({ client: http, assert }) => {
    const star = await accounts.person('Briar')
    const fans: Person[] = []
    for (let i = 0; i < 52; i++) fans.push(await accounts.person(`Fan ${i}`))
    for (const fan of fans) await follow(fan, 'user', star.id)
    await follow(star, 'user', fans[51].id)

    const first = await site(http, fans[0]).get(`/api/users/${star.handle}/followers`)
    first.assertStatus(200)
    assert.lengthOf(first.body().items, 50)
    // Newest first; the viewer follows the star, not the other fans.
    assert.equal(first.body().items[0].id, fans[51].id)
    assert.isFalse(first.body().items[0].viewerFollows)
    const next = await http.get(`/api/users/${star.handle}/followers?cursor=${first.body().cursor}`)
    assert.deepEqual(
      next.body().items.map((i: { id: string }) => i.id),
      [fans[1].id, fans[0].id]
    )
    assert.isNull(next.body().cursor)

    const following = await site(http, fans[51]).get(`/api/users/${star.handle}/following`)
    assert.deepEqual(
      following
        .body()
        .items.map((i: { id: string; viewerFollows: boolean }) => [i.id, i.viewerFollows]),
      [[fans[51].id, false]]
    )

    const page = await http.get(`/u/${star.handle}/followers`)
    page.assertStatus(200)
    assert.equal(pageProps(page.text()).counts.followers, 52)
    const noPage = await http.get('/u/nobody_here_at_all/followers')
    noPage.assertStatus(404)
    const noList = await http.get('/api/users/nobody_here_at_all/following')
    noList.assertStatus(404)
  })

  test('follows stop at their limit', async ({ assert }) => {
    const me = await accounts.person()
    await db.table('invade_follow').multiInsert(
      Array.from({ length: 2000 }, (_, i) => ({
        follower_id: me.id,
        target_kind: 'pro',
        target_id: `gone-${i}`,
      }))
    )
    const pro = await db.from('pro_player').orderBy('slug').first()
    try {
      await follow(me, 'pro', pro.slug)
      assert.fail('a follow past the limit was kept')
    } catch (error) {
      assert.match((error as Error).message, /up to 2,000/)
    }
  })

  test('the app follows and saves, a raw PUUID mapped through its alias', async ({
    client: http,
    assert,
  }) => {
    const me = await accounts.person()
    const { app } = await accounts.connected(http, me)
    const player = await seed.player()
    const raw = randomUUID()
    await db.table('riot_puuid_alias').insert({
      raw_puuid: raw,
      puuid: player.puuid,
      game_name: player.game_name,
      tag_line: player.tag_line,
      status: 'verified',
    })
    seed.raws.push(raw)
    const owner = await accounts.person('Briar')
    const id = await clip(owner, player.puuid)

    const response = await app.post('/api/desktop/account/changes', {
      ops: [
        { op: 'follow', kind: 'player', id: raw },
        { op: 'save', kind: 'clip', id },
      ],
    })
    response.assertStatus(200)
    assert.deepEqual(
      response.body().following.map((f: { id: string }) => f.id),
      [player.puuid]
    )
    assert.equal(response.body().counts.saved, 1)

    const undone = await app.post('/api/desktop/account/changes', {
      ops: [
        { op: 'unfollow', kind: 'player', id: player.puuid },
        { op: 'unsave', kind: 'clip', id },
        // Removing what is not there is already done.
        { op: 'unsave', kind: 'clip', id },
      ],
    })
    assert.lengthOf(undone.body().following, 0)
    assert.equal(undone.body().counts.saved, 0)
  })

  test('only a clip the person may watch can be saved', async ({ client: http, assert }) => {
    const [me, owner] = [await accounts.person(), await accounts.person('Briar')]
    const player = await seed.player()
    const open = await clip(owner, player.puuid)
    const link = await clip(owner, player.puuid, 'link')
    const hidden = await clip(owner, player.puuid, 'private')
    const mine = await clip(me, player.puuid, 'private')

    for (const id of [open, link, mine]) {
      const kept = await site(http, me).put(`/api/saved/clip/${id}`)
      kept.assertStatus(200)
    }
    const refusedSave = await site(http, me).put(`/api/saved/clip/${hidden}`)
    refusedSave.assertStatus(404)
    assert.equal(refusedSave.body().errors[0].code, 'E_ACCOUNT_NOT_FOUND')

    const keys = await site(http, me).get('/api/saved')
    assert.sameMembers(keys.body().clips, [open, link, mine])

    // A clip that turns private leaves the other people's Favorites lists.
    await db.from('invade_clip').where('id', link).update({ visibility: 'private' })
    const page = await site(http, me).get('/account')
    page.assertStatus(200)
    const saved = pageProps(page.text()).saved
    assert.sameMembers(
      saved.clips.map((c: { clip: { id: string } }) => c.clip.id),
      [open, mine]
    )
  })

  test('a saved match keeps whose game it was', async ({ client: http, assert }) => {
    const me = await accounts.person()
    const [recent] = await matchRepository.getRecent({ since: 0, queueIds: [420], limit: 1 })
    assert.exists(recent, 'the shared ClickHouse holds a ranked game')
    const side = recent.participants[3]
    const put = await site(http, me)
      .put(`/api/saved/match/${recent.matchId}`)
      .json({ puuid: side.puuid })
    put.assertStatus(200)
    const keys = await site(http, me).get('/api/saved')
    assert.deepEqual(keys.body().games, [recent.matchId.split('_')[1]])

    const page = await site(http, me).get('/account')
    const [match] = pageProps(page.text()).saved.matches
    assert.equal(match.match.matchId, recent.matchId)
    assert.equal(match.puuid, side.puuid)

    const unknown = await site(http, me).put('/api/saved/match/EUW1_1')
    unknown.assertStatus(404)
    const bad = await site(http, me).put('/api/saved/player/abc')
    bad.assertStatus(404)
  })

  test('saved items stop at their limit', async ({ assert }) => {
    const [me, owner] = [await accounts.person(), await accounts.person('Briar')]
    const player = await seed.player()
    const id = await clip(owner, player.puuid)
    await db.table('invade_saved').multiInsert(
      Array.from({ length: 1000 }, (_, i) => ({
        user_id: me.id,
        kind: 'match',
        target_id: `EUW1_${i + 10}`,
      }))
    )
    try {
      await accountService.change(me, [{ op: 'save', kind: 'clip', id }], 'site')
      assert.fail('a save past the limit was kept')
    } catch (error) {
      assert.match((error as Error).message, /up to 1,000/)
    }
  })

  test('the Favorites page is private', async ({ client: http, assert }) => {
    const anonymous = await http.get('/account').redirects(0)
    anonymous.assertStatus(302)
    assert.equal(anonymous.header('location'), '/signin?next=%2Faccount')
    const keys = await http.get('/api/saved')
    keys.assertStatus(401)
    const settings = await http.get('/account/settings').redirects(0)
    assert.equal(settings.header('location'), '/signin?next=%2Faccount%2Fsettings')
  })
})
