/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { RENDERER as OG_RENDERER } from '#services/og/version'
import AutoSwaggerModule from 'adonis-autoswagger'

type SwaggerInstance = typeof AutoSwaggerModule extends { default: infer T }
  ? T
  : typeof AutoSwaggerModule
const AutoSwagger = ((AutoSwaggerModule as unknown as { default?: unknown }).default ??
  AutoSwaggerModule) as SwaggerInstance

import swagger from '#config/swagger'
import { middleware } from '#start/middleware'
import { ANALYTICS_PANELS, analyticsUrls } from '#constants/analytics'
import type { HttpContext } from '@adonisjs/core/http'
import { BUGS_URL, DISCORD_URL, X_URL } from '../inertia/lib/links.js'
import { FORMATS, cardImagePath, parseCard } from '../inertia/lib/share_card.js'

const SummonersController = () => import('#controllers/summoners_controller')
const HealthChecksController = () => import('#controllers/health_checks_controller')
const MatchesController = () => import('#controllers/matches_controller')
const PlayerInsightsController = () => import('#controllers/player_insights_controller')
const AssetsController = () => import('#controllers/assets_controller')
const DownloadsController = () => import('#controllers/downloads_controller')
const AppPageController = () => import('#controllers/app_page_controller')
const DesktopController = () => import('#controllers/desktop_controller')
const HomeController = () => import('#controllers/home_controller')
const LensController = () => import('#controllers/lens_controller')
const RuneStatsController = () => import('#controllers/rune_stats_controller')
const BuildStatsController = () => import('#controllers/build_stats_controller')
const SpellStatsController = () => import('#controllers/spell_stats_controller')
const ChampionStatisticsController = () => import('#controllers/champion_statistics_controller')
const MatchupStatsController = () => import('#controllers/matchup_stats_controller')
const TierListStatsController = () => import('#controllers/tier_list_stats_controller')
const PickStatsController = () => import('#controllers/pick_stats_controller')
const SynergyController = () => import('#controllers/synergy_controller')
const LegalController = () => import('#controllers/legal_controller')
const ContactController = () => import('#controllers/contact_controller')
const PatchNotesController = () => import('#controllers/patch_notes_controller')
const ChangelogController = () => import('#controllers/changelog_controller')
const MultisearchController = () => import('#controllers/multisearch_controller')
const ChampionsController = () => import('#controllers/champions_controller')
const ProsController = () => import('#controllers/pros_controller')
const StatsController = () => import('#controllers/stats_controller')
const LobbyGamesController = () => import('#controllers/lobby_games_controller')
const TierListsController = () => import('#controllers/tier_lists_controller')

