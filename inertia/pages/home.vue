<script setup lang="ts">
import { computed } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import { ChampIcon, Icon, RoleIcon } from '@invadelol/ui'
import '../css/home.css'
import AppHeader from '../components/AppHeader.vue'
import SearchBar from '../components/SearchBar.vue'
import SiteFooter from '../components/SiteFooter.vue'
import ProPhoto from '../components/champions/ProPhoto.vue'
import TeamLogo from '../components/champions/TeamLogo.vue'
import HomeApp from '../components/home/HomeApp.vue'
import HomeDiscord from '../components/home/HomeDiscord.vue'
import HomeRecent from '../components/home/HomeRecent.vue'
import MatchCard from '../components/pros/MatchCard.vue'
import { matchList } from '../lib/pro_matches.js'
import { TIER_LABELS, championHref, positionOf } from '../components/header/sections.js'
import { pct } from '../lib/champions.js'
import type { HomePage } from '../lib/home.js'

/**
 * `/`: the search and the profiles this browser opened last, then what invade.lol reads from its
 * own games (the tier list's best picks, the highest ranked pros, the lanes, the most banned),
 * the desktop app and the Discord. Each block is left out when its data could not be read; the
 * search always stands.
 */
const props = defineProps<HomePage>()

const best = computed(() => props.picks?.best ?? [])
const bans = computed(() => props.picks?.bans ?? [])
const pros = computed(() => props.pros ?? [])
const bullies = computed(() => props.lanes?.bullies ?? [])
const firsts = computed(() => props.lanes?.firstBlood ?? [])
const topBan = computed(() => bans.value[0]?.banRate || 1)
const games = computed(() => matchList(props.games))
/** The league of the next games when they are all one (an international event), else none. */
const gamesLeague = computed(() => {
  const set = new Set(games.value.map((g) => g.league?.slug ?? ''))
  return set.size === 1 ? (games.value[0]?.league ?? null) : null
})

const lp = (n: number | null) => (n === null ? '' : n.toLocaleString('en-US'))
const gold = (n: number) => `+${Math.round(n)}`
</script>

