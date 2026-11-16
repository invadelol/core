<script setup lang="ts">
import { computed } from 'vue'
import { Head, Link, usePage } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import SiteLayout from '../components/SiteLayout.vue'
import SearchBar from '../components/SearchBar.vue'
import DownloadApp from '../components/DownloadApp.vue'
import HomeRecent from '../components/home/HomeRecent.vue'
import ProPhoto from '../components/champions/ProPhoto.vue'
import MatchTime from '../components/pros/MatchTime.vue'
import Glyph from '../components/ui/Glyph.vue'
import Icon from '../components/ui/Icon.vue'
import TierChip from '../components/ui/TierChip.vue'
import Frame from '../components/ui/Frame.vue'
import SectionHead from '../components/ui/SectionHead.vue'
import CardHead from '../components/ui/CardHead.vue'
import { championHref, positionOf } from '../components/header/sections.js'
import { isLive, matchList, teamLabel, teamName, type ProMatch } from '../lib/pro_matches.js'
import { patchName } from '../lib/patch.js'
import type { HomePage } from '../lib/home.js'
import '../css/home-facet.css'

/**
 * `/`: the search with the profiles this browser opened last, the pro game of the moment, then
 * what invade.lol reads from its own games (the best pick of each role, the pros' ladder, the
 * patch's bans) and the desktop app. A block is left out when its data could not be read; the
 * search always stands.
 */
const props = defineProps<HomePage>()
const page = usePage()

const patch = computed(() => {
  const version = props.picks?.patch ?? (page.props as { patch?: string | null }).patch
  return version ? patchName(version) : null
})

const picks = computed(() => props.picks?.best ?? [])
const bans = computed(() => (props.picks?.bans ?? []).slice(0, 5))
const topBan = computed(() => bans.value[0]?.banRate || 1)
const pros = computed(() => (props.pros ?? []).slice(0, 5))

/** The pro game of the moment: the one being played, else the next one. */
const game = computed<ProMatch | null>(() => {
  const games = matchList(props.games)
  return games.find((g) => isLive(g)) ?? games[0] ?? null
})
const live = computed(() => (game.value ? isLive(game.value) : false))
const gameTitle = computed(() => {
  const m = game.value
  if (!m) return ''
  const event = m.league?.name ?? m.tournament ?? 'Pro game'
  return m.name && !m.name.includes(' vs ') ? `${event}, ${m.name.toLowerCase()}` : event
})
const gameLine = computed(() => {
  const m = game.value
  if (!m) return ''
  const of = m.bestOf && m.bestOf > 1 ? `Best of ${m.bestOf}` : 'Best of one'
  if (!live.value) return of
  const played = (m.teams[0].score ?? 0) + (m.teams[1].score ?? 0)
  return m.bestOf && m.bestOf > 1 ? `${of}, game ${played + 1} live` : `${of}, live`
})
const teamLogo = (t: ProMatch['teams'][number]) => (t.id ? `/cdn/team/${t.id}?s=48` : null)

const pct1 = (x: number) => (x * 100).toFixed(1)
const lp = (n: number | null) => (n === null ? '' : n.toLocaleString('en-US'))
const initials = (name: string) => name.slice(0, 2)
const moved = (lpChange: number) => `${lpChange > 0 ? '+' : '−'}${Math.abs(lpChange)} LP today`
const thousands = (n: number) => n.toLocaleString('en-US')
</script>