// API routes group
router
  .group(() => {
    router.get('/summoners/search', [SummonersController, 'search'])
    /** Pros and teams whose name starts with `q`, for the site's search. */
    router.get('/pros/search', [ProsController, 'search'])
    /** One stored game's ten players, for a pro's recent games. */
    router.get('/pros/games/:matchId', [ProsController, 'board'])
    router.post('/summoners/sync', [SummonersController, 'sync'])
    /**
     * Summoner spells from our own ranked games, for any champion in any role. Before the
     * player routes: a numeric champion and a role never name a platform and a player.
     */
    router
      .get('/summoners/:champion/:role', [SpellStatsController, 'show'])
      .where('champion', /^\d+$/)
      .where('role', /^(top|jungle|mid|middle|adc|bottom|support|utility)$/i)
    router.get('/summoners/:summoner', [SummonersController, 'show'])
    router.get('/summoners/:platform/:summoner', [SummonersController, 'show'])

    router.get('/summoners/puuid/:puuid/mastery', [PlayerInsightsController, 'mastery'])

    // PUUID-based routes
    router
      .get('/summoners/puuid/:puuid/activity', [SummonersController, 'activity'])
      .use(middleware.httpCache())

    router
      .get('/summoners/puuid/:puuid/friends', [SummonersController, 'friends'])
      .use(middleware.httpCache())

    router
      .get('/summoners/puuid/:puuid/synergy', [SynergyController, 'report'])
      .use(middleware.httpCache())

    router
      .get('/summoners/puuid/:puuid/synergy/:mate', [SynergyController, 'together'])
      .use(middleware.httpCache())

    router
      .get('/summoners/puuid/:puuid/ranks', [SummonersController, 'ranks'])
      .use(middleware.httpCache())

    router
      .get('/summoners/puuid/:puuid/stats', [SummonersController, 'stats'])
      .use(middleware.httpCache())

    router
      .get('/summoners/puuid/:puuid/champions', [SummonersController, 'champions'])
      .use(middleware.httpCache())

    router
      .get('/summoners/puuid/:puuid/builds/:champion', [SummonersController, 'build'])
      .where('champion', /^\d+$/)
      .use(middleware.httpCache())

    router
      .get('/summoners/puuid/:puuid/season', [SummonersController, 'season'])
      .use(middleware.httpCache())

    router
      .get('/summoners/puuid/:puuid/matches', [SummonersController, 'matches'])
      .use(middleware.httpCache())

    router.get('/summoners/puuid/:puuid/lens', [LensController, 'show']).use(middleware.httpCache())

    router.get('/matches/:id', [MatchesController, 'show']).use(middleware.httpCache())

    /** Rune pages from our own ranked games, for any champion in any role. */
    router.get('/runes/:champion/:role', [RuneStatsController, 'show'])

    /** Item builds from our own ranked games, for any champion in any role. */
    router.get('/builds/:champion/:role', [BuildStatsController, 'show'])

    /** Lane matchups from our own ranked games, for any champion in any role and any stored patch. */
    router.get('/matchups/:champion/:role', [MatchupStatsController, 'show'])

    /** The tier list from our own ranked games, for any stored patch, bracket and region. */
    router.get('/tier-list', [TierListStatsController, 'show'])

    /** Everything counted for a champion in a role, for the desktop app's statistics page. */
    router.get('/statistics/:champion/:role', [ChampionStatisticsController, 'show'])

    /** Rune pages, builds and summoner spells of a pick, several brackets in one request. */
    router.get('/picks/:champion/:role', [PickStatsController, 'show'])

    router.put('/summoners/puuid/:puuid/increment', [SummonersController, 'incrementViews'])

    /** The stored games of a lobby's players, for the desktop app's scouting: no Riot request. */
    router.post('/lobby/games', [LobbyGamesController, 'show'])

    router.get('/health', [HealthChecksController, 'handle'])

    /** The desktop app's onboarding, match uploads, player snapshots and crash reports (docs/desktop-sync.md). */
    router
      .group(() => {
        router.get('/config', [DesktopController, 'config'])
        router.post('/devices', [DesktopController, 'register'])
        router.delete('/devices/me', [DesktopController, 'revoke']).use(middleware.desktopAuth())
        router.post('/link', [DesktopController, 'link']).use(middleware.desktopAuth())
        router.delete('/link/:puuid', [DesktopController, 'unlink']).use(middleware.desktopAuth())
        router
          .get('/resolve', [DesktopController, 'resolve'])
          .use(middleware.desktopAuth({ optional: true }))
        router.post('/matches', [DesktopController, 'upload']).use(middleware.desktopAuth())
        router.post('/matches/known', [DesktopController, 'known']).use(middleware.desktopAuth())
        router.post('/players', [DesktopController, 'players']).use(middleware.desktopAuth())
        router.post('/crashes', [DesktopController, 'crashes']).use(middleware.desktopAuth())
      })
      .prefix('/desktop')
  })
  .prefix('/api')

/** A team's logo from our own origin, before the game art below takes `/cdn/:kind/:id`. */
router.get('/cdn/team/:id', [ProsController, 'logo'])
/** A league's logo (`resources/leagues`), before the game art below takes `/cdn/:kind/:id`. */
router.get('/cdn/league/:slug', [ProsController, 'leagueLogo'])
/** A pro's photo, fetched and resized server-side, before the game art below takes `/cdn/...`. */
router.get('/cdn/pro/:slug', [ProsController, 'photo'])

/**
 * Riot game art, proxied and mirrored so the site and the desktop app never
 * talk to Riot's CDNs directly (docs/cdn.md). `/:patch/:kind/:id` pins a patch
 * and is immutable; `/:kind/:id` follows the live one. Registered before the
 * summoner catch-all below.
 */
