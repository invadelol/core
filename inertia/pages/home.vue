<script setup lang="ts">
import { computed, ref } from 'vue'
import { Head, Link, usePage } from '@inertiajs/vue3'
import { ChampIcon, Icon, PerfDial, RoleIcon } from '@invadelol/ui'
import '../css/rd-discover.css'
import '../css/home.css'
import AppHeader from '../components/AppHeader.vue'
import SearchBar from '../components/SearchBar.vue'
import SiteFooter from '../components/SiteFooter.vue'
import ProPhoto from '../components/champions/ProPhoto.vue'
import Logo from '../components/champions/Logo.vue'
import MatchTime from '../components/pros/MatchTime.vue'
import HomeApp from '../components/home/HomeApp.vue'
import HomeDiscord from '../components/home/HomeDiscord.vue'
import HomeRecent from '../components/home/HomeRecent.vue'
import {
  isLive,
  matchList,
  stageLine,
  teamLabel,
  teamName,
  type ProMatch,
} from '../lib/pro_matches.js'
import { ROLE_LINKS, TIER_LABELS, championHref, positionOf } from '../components/header/sections.js'
import { pct } from '../lib/champions.js'
import { patchName } from '../lib/patch.js'
import { profilePath } from '../lib/format.js'
import { regionLabel } from '../lib/assets.js'
import type { HomePage } from '../lib/home.js'
import { queueName, score100 } from '@invadelol/ui/logic'

/**
 * `/`: the search and the profiles this browser opened last, the pro games of the moment, then
 * what invade.lol reads from its own games (the best pick of each role at three rank groups, who
 * climbed and fell since the patch before, the day's best scored games, the pros' ladder, the
 * patch's bans and lanes), the desktop app and the Discord. Each block is left out when its data
 * could not be read; the search always stands.
 */
const props = defineProps<HomePage>()
const page = usePage()

const RANK_LABEL: Record<string, string> = {
  emerald_plus: 'Emerald+',
  diamond_plus: 'Diamond+',
  master_plus: 'Master+',
}
const RANK_TEXT: Record<string, string> = {
  emerald_plus: 'Emerald and above',
  diamond_plus: 'Diamond and above',
  master_plus: 'Master and above',
}

const patch = computed(() => {
  const version = props.picks?.patch ?? (page.props as { patch?: string | null }).patch
  return version ? patchName(version) : null
})

/* ── Best picks, at the rank group the switch shows ─────────────── */
const brackets = computed(
  () =>
    props.picks?.brackets ??
    (props.picks ? [{ bracket: 'emerald_plus', games: 0, best: props.picks.best }] : [])
)
const bracket = ref(brackets.value[0]?.bracket ?? 'emerald_plus')
const shown = computed(
  () => brackets.value.find((b) => b.bracket === bracket.value) ?? brackets.value[0] ?? null
)
const tierListHref = computed(() =>
  bracket.value === 'emerald_plus' ? '/tier-list' : `/tier-list?rank=${bracket.value}`
)
const pickHref = (slug: string, position: string) =>
  `${championHref(slug, position)}${bracket.value === 'emerald_plus' ? '' : `&rank=${bracket.value}`}`

/* ── Who moved since the patch before, one role at a time ───────── */
const moves = computed(() => props.picks?.moves ?? null)
const role = ref('TOP')
const moved = computed(() => moves.value?.roles.find((r) => r.position === role.value) ?? null)
const ROLE_TABS = ROLE_LINKS.map((r) => ({
  position: (
    { TOP: 'TOP', JUNGLE: 'JUNGLE', MID: 'MIDDLE', ADC: 'BOTTOM', SUPPORT: 'UTILITY' } as const
  )[r.lane],
  label: r.label,
  lane: r.lane,
}))

/* ── Pro games ──────────────────────────────────────────────────── */
const games = computed(() => matchList(props.games))
const live = computed(() => games.value.find((g) => isLive(g)) ?? null)
const upcoming = computed(() => games.value.filter((g) => g !== live.value))
const scoreOf = (m: ProMatch) =>
  m.teams.every((t) => t.score !== null) ? `${m.teams[0].score} : ${m.teams[1].score}` : 'vs'
const teamHref = (t: ProMatch['teams'][number]) => (t.slug ? `/team/${t.slug}` : null)

/* ── Lists ──────────────────────────────────────────────────────── */
const pros = computed(() => props.pros ?? [])
const bans = computed(() => props.picks?.bans ?? [])
const bullies = computed(() => props.lanes?.bullies ?? [])
const firsts = computed(() => props.lanes?.firstBlood ?? [])
const topBan = computed(() => bans.value[0]?.banRate || 1)
const scored = computed(() => props.scored ?? [])

