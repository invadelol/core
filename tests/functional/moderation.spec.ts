import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ApiClient } from '@japa/api-client'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import rateLimiter from '#services/desktop/rate_limiter'
import replayGuard from '#services/desktop/signing'
import riotAssets from '#services/riot/assets'
import matchRepository from '#services/analytics/match_repository'
import clipService from '#services/clips/clip_service'
import { loadProfileClips } from '#services/clips/profile_clips'
import { notificationsOf } from '#services/clips/notifications'
import { LocalClipStore, clipKey, clipStore, useClipStore } from '#services/clips/storage'
import moderation from '#services/moderation/moderation'
import { REPORTS_PER_HOUR } from '#services/moderation/reports'
import { purgeRemoved } from '#services/moderation/sweep'
import profileService from '#services/profiles/profile_service'
import skinCatalogue from '#services/skins/skin_catalogue'
import { lists, reviews } from '#services/skins/skin_social'
import buildsService from '#services/builds/builds_service'
import followService from '#services/social/follows'
import savedService from '#services/social/saved'
import { DesktopSeed } from '#tests/fixtures/desktop_db'
import { AccountSeed, pageProps, site, type Person } from '#tests/fixtures/accounts'
import { storedClip } from '#tests/fixtures/clips'
import { TeamDecisions, moderationSchema } from '#tests/fixtures/moderation'
import { SKINS, fakeCatalogue } from '#tests/fixtures/profiles'

const MATCH = 'EUW1_7000000101'

/**
 * Moderation end to end: reports on clips and comments from the clip page, and what the team
 * decides in its dashboard (the admin's views): a suspended account is signed out and refused,
 * its profile and everything it posted disappear and come back when the suspension is lifted;
 * Founder and Team badges; clips and comments taken down, hidden at once and deleted a week
 * later. The game lookups are stood in for.
 */