router
  .group(() => {
    router.get('/names/:kind', [AssetsController, 'names'])
    router.get('/skins/:champion', [AssetsController, 'skins'])
    router.get('/:patch/:kind/:id', [AssetsController, 'show'])
    router.get('/:kind/:id', [AssetsController, 'show'])
  })
  .prefix('/cdn')

/** Desktop app installers, before the summoner catch-all below. */
router.get('/download/:platform', [DownloadsController, 'show'])

/** The desktop app's landing page, before the summoner catch-all below. */
router.get('/app', [AppPageController, 'show']).use(middleware.httpCache({ page: true }))

/** The desktop app's release notes, all of them or opened at one version (`v0.3.2` leads to `0.3.2`). */
router.get('/app/changelog', [ChangelogController, 'index'])
router.get('/app/changelog/:version', [ChangelogController, 'show'])

/** Champion statistics, before the summoner catch-all below. */
router.get('/champions', [ChampionsController, 'index'])
/** One lane matchup, two champions side by side (`?role=` as on a champion's page). */
router.get('/champions/:slug/matchups/:opponent', [ChampionsController, 'matchup'])
router
  .get('/champions/:slug/:tab?', [ChampionsController, 'show'])
  .where('tab', /^(build|runes|items|matchups|statistics|pros)$/)
router.get('/tier-list', [ChampionsController, 'tierList'])
/** The other tier lists: items, runes, duos and ARAM. */
router.get('/tier-list/items', [TierListsController, 'items'])
router.get('/tier-list/runes', [TierListsController, 'runes'])
router.get('/tier-list/duos', [TierListsController, 'duos'])
router.get('/tier-list/aram', [TierListsController, 'aram'])
/** Every champion of a role in one table, and its views (`?view=early`). */
router.get('/stats', [StatsController, 'index'])

/** Professional players and teams, before the summoner catch-all below. */
router.get('/pros', [ProsController, 'index'])
router.get('/leagues', [ProsController, 'leagues'])
router.get('/league/:slug', [ProsController, 'league'])
router.get('/teams', [ProsController, 'teams'])
router.get('/pro/:slug', [ProsController, 'show'])
router.get('/team/:slug', [ProsController, 'team'])

/** The ranked leaderboards and the esports overview, before the summoner catch-all below. */
const LeaderboardsController = () => import('#controllers/leaderboards_controller')
const EsportsController = () => import('#controllers/esports_controller')
router.get('/leaderboards', ({ response }) => response.redirect('/leaderboards/solo', false, 302))
router.get('/leaderboards/solo', [LeaderboardsController, 'solo'])
router.get('/leaderboards/flex', [LeaderboardsController, 'flex'])
router.get('/leaderboards/one-tricks', [LeaderboardsController, 'oneTricks'])
router.get('/leaderboards/pros', [LeaderboardsController, 'pros'])
router.get('/api/leaderboards/solo/place', [LeaderboardsController, 'place'])
router.get('/esports', [EsportsController, 'index'])
/** The live game page is gone: its old address leads home. */
router.get('/live', ({ response }) => response.redirect('/', false, 302))

/** Several players scouted side by side (a lobby), before the summoner catch-all below. */
router.get('/multisearch/:region?', [MultisearchController, 'show'])

/** A patch's notes (`/patch/26.22`), the newest at `/patch`, before the summoner catch-all below. */
router.get('/patch', [PatchNotesController, 'latest'])
router.get('/patch/:version', [PatchNotesController, 'show'])

/** The privacy policy, the legal notice and its terms, before the summoner catch-all below. */
router.get('/privacy', [LegalController, 'privacy'])
router.get('/legal', [LegalController, 'legal'])
router.get('/terms', ({ response }) => response.redirect('/legal#terms', false, 302))

/** The ways to reach the team, before the summoner catch-all below. */
router.get('/contact', [ContactController, 'show'])

/** The community server, before the summoner catch-all below. */
router.get('/discord', ({ response }) => response.redirect(DISCORD_URL, false, 302))

/** The X account, before the summoner catch-all below. */
router.get('/x', ({ response }) => response.redirect(X_URL, false, 302))

/** The desktop app's "Report a bug" button, so its target can change without an app release. */
router.get('/bugs', ({ response }) => response.redirect(BUGS_URL, false, 302))