<template>
  <Head title="Find a player" />
  <SiteLayout :search="false">
    <div class="wrap">
      <section class="hm-hero">
        <h1 class="d1">Look up a player</h1>
        <p class="body hm-sub">Rank, match history and a score out of 100 for every game</p>
        <SearchBar variant="header" size="lg" autofocus placeholder="Riot ID, champion or pro" />
        <HomeRecent />
      </section>

      <section v-if="game" class="card lvrow" aria-label="Pro game">
        <span class="lg5">
          <img
            v-if="game.league"
            :src="`/cdn/league/${game.league.slug}`"
            :alt="game.league.name"
            width="36"
            height="36"
          />
          <span class="col">
            <span class="h4">{{ gameTitle }}</span>
            <span class="meta">{{ gameLine }}</span>
          </span>
        </span>
        <span class="tmx2 a"
          >{{ teamName(game.teams[0])
          }}<img
            v-if="teamLogo(game.teams[0])"
            :src="teamLogo(game.teams[0])!"
            :alt="teamLabel(game.teams[0])"
            width="44"
            height="44"
        /></span>
        <span class="mid3">
          <template v-if="live || game.status === 'finished'">
            <span class="fg-l num"
              >{{ game.teams[0].score ?? 0 }} – {{ game.teams[1].score ?? 0 }}</span
            ><br />
            <span v-if="live" class="live hm-live">Live</span>
          </template>
          <template v-else>
            <span class="fg-m">vs</span><br />
            <span class="meta"><MatchTime :at="game.at" /></span>
          </template>
        </span>
        <span class="tmx2"
          ><img
            v-if="teamLogo(game.teams[1])"
            :src="teamLogo(game.teams[1])!"
            :alt="teamLabel(game.teams[1])"
            width="44"
            height="44"
          />{{ teamName(game.teams[1]) }}</span
        >
        <span class="row hm-acts">
          <Link class="btn" href="/esports" prefetch>Rosters</Link>
          <a v-if="game.stream" class="btn pri" :href="game.stream" target="_blank" rel="noreferrer"
            ><Icon name="play" :size="16" />Watch</a
          >
        </span>
      </section>

      <section v-if="picks.length" class="sec" aria-labelledby="hm-picks">
        <SectionHead
          id="hm-picks"
          title="Best picks"
          icon="trophy"
          :meta="patch ? `Patch ${patch}, Emerald+` : 'Emerald+'"
          :more="{ label: 'Tier list', href: '/tier-list' }"
        />
        <div class="picks">
          <Link
            v-for="p in picks"
            :key="p.position"
            class="pick"
            :href="championHref(p.slug, p.position)"
            prefetch
          >
            <Frame
              :src="`/cdn/loading/${p.championId}.jpg`"
              :alt="p.name"
              size="l"
              position="50% 18%"
              eager
            />
            <span class="rl2"
              ><RoleIcon :lane="positionOf(p.position).lane" :size="15" />{{
                positionOf(p.position).label
              }}</span
            >
            <span class="nm3"
              ><span class="h3 hm-name">{{ p.name }}</span
              ><TierChip :tier="p.tier"
            /></span>
            <span class="wr4"
              ><span class="fg-m num">{{ pct1(p.winRate) }}<span class="u">%</span></span
              ><span class="meta">win rate</span></span
            >
          </Link>
        </div>
      </section>

      <section v-if="pros.length || bans.length" class="sec hm-two">
        <div v-if="pros.length" class="card">
          <CardHead
            title="Pros in solo queue"
            icon="pro"
            meta="Highest LP"
            as="h2"
            :more="{ label: 'Ladder', href: '/leaderboards/pros' }"
          />
          <Link v-for="(p, i) in pros" :key="p.slug" class="lrow" :href="`/pro/${p.slug}`" prefetch>
            <span class="rk">{{ i + 1 }}</span>
            <span v-if="p.photo" class="fr s stage hm-pro"
              ><ProPhoto :slug="p.slug" :photo="p.photo" :width="44" :height="44"
            /></span>
            <span v-else class="fr s hm-pro hm-ini">{{ initials(p.name) }}</span>
            <span class="col grow"
              ><span class="h4 ell">{{ p.name }}</span
              ><span v-if="p.team" class="meta ell">{{ p.team.name }}</span></span
            >
            <span v-if="p.movement && p.movement.lp" class="stat2 num">{{
              moved(p.movement.lp)
            }}</span>
            <span class="fg-xs num hm-lp">{{ lp(p.lp) }}<span class="u">LP</span></span>
          </Link>
        </div>
        <div v-if="bans.length" class="card">
          <CardHead
            title="Most banned"
            icon="ban"
            meta="Share of games banned"
            as="h2"
            :more="{ label: 'Stats', href: '/stats' }"
          />
          <Link
            v-for="b in bans"
            :key="b.championId"
            class="lrow"
            :href="championHref(b.slug, b.position)"
            prefetch
          >
            <Frame
              :src="`/cdn/centered/${b.championId}.jpg`"
              :alt="b.name"
              size="s"
              class="ban-pic"
              position="50% 25%"
            />
            <span class="col grow"
              ><span class="h4">{{ b.name }}</span
              ><span class="meta"
                >{{ positionOf(b.position).label
                }}<template v-if="b.winRate !== undefined"
                  >, wins {{ pct1(b.winRate) }}%</template
                ></span
              ></span
            >
            <span class="col hm-ban"
              ><span class="fg-xs num">{{ pct1(b.banRate) }}<span class="u">%</span></span
              ><span class="bar"
                ><i :style="{ width: `${Math.round((b.banRate / topBan) * 98)}%` }" /></span
            ></span>
          </Link>
        </div>
      </section>

      <section class="sec hm-last" aria-labelledby="hm-app">
        <div class="promo">
          <div class="hm-promo">
            <Glyph :h="44" />
            <h2 id="hm-app" class="h1">Invade for desktop</h2>
            <p class="body">
              It opens with League, brings the build into champion select and scores each of your
              games out of 100.
            </p>
            <DownloadApp track="home" />
            <p class="meta hm-free">
              Free.<template v-if="discord">
                {{ thousands(discord.members) }} players on the Discord,
                {{ thousands(discord.online) }} online now.</template
              >
            </p>
          </div>
          <span class="fr l shot"
            ><img
              :src="'/app-page/home-1280.webp'"
              :srcset="'/app-page/home-1280.webp 1280w, /app-page/home-2560.webp 2560w'"
              sizes="(max-width: 767px) 100vw, 640px"
              alt="The Invade desktop app's Home: rank and LP, the match history scored out of 100, clips and champions"
              loading="lazy"
              decoding="async"
          /></span>
        </div>
      </section>
    </div>
  </SiteLayout>
</template>