<template>
  <Head title="Find a player" />

  <div class="flex min-h-screen flex-col">
    <AppHeader :search="false" />

    <main id="main" class="hm flex-1 pb-[72px] lg:pb-[120px]">
      <section class="hm-hero hm-wrap" aria-labelledby="hm-find">
        <h1 id="hm-find">Find a player</h1>
        <div class="hm-field">
          <SearchBar
            size="lg"
            autofocus
            placeholder="Search a Riot ID, a champion or a pro"
            short-placeholder="Riot ID, champion or pro"
          />
        </div>
        <HomeRecent />
      </section>

      <!-- The tier list's best pick in each role, and the highest ranked pros. -->
      <section
        v-if="best.length || pros.length"
        class="hm-sec hm-wrap"
        aria-label="Best picks and pros"
      >
        <div class="hm-two">
          <div v-if="best.length">
            <div class="hm-head">
              <span class="ico"><Icon name="chart" :size="14" /></span>
              <h2>Best picks</h2>
              <span v-if="picks" class="meta">Patch {{ picks.patch }}</span>
              <Link href="/tier-list" prefetch class="end" data-track="home_tier_list"
                >Tier list<Icon name="right" :size="13"
              /></Link>
            </div>
            <div class="hm-list">
              <Link
                v-for="b in best"
                :key="b.position"
                :href="championHref(b.slug, b.position)"
                prefetch
                class="hm-row"
                data-track="home_best_pick"
              >
                <span class="rl"
                  ><RoleIcon :lane="positionOf(b.position).lane" :size="14" /><span>{{
                    positionOf(b.position).label
                  }}</span></span
                >
                <span class="pic"><ChampIcon :id="b.championId" :size="36" :title="b.name" /></span>
                <span class="n">{{ b.name }}</span>
                <span v-if="b.tier !== null" class="sh-tier" :class="`t${b.tier}`">{{
                  TIER_LABELS[b.tier]
                }}</span>
                <b class="f w iv-fig num">{{ pct(b.winRate) }}</b>
              </Link>
            </div>
          </div>
          <div v-if="pros.length">
            <div class="hm-head">
              <span class="ico"><Icon name="crown" :size="14" /></span>
              <h2>Pros</h2>
              <span class="meta">Solo queue now</span>
              <Link href="/pros" prefetch class="end" data-track="home_pros"
                >All pros<Icon name="right" :size="13"
              /></Link>
            </div>
            <div class="hm-list">
              <Link
                v-for="(p, i) in pros"
                :key="p.slug"
                :href="`/pro/${p.slug}`"
                prefetch
                class="hm-row"
                data-track="home_pro"
              >
                <span class="pos num">{{ i + 1 }}</span>
                <ProPhoto
                  v-if="p.photo"
                  :slug="p.slug"
                  :photo="p.photo"
                  :width="32"
                  :height="32"
                  class="logo"
                />
                <TeamLogo v-else-if="p.team" :team="p.team" :size="32" class="logo" />
                <span v-else class="logo none" aria-hidden="true"
                  ><Icon name="user" :size="14"
                /></span>
                <span class="n"
                  >{{ p.name }}<small v-if="p.team">{{ p.team.name }}</small></span
                >
                <b class="f iv-fig num">{{ lp(p.lp) }}<small>LP</small></b>
                <span
                  v-if="p.movement"
                  class="mv num"
                  :class="p.movement.places > 0 ? 'up' : p.movement.places < 0 ? 'down' : ''"
                  >{{
                    p.movement.places > 0
                      ? `▲ ${p.movement.places}`
                      : p.movement.places < 0
                        ? `▼ ${-p.movement.places}`
                        : '='
                  }}</span
                >
              </Link>
            </div>
          </div>
        </div>
      </section>

      <!-- The next pro games, when any is planned. -->
      <section v-if="games.length" class="hm-sec hm-wrap" aria-labelledby="hm-games">
        <div class="hm-head">
          <span class="ico"><Icon name="clock" :size="14" /></span>
          <h2 id="hm-games">Next pro games</h2>
          <span v-if="gamesLeague" class="meta">{{ gamesLeague.name }}</span>
          <Link href="/pros" prefetch class="end" data-track="home_pro_games"
            >Pros<Icon name="right" :size="13"
          /></Link>
        </div>
        <div class="hm-games">
          <MatchCard v-for="g in games" :key="g.id" :match="g" :show-league="!gamesLeague" />
        </div>
      </section>

      <!-- Who wins the lane early, and who is in on first blood. -->
      <section
        v-if="bullies.length || firsts.length"
        class="hm-sec hm-wrap"
        aria-label="Lanes and first blood"
      >
        <div class="hm-two">
          <div v-if="bullies.length">
            <div class="hm-head">
              <span class="ico"><Icon name="coins" :size="14" /></span>
              <h2>Lane bullies</h2>
              <span class="meta">Gold ahead at 10 min</span>
              <Link href="/stats?view=early" prefetch class="end" data-track="home_early"
                >Early game<Icon name="right" :size="13"
              /></Link>
            </div>
            <div class="hm-list">
              <Link
                v-for="b in bullies"
                :key="`${b.position}${b.championId}`"
                :href="championHref(b.slug, b.position)"
                prefetch
                class="hm-row"
                data-track="home_lane_bully"
              >
                <span class="pic"><ChampIcon :id="b.championId" :size="36" :title="b.name" /></span>
                <span class="n"
                  >{{ b.name }}<small>{{ positionOf(b.position).label }}</small></span
                >
                <b class="f iv-fig num">{{ gold(b.value) }}</b>
              </Link>
            </div>
          </div>
          <div v-if="firsts.length">
            <div class="hm-head">
              <span class="ico"><Icon name="skull" :size="14" /></span>
              <h2>First blood</h2>
              <span class="meta">Share of games</span>
              <Link href="/stats?view=firstblood" prefetch class="end" data-track="home_first_blood"
                >Fights<Icon name="right" :size="13"
              /></Link>
            </div>
            <div class="hm-list">
              <Link
                v-for="b in firsts"
                :key="`${b.position}${b.championId}`"
                :href="championHref(b.slug, b.position)"
                prefetch
                class="hm-row"
                data-track="home_first_blood_pick"
              >
                <span class="pic"><ChampIcon :id="b.championId" :size="36" :title="b.name" /></span>
                <span class="n"
                  >{{ b.name }}<small>{{ positionOf(b.position).label }}</small></span
                >
                <b class="f iv-fig num">{{ pct(b.value) }}</b>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <HomeApp />

      <section v-if="bans.length" class="hm-sec far hm-wrap" aria-labelledby="hm-bans">
        <div class="hm-head">
          <span class="ico"><Icon name="shield" :size="14" /></span>
          <h2 id="hm-bans">Most banned</h2>
          <span v-if="picks" class="meta">Patch {{ picks.patch }}</span>
          <Link href="/tier-list" prefetch class="end" data-track="home_bans_tier_list"
            >Tier list<Icon name="right" :size="13"
          /></Link>
        </div>
        <div class="hm-bans">
          <Link
            v-for="b in bans"
            :key="b.championId"
            :href="championHref(b.slug, b.position)"
            prefetch
            class="hm-ban"
            data-track="home_banned"
          >
            <span class="who"
              ><span class="pic"><ChampIcon :id="b.championId" :size="36" :title="b.name" /></span
              ><span
                ><b>{{ b.name }}</b
                ><small
                  ><RoleIcon :lane="positionOf(b.position).lane" :size="11" />{{
                    positionOf(b.position).label
                  }}</small
                ></span
              ></span
            >
            <b class="f iv-fig num">{{ pct(b.banRate) }}<small>of games</small></b>
            <span class="hm-bar" aria-hidden="true"
              ><i :style="{ width: `${Math.round((b.banRate / topBan) * 100)}%` }"
            /></span>
          </Link>
        </div>
      </section>

      <HomeDiscord :counts="discord" />
    </main>

    <SiteFooter class="!mt-0" />
  </div>
</template>