router.get('/swagger', async () => {
  return AutoSwagger.docs(router.toJSON(), swagger)
})

router.get('/docs', async () => {
  return AutoSwagger.ui('/swagger', swagger)
})

/** The share cards of the site's pages (`site_card`), before a profile's `/og/:summoner`. */
const SiteCardsController = () => import('#controllers/site_cards_controller')
/** The multisearch page's link preview: the lobby's seats, `/og/multisearch.jpg?summoners=…`. */
router.get('/og/multisearch.jpg', [MultisearchController, 'card'])
router.get('/og/home.jpg', [SiteCardsController, 'home'])
router.get('/og/champion/:slug/:file', [SiteCardsController, 'champion'])
router.get('/og/tier-list/:file', [SiteCardsController, 'tierList'])
router.get('/og/stats/:file', [SiteCardsController, 'stats'])
router.get('/og/pros/:file', [SiteCardsController, 'pros'])
router.get('/og/pro/:file', [SiteCardsController, 'pro'])
router.get('/og/team/:file', [SiteCardsController, 'team'])
router.get('/og/mastery/:file', [SiteCardsController, 'mastery'])
router.get('/og/leaderboards/:file', [SiteCardsController, 'leaderboard'])
router.get('/og/esports.jpg', [SiteCardsController, 'esports'])
router.get('/og/patch/:file', [SiteCardsController, 'patch'])
router.get('/og/app.jpg', [SiteCardsController, 'app'])

router.get('/og/:summoner', [() => import('#controllers/social_cards_controller'), 'show'])
/** A profile's share card, drawn from its link: `/card/Name-Tag/stats-wide.png?q=…&n=…&l=…`. */
router.get('/card/:summoner/:design', [() => import('#controllers/share_cards_controller'), 'show'])

/** The match page's og:image, one player's game: `/og/match/:matchId/Name-Tag.jpg`. */
router.get('/og/match/:matchId/:file', [
  () => import('#controllers/match_cards_controller'),
  'show',
])

/** The link preview of one version of the desktop app: `/og/app/changelog/0.3.2.jpg`. */
router.get('/og/app/changelog/:file', [
  () => import('#controllers/changelog_cards_controller'),
  'show',
])

/** A build shared from the desktop app, and its link preview (`build_link`). */
router.get('/desktop/build/:version/:champion/:role/:groups', [
  () => import('#controllers/shared_builds_controller'),
  'show',
])
router.get('/og/build/:version/:champion/:role/:file', [
  () => import('#controllers/shared_builds_controller'),
  'image',
])

/** The desktop app's Discord presence picture; its badge is the static `/presence/invade.png`. */
router.get('/presence/:file', [() => import('#controllers/presence_cards_controller'), 'show'])

router.get('/sitemap.xml', [() => import('#controllers/sitemaps_controller'), 'index'])

router.get('/', [HomeController, 'show']).use(middleware.httpCache({ page: true }))

/** What the header's menus show beside their links: the tier list's picks and the top pros. */
router.get('/api/site/nav', [HomeController, 'nav'])

/** The site's search as an address (`?q=`), before the summoner catch-all below. */
router.get('/search', [HomeController, 'search'])

router.get('/:summoner/match/:matchId', async ({ inertia, params }) => {
  const { default: matchShareService } = await import('#services/match_share_service')
  // Link previews read the meta tags without running the page: the game's result, its share
  // card and its canonical address, for a stored game the player was in. Otherwise the page
  // keeps no social tags, as before.
  const share = await matchShareService.find(params.matchId, params.summoner).catch(() => null)
  return inertia.render('match', {
    summoner: params.summoner,
    matchId: params.matchId,
    social: share?.social ?? null,
  })
})