const lp = (n: number | null) => (n === null ? '' : n.toLocaleString('en-US'))
const gold = (n: number) => `+${Math.round(n)}`
const thousands = (n: number) => n.toLocaleString('en-US')
const minutes = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
const kda = (k: number, d: number, a: number) => (d ? ((k + a) / d).toFixed(2) : 'Perfect')
const tierClass = (tier: number | null) => (tier ? `t${Math.min(tier, 5)}` : '')
</script>

<template>
  <Head title="Find a player" />

  <div class="flex min-h-screen flex-col">
    <AppHeader :search="false" />

    <main id="main" class="hm flex-1">
      <section class="hm-hero" aria-labelledby="hm-find">
        <Link
          v-if="patch"
          href="/stats?view=patch"
          prefetch
          class="hm-live num"
          data-track="home_patch"
          >Patch {{ patch }} is live</Link
        >
        <h1 id="hm-find">Find a player</h1>
        <div class="hm-field dv-bigfield">
          <SearchBar
            size="lg"
            autofocus
            placeholder="Riot ID, champion or pro"
            short-placeholder="Riot ID, champion or pro"
          />
        </div>
        <div class="hm-chips">
          <HomeRecent />
          <nav class="hm-go" aria-label="Go to">
            <Link href="/tier-list" prefetch class="hm-chip t" data-track="home_chip_tier_list"
              >Tier list</Link
            >
            <Link href="/pros?view=ladder" prefetch class="hm-chip t" data-track="home_chip_ladder"
              >Pro ladder</Link
            >
            <Link href="/multisearch" prefetch class="hm-chip t" data-track="home_chip_multisearch"
              >Multisearch</Link
            >
          </nav>
        </div>

        <!-- The pro games of the moment: the live one first, then the next ones. -->
        <div v-if="games.length" class="hm-tick page">
          <div class="hm-tick-in" :style="{ '--n': Math.min(games.length, 4) }">
            <Link
              v-for="g in games.slice(0, 4)"
              :key="g.id"
              href="/pros"
              prefetch
              class="hm-tk"
              :class="{ now: isLive(g) }"
              data-track="home_pro_game"
            >
              <template v-if="isLive(g)">
                <span class="rd-tag r">Live</span>
                <b>{{ teamLabel(g.teams[0]) }}</b>
                <span class="sc rd-fig num">{{ scoreOf(g) }}</span>
                <b>{{ teamLabel(g.teams[1]) }}</b>
                <small v-if="g.league || stageLine(g)"
                  >{{ g.league?.code }} {{ stageLine(g) }}</small
                >
              </template>
              <template v-else>
                <Logo v-if="g.league" :league="g.league" :size="20" />
                <b>{{ teamLabel(g.teams[0]) }} vs {{ teamLabel(g.teams[1]) }}</b>
                <small><MatchTime :at="g.at" /></small>
              </template>
            </Link>
          </div>
        </div>
      </section>

      <div class="page">
        <!-- The best pick of each role, at the rank group the switch shows. -->
        <section
          v-if="shown && shown.best.length"
          class="dv-sec hm-first"
          aria-labelledby="hm-picks"
        >
          <div class="dv-sh">
            <div>
              <h2 id="hm-picks">Best picks right now</h2>
              <span class="meta num"
                >{{ RANK_TEXT[shown.bracket] ?? 'Emerald and above'
                }}<template v-if="shown.games">, {{ thousands(shown.games) }} games</template
                ><template v-if="patch"> on patch {{ patch }}</template></span
              >
            </div>
            <div class="end">
              <div v-if="brackets.length > 1" class="rd-seg" role="group" aria-label="Rank">
                <button
                  v-for="b in brackets"
                  :key="b.bracket"
                  type="button"
                  :class="{ on: b.bracket === bracket }"
                  :aria-pressed="b.bracket === bracket"
                  @click="bracket = b.bracket"
                >
                  {{ RANK_LABEL[b.bracket] ?? b.bracket }}
                </button>
              </div>
              <Link :href="tierListHref" prefetch class="dv-more" data-track="home_tier_list"
                >Full tier list<Icon name="right" :size="14"
              /></Link>
            </div>
          </div>
          <div class="hm-picks">
            <Link
              v-for="b in shown.best"
              :key="b.position"
              :href="pickHref(b.slug, b.position)"
              prefetch
              class="hm-pk"
              data-track="home_best_pick"
            >
              <img
                :src="`/cdn/loading/${b.championId}.jpg`"
                alt=""
                loading="lazy"
                decoding="async"
                width="308"
                height="560"
              />
              <span class="top">
                <span class="dv-role"
                  ><RoleIcon :lane="positionOf(b.position).lane" :size="14" />{{
                    positionOf(b.position).label
                  }}</span
                >
                <span v-if="b.tier !== null" class="rd-tier" :class="tierClass(b.tier)">{{
                  TIER_LABELS[b.tier]
                }}</span>
              </span>
              <span class="bot">
                <span class="nm">{{ b.name }}</span>
                <span class="wr"
                  ><span class="rd-fig">{{ pct(b.winRate) }}</span
                  ><span>win rate</span></span
                >
              </span>
            </Link>
          </div>
        </section>

        <!-- Places won and lost in each role since the patch before. -->
        <section v-if="moves" class="dv-sec" aria-labelledby="hm-moved">
          <div class="dv-sh">
            <div>
              <h2 id="hm-moved">Who moved on {{ patch }}</h2>
              <span class="meta"
                >{{ positionOf(role).label }} lane rank, against patch
                {{ patchName(moves.previousPatch) }}</span
              >
            </div>
            <div class="rd-seg hm-roles" role="group" aria-label="Role">
              <button
                v-for="r in ROLE_TABS"
                :key="r.position"
                type="button"
                :class="{ on: r.position === role }"
                :aria-pressed="r.position === role"
                @click="role = r.position"
              >
                <RoleIcon :lane="r.lane" :size="14" />{{ r.label }}
              </button>
            </div>
          </div>
          <div class="hm-duo">
            <div v-for="side in ['up', 'down'] as const" :key="side" class="rd-card">
              <div class="rd-head">
                <h3>{{ side === 'up' ? 'Climbing' : 'Falling' }}</h3>
              </div>
              <template v-if="moved && moved[side].length">
                <Link
                  v-for="m in moved[side]"
                  :key="m.championId"
                  :href="championHref(m.slug, m.position)"
                  prefetch
                  class="dv-row hm-mv"
                  data-track="home_moved"
                >
                  <span class="dv-pic"><ChampIcon :id="m.championId" :size="32" /></span>
                  <span class="dv-who"
                    ><b>{{ m.name }}</b
                    ><small class="num">{{ pct(m.winRate) }} win rate</small></span
                  >
                  <span class="hm-ft num"
                    ><span>{{ m.from }}</span
                    ><Icon name="right" :size="13" /><b class="rd-fig">{{ m.to }}</b></span
                  >
                  <span class="hm-d num" :class="side === 'up' ? 'rd-up' : 'rd-dn'"
                    >{{ side === 'up' ? '▲' : '▼' }} {{ Math.abs(m.from - m.to)
                    }}<span class="dv-sr">{{
                      side === 'up' ? 'places up' : 'places down'
                    }}</span></span
                  >
                </Link>
              </template>
              <p v-else class="dv-empty">No champion moved this much in this role.</p>
            </div>
          </div>
        </section>

        <!-- The score: what it is, and the best games of the last day as a profile shows them. -->
        <section v-if="scored.length" class="dv-sec hm-scored" aria-labelledby="hm-score">
          <div>
            <h2 id="hm-score">Each game, scored out of 100</h2>
            <p>
              Against your role at Emerald pace and the nine other players, so a loss you carried
              still shows.
            </p>
            <Link
              :href="profilePath(scored[0].player.gameName, scored[0].player.tagLine)"
              class="iv-btn primary lg hm-cta"
              data-track="home_example_profile"
              >See an example profile</Link
            >
          </div>
          <div class="rd-card rd-lit hm-mock">
            <div class="hm-mock-h">
              <div>
                <b>The best games of the day</b>
                <small>Scored the way every profile is</small>
              </div>
              <span class="rd-tag v">Last 24 hours</span>
            </div>
            <div class="hm-games">
              <Link
                v-for="s in scored"
                :key="s.matchId"
                :href="profilePath(s.player.gameName, s.player.tagLine)"
                class="hm-g"
                :class="s.game.win ? 'w' : 'l'"
                data-track="home_scored_game"
              >
                <span class="dv-pic"><ChampIcon :id="s.game.championId" :size="44" /></span>
                <span class="who"
                  ><b
                    >{{ s.player.gameName }}<span>#{{ s.player.tagLine }}</span></b
                  ><small class="num"
                    >{{ queueName(s.game.queueId) }}, {{ s.game.win ? 'win' : 'loss' }},
                    {{ minutes(s.game.duration) }}
                    <template v-if="regionLabel(s.player.platform)"
                      >, {{ regionLabel(s.player.platform) }}</template
                    ></small
                  ></span
                >
                <span class="kda"
                  ><b class="num"
                    >{{ s.game.kills }}<i>/</i>{{ s.game.deaths }}<i>/</i>{{ s.game.assists }}</b
                  ><small class="num"
                    >{{ kda(s.game.kills, s.game.deaths, s.game.assists) }} KDA</small
                  ></span
                >
                <span class="its" aria-hidden="true">
                  <template v-for="(item, i) in s.game.items.slice(0, 6)" :key="i">
                    <img
                      v-if="item"
                      :src="`/cdn/item/${item}.png`"
                      alt=""
                      width="26"
                      height="26"
                      loading="lazy"
                    />
                    <span v-else />
                  </template>
                </span>
                <PerfDial
                  :score="s.game.score ? score100(s.game.score.score) : null"
                  :rank="s.game.score?.rank ?? 0"
                  :tag="s.game.score?.tag ?? ''"
                />
              </Link>
            </div>
          </div>
        </section>

        <!-- Pro play: the games of the moment and the pros' solo queue ladder. -->
        <section v-if="games.length || pros.length" class="dv-sec" aria-labelledby="hm-pros">
          <div class="dv-sh">
            <div>
              <h2 id="hm-pros">Pro play</h2>
              <span class="meta">Leagues, teams and solo queue, in one place</span>
            </div>
            <Link href="/pros" prefetch class="dv-more" data-track="home_pros"
              >All pros<Icon name="right" :size="14"
            /></Link>
          </div>
          <div class="hm-duo" :class="{ wide: games.length && pros.length }">
            <div v-if="games.length" class="rd-card">
              <div class="rd-head">
                <h3>Games</h3>
                <Link href="/pros" prefetch class="dv-more" data-track="home_pro_games"
                  >Schedule<Icon name="right" :size="14"
                /></Link>
              </div>
              <div v-if="live" class="hm-livebox">
                <div class="team">
                  <Logo
                    :team="{
                      id: live.teams[0].id,
                      name: teamName(live.teams[0]),
                      shortName: live.teams[0].code,
                    }"
                    :size="40"
                  />
                  <span
                    ><component
                      :is="teamHref(live.teams[0]) ? Link : 'b'"
                      :href="teamHref(live.teams[0]) ?? undefined"
                      class="nm"
                      >{{ teamName(live.teams[0]) }}</component
                    ><small>{{ live.league?.code }}</small></span
                  >
                </div>
                <div class="score">
                  <div class="rd-fig num">
                    {{ live.teams[0].score ?? 0 }}<i>:</i>{{ live.teams[1].score ?? 0 }}
                  </div>
                  <div class="meta">
                    <span class="rd-tag r">Live</span><span>{{ stageLine(live) }}</span>
                  </div>
                </div>
                <div class="team r">
                  <span
                    ><component
                      :is="teamHref(live.teams[1]) ? Link : 'b'"
                      :href="teamHref(live.teams[1]) ?? undefined"
                      class="nm"
                      >{{ teamName(live.teams[1]) }}</component
                    ><small>{{ live.league?.code }}</small></span
                  >
                  <Logo
                    :team="{
                      id: live.teams[1].id,
                      name: teamName(live.teams[1]),
                      shortName: live.teams[1].code,
                    }"
                    :size="40"
                  />
                </div>
              </div>
              <div v-for="g in upcoming" :key="g.id" class="hm-gm">
                <span class="when"><MatchTime :at="g.at" /></span>
                <span class="vs">
                  <Logo
                    :team="{
                      id: g.teams[0].id,
                      name: teamName(g.teams[0]),
                      shortName: g.teams[0].code,
                    }"
                    :size="24"
                  />{{ teamLabel(g.teams[0]) }}<i>vs</i>{{ teamLabel(g.teams[1])
                  }}<Logo
                    :team="{
                      id: g.teams[1].id,
                      name: teamName(g.teams[1]),
                      shortName: g.teams[1].code,
                    }"
                    :size="24"
                  />
                </span>
                <span class="lg"
                  ><Logo v-if="g.league" :league="g.league" :size="16" />{{ stageLine(g) }}</span
                >
              </div>
            </div>
            <div v-if="pros.length" class="rd-card">
              <div class="rd-head">
                <h3>Solo queue ladder</h3>
                <Link href="/pros?view=ladder" prefetch class="dv-more" data-track="home_ladder"
                  >Ladder<Icon name="right" :size="14"
                /></Link>
              </div>
              <Link
                v-for="(p, i) in pros"
                :key="p.slug"
                :href="`/pro/${p.slug}`"
                prefetch
                class="dv-row"
                data-track="home_pro"
              >
                <span class="rk num">{{ i + 1 }}</span>
                <ProPhoto
                  v-if="p.photo"
                  :slug="p.slug"
                  :photo="p.photo"
                  :width="36"
                  :height="36"
                  class="rd-photo"
                />
                <Logo
                  v-else-if="p.team"
                  :team="{ id: p.team.id, name: p.team.name, shortName: p.team.shortName }"
                  :size="32"
                />
                <span v-else class="hm-nophoto" aria-hidden="true"
                  ><Icon name="user" :size="14"
                /></span>
                <span class="dv-who"
                  ><b>{{ p.name }}</b
                  ><small>{{ p.team?.name ?? 'Free agent' }}</small></span
                >
                <span class="dv-val"
                  ><span class="rd-fig num">{{ lp(p.lp) }}</span
                  ><span class="u">LP</span></span
                >
                <span
                  class="hm-lpmv num"
                  :class="p.movement?.lp ? (p.movement.lp > 0 ? 'rd-up' : 'rd-dn') : 'rd-flat'"
                  >{{
                    p.movement?.lp
                      ? `${p.movement.lp > 0 ? '+' : '−'}${Math.abs(p.movement.lp)} LP`
                      : '='
                  }}</span
                >
              </Link>
            </div>
          </div>
        </section>

        <!-- The patch in numbers: bans, lane leads, first bloods. -->
        <section
          v-if="bans.length || bullies.length || firsts.length"
          class="dv-sec"
          aria-labelledby="hm-numbers"
        >
          <div class="dv-sh">
            <div>
              <h2 id="hm-numbers">This patch in numbers</h2>
              <span class="meta">From ranked games, Emerald and above</span>
            </div>
            <Link href="/stats" prefetch class="dv-more" data-track="home_stats"
              >All stats<Icon name="right" :size="14"
            /></Link>
          </div>
          <div class="hm-trio">
            <div v-if="bans.length" class="rd-card">
              <div class="rd-head"><h3>Most banned</h3></div>
              <Link
                v-for="b in bans"
                :key="b.championId"
                :href="championHref(b.slug, b.position)"
                prefetch
                class="dv-row"
                data-track="home_banned"
              >
                <span class="dv-pic"><ChampIcon :id="b.championId" :size="32" /></span>
                <span class="dv-who"
                  ><b>{{ b.name }}</b
                  ><span class="rd-bar quiet hm-bar"
                    ><i :style="{ width: `${Math.round((b.banRate / topBan) * 100)}%` }" /></span
                ></span>
                <span class="dv-val hm-w"
                  ><span class="rd-fig num">{{ pct(b.banRate) }}</span></span
                >
              </Link>
            </div>
            <div v-if="bullies.length" class="rd-card">
              <div class="rd-head">
                <h3>Lane bullies<span class="rd-meta">Gold lead at 10 min</span></h3>
              </div>
              <Link
                v-for="b in bullies"
                :key="`${b.position}${b.championId}`"
                :href="championHref(b.slug, b.position)"
                prefetch
                class="dv-row"
                data-track="home_lane_bully"
              >
                <span class="dv-pic"><ChampIcon :id="b.championId" :size="32" /></span>
                <span class="dv-who"
                  ><b>{{ b.name }}</b
                  ><small>{{ positionOf(b.position).label }}</small></span
                >
                <span class="dv-val"
                  ><span class="rd-fig rd-gold num">{{ gold(b.value) }}</span></span
                >
              </Link>
            </div>
            <div v-if="firsts.length" class="rd-card">
              <div class="rd-head">
                <h3>First blood<span class="rd-meta">Share of games</span></h3>
              </div>
              <Link
                v-for="b in firsts"
                :key="`${b.position}${b.championId}`"
                :href="championHref(b.slug, b.position)"
                prefetch
                class="dv-row"
                data-track="home_first_blood_pick"
              >
                <span class="dv-pic"><ChampIcon :id="b.championId" :size="32" /></span>
                <span class="dv-who"
                  ><b>{{ b.name }}</b
                  ><small>{{ positionOf(b.position).label }}</small></span
                >
                <span class="dv-val"
                  ><span class="rd-fig num">{{ pct(b.value) }}</span></span
                >
              </Link>
            </div>
          </div>
        </section>

        <HomeApp />

        <HomeDiscord :counts="discord" />
      </div>
    </main>

    <SiteFooter />
  </div>
</template>