test.group('Moderation', (group) => {
  group.tap((t) => t.tags(['@moderation']))
  const stand = {
    limiter: rateLimiter.prefix,
    replay: replayGuard.prefix,
    fetch: globalThis.fetch,
    names: riotAssets.names,
    summary: matchRepository.getSummaryById,
    findGame: clipService.findGame,
  }
  let seed: DesktopSeed
  let accounts: AccountSeed
  let team: TeamDecisions
  let dir: string

  group.setup(moderationSchema)
  group.each.setup(async () => {
    seed = new DesktopSeed()
    accounts = new AccountSeed(seed)
    team = new TeamDecisions()
    rateLimiter.prefix = `desktop:rl:test:${randomUUID()}:`
    replayGuard.prefix = `desktop:sig:test:${randomUUID()}:`
    dir = await mkdtemp(join(tmpdir(), 'moderation-'))
    useClipStore(new LocalClipStore(dir))
    skinCatalogue.use(fakeCatalogue())
    riotAssets.names = (async () => ({ 81: 'Ezreal' })) as never
    matchRepository.getSummaryById = (async () => ({ matchId: MATCH, participants: [] })) as never
  })
  group.each.teardown(async () => {
    rateLimiter.prefix = stand.limiter
    replayGuard.prefix = stand.replay
    globalThis.fetch = stand.fetch
    riotAssets.names = stand.names
    matchRepository.getSummaryById = stand.summary
    clipService.findGame = stand.findGame
    skinCatalogue.use(null)
    useClipStore(null)
    await team.cleanup()
    await accounts.cleanup()
    await seed.cleanup()
    await rm(dir, { recursive: true, force: true })
  })

  /** Ember, who posted a clip of a game she played, and the clip. */
  async function emberWithClip(overrides: Record<string, unknown> = {}) {
    const ember = await accounts.person('Ember')
    const player = await seed.player()
    await accounts.owned(ember, player.puuid)
    const clip = await storedClip(ember, player.puuid, { match_id: MATCH, ...overrides })
    return { ember, player, clip }
  }

  async function comment(
    http: ApiClient,
    person: Person,
    clip: string,
    body: string,
    parentId?: string
  ) {
    const response = await site(http, person)
      .post(`/api/clips/${clip}/comments`)
      .json({ body, parentId })
    response.assertStatus(200)
    const all = response.body().comments.flatMap((c: any) => [c, ...c.replies])
    return all.find((c: { body: string }) => c.body === body).id as string
  }

  const report = (http: ApiClient, person: Person, path: string, body: object) =>
    site(http, person).post(`/api/clips/${path}/report`).json(body)

  /** A site write that must go through: a GG, a follow, a save. */
  async function done(request: PromiseLike<{ assertStatus(code: number): void }>) {
    const response = await request
    response.assertStatus(200)
  }

  /** Who told a person something (§12), newest first, and what they said. */
  const told = (person: Person) => notificationsOf(person.id).then((answer) => answer.items)
  /** How many clips a person keeps in their Favorites list. */
  const savedClips = (person: Person) => savedService.list(person.id).then((s) => s.clips.length)

  /** The clip page as a visitor sees it: its status, and its props when it renders. */
  async function clipPage(http: ApiClient, clip: string, viewer?: Person) {
    const response = viewer
      ? await site(http, viewer).get(`/clip/${clip}`)
      : await http.get(`/clip/${clip}`)
    return response.status() === 200 ? pageProps(response.text()) : null
  }

  /* ── Reports ──────────────────────────────────────────────────────── */

  test('a person reports a clip and a comment, once each', async ({ client: http, assert }) => {
    const { ember, clip } = await emberWithClip()
    const briar = await accounts.person('Briar')
    const copper = await accounts.person('Copper Lane')
    const said = await comment(http, briar, clip, 'uninstall the game')

    const first = await report(http, copper, clip, { reason: 'spam' })
    first.assertStatus(201)
    const again = await report(http, copper, clip, { reason: 'harassment' })
    again.assertStatus(409)
    assert.equal(again.body().errors[0].code, 'E_REPORT_EXISTS')
    const onComment = await report(http, copper, `${clip}/comments/${said}`, {
      reason: 'harassment',
      note: '  tells   people to\nuninstall  ',
    })
    onComment.assertStatus(201)

    const rows = await db
      .from('invade_report')
      .where('reporter_id', copper.id)
      .orderBy('target_kind')
    assert.deepEqual(
      rows.map((r) => [
        r.target_kind,
        r.target_id,
        r.clip_id,
        r.author_id,
        r.excerpt,
        r.reason,
        r.note,
      ]),
      [
        ['clip', clip, clip, ember.id, 'the flash was not ready', 'spam', null],
        [
          'comment',
          said,
          clip,
          briar.id,
          'uninstall the game',
          'harassment',
          'tells people to uninstall',
        ],
      ]
    )
  })

  test('a report is refused on one’s own content, without a reason, signed out or cross-site', async ({
    client: http,
    assert,
  }) => {
    const { ember, clip } = await emberWithClip()
    const briar = await accounts.person('Briar')
    const said = await comment(http, briar, clip, 'clean')
    const own = await report(http, ember, clip, { reason: 'spam' })
    own.assertStatus(403)
    assert.equal(own.body().errors[0].code, 'E_REPORT_OWN')
    const ownComment = await report(http, briar, `${clip}/comments/${said}`, { reason: 'spam' })
    ownComment.assertStatus(403)
    assert.equal(ownComment.body().errors[0].code, 'E_REPORT_OWN')

    for (const bad of [{}, { reason: 'boring' }, { reason: 'spam', note: 'x'.repeat(281) }]) {
      const refused = await report(http, briar, clip, bad)
      refused.assertStatus(422)
      assert.equal(refused.body().errors[0].code, 'E_ACCOUNT_INVALID')
    }
    const gone = await report(http, ember, `${clip}/comments/${randomUUID()}`, { reason: 'spam' })
    gone.assertStatus(404)

    const signedOut = await http
      .post(`/api/clips/${clip}/report`)
      .header('Origin', env.get('ACCOUNT_ORIGIN') ?? '')
      .json({ reason: 'spam' })
    signedOut.assertStatus(401)
    const crossSite = await http
      .post(`/api/clips/${clip}/report`)
      .withCookie('invade_session', briar.token)
      .header('Origin', 'https://elsewhere.example')
      .json({ reason: 'spam' })
    crossSite.assertStatus(403)
    assert.equal(crossSite.body().errors[0].code, 'E_ORIGIN')

    // Someone else's Only me clip cannot be seen, so it cannot be reported.
    const other = await seed.player()
    const hidden = await storedClip(ember, other.puuid, {
      match_id: 'EUW1_7000000105',
      visibility: 'private',
    })
    const unseen = await report(http, briar, hidden, { reason: 'spam' })
    unseen.assertStatus(404)
    assert.lengthOf(await db.from('invade_report').where('reporter_id', briar.id), 0)
  })

  test('reports are limited per person and hour', async ({ client: http, assert }) => {
    const { clip } = await emberWithClip()
    const briar = await accounts.person('Briar')
    const answers: number[] = []
    for (let i = 0; i <= REPORTS_PER_HOUR; i++) {
      const response = await report(http, briar, clip, { reason: 'spam' })
      answers.push(response.status())
    }
    assert.deepEqual(answers, [201, ...Array(REPORTS_PER_HOUR - 1).fill(409), 429])
  })

  /* ── Suspended accounts ───────────────────────────────────────────── */

  test('a suspended person is signed out and refused at sign-in until it is lifted', async ({
    client: http,
    assert,
  }) => {
    const ember = await accounts.person('Ember')
    const signedIn = await site(http, ember).get('/api/account')
    signedIn.assertStatus(200)

    await team.ban(ember.id)
    const out = await site(http, ember).get('/api/account')
    out.assertStatus(401)
    assert.equal(out.body().errors[0].code, 'E_SIGNED_OUT')

    const { subject } = await db.from('invade_identity').where('user_id', ember.id).first()
    globalThis.fetch = (async (url: string | URL) =>
      String(url).includes('token')
        ? new Response(JSON.stringify({ access_token: 'token' }), { status: 200 })
        : new Response(JSON.stringify({ id: subject, global_name: 'Ember' }), {
            status: 200,
          })) as typeof fetch
    const saved = { id: env.get('DISCORD_CLIENT_ID'), secret: env.get('DISCORD_CLIENT_SECRET') }
    env.set('DISCORD_CLIENT_ID', saved.id || 'test-client')
    env.set('DISCORD_CLIENT_SECRET', saved.secret || 'test-secret')
    try {
      const start = await http.get('/auth/discord?next=/account').redirects(0)
      const state = new URL(start.header('location')!).searchParams.get('state')
      const back = await http
        .get(`/auth/discord/callback?code=abc&state=${state}`)
        .withEncryptedCookie('invade_oauth', start.cookie('invade_oauth')?.value)
        .redirects(0)
      back.assertStatus(302)
      assert.equal(back.header('location'), '/signin?error=suspended')
      assert.notExists(back.cookie('invade_session')?.value)
    } finally {
      env.set('DISCORD_CLIENT_ID', saved.id ?? '')
      env.set('DISCORD_CLIENT_SECRET', saved.secret ?? '')
    }
    const page = await http.get('/signin?error=suspended')
    page.assertStatus(200)
    assert.equal(pageProps(page.text()).error, 'suspended')

    await team.lift(ember.id)
    const back = await site(http, ember).get('/api/account')
    back.assertStatus(200)
  })

  test('a suspended person’s profile, clips and comments are gone everywhere, and come back', async ({
    client: http,
    assert,
  }) => {
    const { ember, clip } = await emberWithClip()
    const briar = await accounts.person('Briar')
    const copper = await accounts.person('Copper Lane')
    const briarPlayer = await seed.player()
    const briarClip = await storedClip(briar, briarPlayer.puuid)
    const said = await comment(http, ember, briarClip, 'lucky')
    await comment(http, copper, briarClip, 'not luck', said)
    await comment(http, copper, briarClip, 'clean shot')
    await done(site(http, ember).put(`/api/clips/${briarClip}/gg`))
    await done(site(http, ember).put(`/api/follows/user/${briar.id}`))
    await done(site(http, briar).put(`/api/saved/clip/${clip}`))

    await team.ban(ember.id)
    for (const path of [
      `/u/${ember.handle}`,
      `/u/${ember.handle}/followers`,
      `/api/users/${ember.handle}/following`,
      `/clip/${clip}`,
      `/clips/${clip}.mp4`,
      `/og/clip/${clip}.jpg`,
    ]) {
      const response = await http.get(path).redirects(0)
      assert.equal(response.status(), 404, path)
    }
    const listed = await http.get(`/api/clips?match=${MATCH}`)
    assert.deepEqual(
      listed.body().clips.map((c: { id: string }) => c.id),
      [briarClip]
    )

    // Her comment goes with its replies; the rest of the conversation stays.
    const page = await clipPage(http, briarClip)
    assert.deepEqual(
      page!.comments.map((c: { body: string }) => c.body),
      ['clean shot']
    )
    assert.equal(page!.clip.commentCount, 1)
    const items = await told(briar)
    assert.notInclude(
      items.map((i) => i.actor.handle),
      ember.handle
    )
    const followers = await followService.followers('user', briar.id, null, { limit: 50 })
    assert.lengthOf(followers.items, 0)
    const counts = await followService.counts(briar.id)
    assert.equal(counts.followers, 0)
    assert.equal(await savedClips(briar), 0)

    await team.lift(ember.id)
    assert.isNotNull(await clipPage(http, clip))
    const restored = await clipPage(http, briarClip)
    assert.equal(restored!.clip.commentCount, 3)
    const again = await told(briar)
    assert.include(
      again.map((i) => i.actor.handle),
      ember.handle
    )
    const profile = await http.get(`/u/${ember.handle}`)
    profile.assertStatus(200)
  })

  test('a suspended person’s skin reviews, lists and shared builds are not shown', async ({
    assert,
  }) => {
    const ember = await accounts.person('Ember')
    const briar = await accounts.person('Briar')
    await db.table('invade_skin_review').insert({
      user_id: ember.id,
      skin_id: SKINS.kdaAhri,
      body: 'the best K/DA',
    })
    const [list] = await db
      .table('invade_skin_list')
      .insert({ user_id: ember.id, title: 'Ahri, ranked' })
      .returning('id')
    await db
      .table('invade_skin_list_item')
      .insert({ list_id: list.id, skin_id: SKINS.kdaAhri, position: 0 })
    await db.table('invade_build').insert({
      id: 'tModBuild1',
      user_id: ember.id,
      local_id: randomUUID(),
      champion_id: 103,
      lane: 'mid',
      code: 'x',
      shared: true,
      updated_at: new Date(),
    })
    await db.table('invade_build_saved').insert({ user_id: briar.id, build_id: 'tModBuild1' })
    const catalogue = await skinCatalogue.get()
    const shown = async () => {
      const [onSkin, owned, saved] = await Promise.all([
        reviews(catalogue, null, { skinId: SKINS.kdaAhri, order: 'recent', limit: 50 }),
        lists(null, { ownerId: ember.id, order: 'recent', limit: 4 }),
        buildsService.ofAccount(briar.id),
      ])
      return {
        reviews: onSkin.filter((r) => r.author.id === ember.id).length,
        lists: owned.length,
        builds: saved.length,
      }
    }
    assert.deepEqual(await shown(), { reviews: 1, lists: 1, builds: 1 })
    await team.ban(ember.id)
    assert.deepEqual(await shown(), { reviews: 0, lists: 0, builds: 0 })
  })

  test('a suspended person’s desktop app is refused with its own code', async ({
    client: http,
    assert,
  }) => {
    const ember = await accounts.person('Ember')
    const { app } = await accounts.connected(http, ember)
    await team.ban(ember.id)
    for (const [method, path] of [
      ['get', '/api/desktop/account'],
      ['get', '/api/desktop/clips'],
      ['get', '/api/desktop/notifications'],
      ['get', '/api/desktop/builds'],
    ] as const) {
      const response = await app[method](path)
      response.assertStatus(403)
      assert.equal(response.body().errors[0].code, 'E_ACCOUNT_SUSPENDED', path)
    }
    const changes = await app.post('/api/desktop/account/changes', {
      ops: [{ op: 'follow', kind: 'pro', id: 'faker' }],
    })
    changes.assertStatus(403)
    assert.equal(changes.body().errors[0].code, 'E_ACCOUNT_SUSPENDED')
    // The app can still leave the account.
    const leave = await app.delete('/api/desktop/account')
    leave.assertStatus(204)
    const after = await app.get('/api/desktop/account')
    after.assertStatus(200)
    assert.isNull(after.body().user)
  })

  test('without the team’s views (no migration, no grant) nothing is hidden and all works', async ({
    client: http,
    assert,
  }) => {
    const { ember, clip } = await emberWithClip()
    await team.ban(ember.id)
    await team.remove({ kind: 'clip', id: clip, clipId: clip, authorId: ember.id })
    const views = ['active_ban', 'active_tag', 'removed_content']
    for (const view of views) await db.rawQuery(`ALTER VIEW admin.${view} RENAME TO ${view}_off`)
    moderation.refresh()
    try {
      const account = await site(http, ember).get('/api/account')
      account.assertStatus(200)
      const profile = await http.get(`/u/${ember.handle}`)
      profile.assertStatus(200)
      assert.isNotNull(await clipPage(http, clip))
    } finally {
      for (const view of views) await db.rawQuery(`ALTER VIEW admin.${view}_off RENAME TO ${view}`)
      moderation.refresh()
    }
    assert.isNull(await clipPage(http, clip))
  })

  /* ── Tags ─────────────────────────────────────────────────────────── */

  test('Founder and Team show as badges on the profile, before Invade+', async ({
    client: http,
    assert,
  }) => {
    const ember = await accounts.person('Ember')
    await team.tag(ember.id, 'team')
    await team.tag(ember.id, 'founder')
    await db
      .table('admin.entitlement')
      .insert({ kind: 'premium', user_id: ember.id, label: 'test' })
    try {
      const page = await profileService.page(ember.handle, 'overview', null)
      assert.deepEqual(page!.head.badges, [
        { kind: 'founder', label: 'Founder' },
        { kind: 'team', label: 'Invade team' },
        { kind: 'plus', label: 'Invade+' },
      ])
      const rendered = await http.get(`/u/${ember.handle}`)
      rendered.assertStatus(200)
      assert.lengthOf(pageProps(rendered.text()).head.badges, 3)

      await db
        .from('admin.account_tag')
        .where('user_id', ember.id)
        .update({ removed_at: new Date() })
      const untagged = await profileService.page(ember.handle, 'overview', null)
      assert.deepEqual(
        untagged!.head.badges.map((b) => b.kind),
        ['plus']
      )
    } finally {
      await db.from('admin.entitlement').where('user_id', ember.id).delete()
    }
  })

  /* ── Content taken down ───────────────────────────────────────────── */

  test('a clip taken down is hidden at once, comes back when restored, and its game takes a new clip', async ({
    client: http,
    assert,
  }) => {
    const { ember, player, clip } = await emberWithClip()
    const briar = await accounts.person('Briar')
    await done(site(http, briar).put(`/api/saved/clip/${clip}`))
    const target = { kind: 'clip' as const, id: clip, clipId: clip, authorId: ember.id }

    await team.remove(target)
    assert.isNull(await clipPage(http, clip))
    assert.isNull(await clipPage(http, clip, ember))
    const listed = await http.get(`/api/clips?match=${MATCH}`)
    assert.lengthOf(listed.body().clips, 0)
    const profile = await loadProfileClips(ember.id, ember.id)
    assert.lengthOf(profile.clips, 0)
    assert.lengthOf(await clipService.mine(ember), 0)
    assert.equal(await savedClips(briar), 0)

    await team.restore('clip', clip)
    assert.isNotNull(await clipPage(http, clip))
    assert.lengthOf(await clipService.mine(ember), 1)

    // Taken down again: posting another clip of that game needs no replace, and the old one goes.
    await team.remove(target)
    const { app } = await accounts.connected(http, ember)
    clipService.findGame = async () => ({
      matchId: MATCH,
      puuid: player.puuid,
      championId: 81,
      platform: 'EUW1',
    })
    const posted = await app.post('/api/desktop/clips', {
      matchId: MATCH,
      gameStartedAt: 1_791_873_000_000,
      championId: 81,
      title: 'a better one',
      clipStartMs: 600_000,
      durationMs: 20_000,
    })
    posted.assertStatus(201)
    assert.isNull(await db.from('invade_clip').where('id', clip).first())
    assert.isNull(await clipStore().head(clipKey(clip, 'video'), 1))
  })

  test('a comment taken down is hidden with its replies', async ({ client: http, assert }) => {
    const { ember, clip } = await emberWithClip()
    const briar = await accounts.person('Briar')
    const copper = await accounts.person('Copper Lane')
    const said = await comment(http, briar, clip, 'trash player')
    await comment(http, copper, clip, 'agreed', said)
    await comment(http, copper, clip, 'great flash')

    await team.remove({ kind: 'comment', id: said, clipId: clip, authorId: briar.id })
    const page = await clipPage(http, clip)
    assert.deepEqual(
      page!.comments.map((c: { body: string }) => c.body),
      ['great flash']
    )
    assert.equal(page!.clip.commentCount, 1)
    const toEmber = await told(ember)
    assert.deepEqual(
      toEmber.map((i) => i.text),
      ['great flash']
    )
    assert.lengthOf(await told(briar), 0)
    // What is hidden cannot be answered, GG'd or reported.
    const reply = await site(http, ember)
      .post(`/api/clips/${clip}/comments`)
      .json({ body: 'bye', parentId: said })
    reply.assertStatus(404)
    const gg = await site(http, ember).put(`/api/clips/${clip}/comments/${said}/gg`)
    gg.assertStatus(404)
    const reported = await report(http, ember, `${clip}/comments/${said}`, { reason: 'spam' })
    reported.assertStatus(404)

    await team.restore('comment', said)
    const back = await clipPage(http, clip)
    assert.equal(back!.clip.commentCount, 3)
  })

  test('what was taken down is deleted for good a week later, unless restored', async ({
    client: http,
    assert,
  }) => {
    const { ember, player } = await emberWithClip()
    const briar = await accounts.person('Briar')
    const old = await storedClip(ember, player.puuid, { match_id: 'EUW1_7000000102' })
    const recent = await storedClip(ember, player.puuid, { match_id: 'EUW1_7000000103' })
    const restored = await storedClip(ember, player.puuid, { match_id: 'EUW1_7000000104' })
    const said = await comment(http, briar, recent, 'ruined')
    const answer = await comment(http, ember, recent, 'no u', said)
    const clipOf = (id: string) => ({ kind: 'clip' as const, id, clipId: id, authorId: ember.id })
    await team.remove(clipOf(old), 8)
    await team.remove(clipOf(recent), 2)
    await team.remove(clipOf(restored), 8)
    await team.restore('clip', restored)
    await team.remove({ kind: 'comment', id: said, clipId: recent, authorId: briar.id }, 8)

    assert.deepEqual(await purgeRemoved(), { clips: 1, comments: 1 })
    const left = await db.from('invade_clip').whereIn('id', [old, recent, restored]).select('id')
    assert.sameMembers(
      left.map((r) => r.id),
      [recent, restored]
    )
    assert.isNull(await clipStore().head(clipKey(old, 'video'), 1))
    assert.isNull(await clipStore().head(clipKey(old, 'poster'), 1))
    assert.isNotNull(await clipStore().head(clipKey(recent, 'video'), 1))
    // The comment went with its reply.
    const comments = await db.from('invade_clip_comment').whereIn('id', [said, answer])
    assert.lengthOf(comments, 0)
    // Nothing is left to delete.
    assert.deepEqual(await purgeRemoved(), { clips: 0, comments: 0 })
  })
})