router.get('/:summoner/:section?', async ({ inertia, params, request, response }) => {
  const section = params.section ?? 'overview'
  if (section === 'history')
    return response.redirect(`/${encodeURIComponent(params.summoner)}/matches`)
  // The live game page is gone; links to it (the desktop app's Discord presence) open the profile.
  if (section === 'live')
    return response.redirect(`/${encodeURIComponent(params.summoner)}`, true, 302)
  if (
    !['overview', 'matches', 'lens', 'champions', 'mastery', 'friends', 'compare'].includes(section)
  )
    return response.notFound()
  const { default: summonerService } = await import('#services/summoner_service')
  // A stored profile can render in the HTML and removes the client lookup waterfall.
  // Unknown profiles still resolve through the API, where Riot errors are translated.
  const initialProfile = await summonerService.findStoredProfile(params.summoner).catch(() => null)

  /**
   * Knowing the puuid server-side means the browser can be told which
   * analytics requests are coming while it is still parsing the HTML, rather
   * than discovering them only after the bundle has downloaded, parsed and
   * hydrated. The panels' own `fetch` calls then land on connections that are
   * already open and, more often than not, on responses already in flight.
   */
  const preload = initialProfile ? analyticsUrls(initialProfile.puuid) : []
  // A pro's account carries the "Pro" tag and leads to their page.
  const identity = summonerService.normalize(params.summoner)
  const { default: proService } = await import('#services/pro_service')
  const pro = identity ? await proService.byRiotId(identity.gameName, identity.tagLine) : null

  return inertia.render('summoner', {
    summoner: params.summoner,
    section,
    initialProfile,
    social: initialProfile ? profileSocial(initialProfile, section, request) : null,
    jsonld: initialProfile ? profileJsonLd(initialProfile) : [],
    panels: ANALYTICS_PANELS,
    preload,
    pro,
  })
})

/**
 * A profile's link preview: the profile card, or on the Mastery tab the pool itself
 * (`/og/mastery/…`), at that tab's address.
 */
function profileSocial(
  profile: { gameName: string; tagLine: string },
  section: string,
  request: HttpContext['request']
) {
  const id = encodeURIComponent(`${profile.gameName}-${profile.tagLine}`)
  const title = `${profile.gameName}#${profile.tagLine} | invade.lol`
  // A link shared from the share dialog (`?card=stats-wide&…`) previews as that card, drawn fresh.
  const query = request.qs()
  if (section === 'overview' && typeof query.card === 'string') {
    const card = parseCard(query.card, query)
    const host = request.host() ?? 'invade.lol'
    const origin = host.endsWith('invade.lol')
      ? `https://${host}`
      : `${request.protocol()}://${host}`
    const [w, h] = [FORMATS[card.format].width, FORMATS[card.format].height]
    return {
      title,
      description: `${profile.gameName}'s League of Legends profile, recent performance and champion pool.`,
      url: `https://invade.lol/${id}`,
      image: `${origin}${cardImagePath(`${profile.gameName}-${profile.tagLine}`, card)}`,
      imageType: 'image/png',
      imageWidth: w,
      imageHeight: h,
      alt: `${profile.gameName}'s share card`,
    }
  }
  // The cards change through the day: a day's version, with the drawing's.
  const v = `${OG_RENDERER}.${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`
  const tab = section === 'overview' ? '' : `/${section}`
  if (section === 'mastery')
    return {
      title,
      description: `${profile.gameName}'s champion mastery: every champion, sized by mastery points.`,
      url: `https://invade.lol/${id}/mastery`,
      canonical: `https://invade.lol/${id}/mastery`,
      image: `https://invade.lol/og/mastery/${id}.jpg?v=${v}`,
      imageType: 'image/jpeg',
      alt: `${profile.gameName}'s champion mastery pool, every champion a circle sized by its points, and their total points with a poro holding a heart`,
    }
  return {
    title,
    description: `${profile.gameName}#${profile.tagLine}'s League of Legends profile: rank, match history with a score for every game, and champion pool.`,
    url: `https://invade.lol/${id}${tab}`,
    canonical: `https://invade.lol/${id}${tab}`,
    image: `https://invade.lol/og/${id}?v=${v}`,
    imageType: 'image/jpeg',
    alt: `${profile.gameName}'s profile icon and name over their most played champion's splash art, their rank and recent win rate, with a poro reacting to it`,
  }
}

/** A profile's structured data: the page is about one player, known by their Riot ID. */
function profileJsonLd(profile: { gameName: string; tagLine: string }) {
  const url = `https://invade.lol/${encodeURIComponent(`${profile.gameName}-${profile.tagLine}`)}`
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      url,
      'mainEntity': {
        '@type': 'Person',
        'name': `${profile.gameName}#${profile.tagLine}`,
        'alternateName': profile.gameName,
        url,
      },
    },
  ]
}
