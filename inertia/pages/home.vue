<script setup lang="ts">
import { computed, reactive } from 'vue'
import { Head, Link, usePage } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import SiteLayout from '../components/SiteLayout.vue'
import SearchBar from '../components/SearchBar.vue'
import HomeRecent from '../components/home/HomeRecent.vue'
import NewDawnLine from '../components/home/NewDawnLine.vue'
import DownloadApp from '../components/DownloadApp.vue'
import ProPic from '../components/pros/ProPic.vue'
import Logo from '../components/pros/Logo.vue'
import MatchTime from '../components/pros/MatchTime.vue'
import Glyph from '../components/ui/Glyph.vue'
import Icon from '../components/ui/Icon.vue'
import TierChip from '../components/ui/TierChip.vue'
import Frame from '../components/ui/Frame.vue'
import SectionHead from '../components/ui/SectionHead.vue'
import CardHead from '../components/ui/CardHead.vue'
import { championHref, positionOf } from '../components/header/sections.js'
import { champIcon } from '../lib/assets.js'
import { headlineGame, homeCards, patchMoves } from '../lib/home_cards.js'
import {
  isLive,
  matchList,
  matchOrNull,
  stageOf,
  teamName,
  type ProMatch,
} from '../lib/pro_matches.js'
import { patchName } from '../lib/patch.js'
import { patchPath } from '../lib/site_nav.js'
import { DISCORD_URL, X_URL } from '../lib/links.js'
import type { HomePage } from '../lib/home.js'
import '../css/home-facet.css'

/**
 * `/`: a title and one normal-size search at the centre, one quiet line of this browser's recent
 * lookups under it, then three live cards (the pro game, where the patch moved champions, a lane
 * figure), then what invade.lol reads from its own games (the best pick of each role, the pros'
 * ladder, the patch's bans), the desktop app, Discord and X. A block is left out when its data
 * could not be read; the search always stands.
 */
const props = defineProps<HomePage>()
const page = usePage()

const version = computed(
  () => props.picks?.patch ?? (page.props as { patch?: string | null }).patch ?? null
)
const patch = computed(() => (version.value ? patchName(version.value) : null))

const picks = computed(() => props.picks?.best ?? [])
const bans = computed(() => (props.picks?.bans ?? []).slice(0, 5))
const topBan = computed(() => bans.value[0]?.banRate || 1)
const pros = computed(() => (props.pros ?? []).slice(0, 5))
const notes = computed(() => props.patchNotes ?? null)

/* ── The three cards ─────────────────────────────────────────────── */

const game = computed<ProMatch | null>(() =>
  headlineGame(matchList(props.games), matchOrNull(props.result))
)
const cards = computed(() =>
  homeCards({
    game: game.value,
    moves: patchMoves(props.picks?.moves, notes.value?.changes),
    previousPatch: props.picks?.moves?.previousPatch ?? null,
    lanes: props.lanes,
  })
)

const live = (m: ProMatch) => isLive(m)
const finished = (m: ProMatch) => m.status === 'finished'
const stage = (m: ProMatch) => {
  const s = stageOf(m)
  return s ? s.charAt(0) + s.slice(1).toLowerCase() : null
}
const bestOf = (m: ProMatch) =>
  m.bestOf && m.bestOf > 1
    ? `Best of ${['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'][m.bestOf] ?? m.bestOf}`
    : 'Best of one'
const winner = (m: ProMatch) => (m.winner ? teamName(m.teams[m.winner - 1]) : null)
const gameNow = (m: ProMatch) => (m.teams[0].score ?? 0) + (m.teams[1].score ?? 0) + 1
/** A team whose logo did not load shows its code instead (`Logo` also tells after hydration). */
const noLogo = reactive(new Set<number>())
const lost = (m: ProMatch, side: 0 | 1) => finished(m) && m.winner !== null && m.winner !== side + 1

/* ── Figures ─────────────────────────────────────────────────────── */

const pct1 = (x: number) => (x * 100).toFixed(1)
const lp = (n: number | null) => (n === null ? '' : n.toLocaleString('en-US'))
const moved = (lpChange: number) => `${lpChange > 0 ? '+' : '−'}${Math.abs(lpChange)} LP today`
const thousands = (n: number) => n.toLocaleString('en-US')
/** The stream opens beside the page (the card itself leads to the esports page). */
const watch = (url: string) => window.open(url, '_blank', 'noopener')
const topBully = (rows: { value: number }[]) => rows[0]?.value || 1
</script>

<template>
  <Head title="Find a player" />
  <SiteLayout :search="false">
    <div class="wrap">
      <section class="hp" aria-labelledby="hp-title">
        <!-- Poros on both sides of the search, with a few things from the Rift floating around them. -->
        <div class="hp-art" aria-hidden="true">
          <div class="hpa l">
            <img class="hpb" :src="'/home/poro-peace.webp'" alt="" width="174" height="173" />
            <img class="hpi x" :src="'/cdn/item/3340'" alt="" width="64" height="64" />
            <img class="hpi y" :src="'/cdn/item/2052'" alt="" width="64" height="64" />
            <span class="hpg" />
            <img class="hpf" :src="'/home/poro-cheeky.webp'" alt="" width="180" height="157" />
          </div>
          <div class="hpa r">
            <img class="hpb" :src="'/home/poro-snoozy.webp'" alt="" width="224" height="200" />
            <img class="hpi x" :src="'/cdn/item/2003'" alt="" width="64" height="64" />
            <img class="hpi y" :src="'/cdn/item/1056'" alt="" width="64" height="64" />
            <span class="hpg" />
            <img class="hpf" :src="'/home/poro-snax.webp'" alt="" width="175" height="176" />
          </div>
        </div>
        <h1 id="hp-title" class="d1 hp-t">Look up a player</h1>
        <SearchBar
          variant="header"
          size="lg"
          placeholder="Riot ID, champion or pro"
          short-placeholder="Riot ID, champion or pro"
        />
        <HomeRecent />
        <NewDawnLine />

        <div v-if="cards.length" class="hc3" :class="`n${cards.length}`">
          <template v-for="card in cards" :key="card.key">
            <!-- The pro game of the moment: live, next, or the last result. -->
            <Link v-if="card.key === 'game'" class="lc pro" href="/esports" prefetch>
              <span class="lc-h"
                ><Logo
                  v-if="card.game.league"
                  class="lg"
                  :league="card.game.league.slug"
                  :size="22"
                /><b class="ell">{{
                  card.game.league?.name ?? card.game.tournament ?? 'Pro game'
                }}</b
                ><span v-if="live(card.game)" class="live lc-m">Live</span
                ><span v-else-if="stage(card.game)" class="lc-m">{{ stage(card.game) }}</span></span
              >
              <span class="lc-g">
                <span
                  v-for="side in [0, 1] as const"
                  :key="side"
                  class="tm"
                  :class="{ w: !lost(card.game, side), [`s${side}`]: true }"
                  ><Logo
                    v-if="card.game.teams[side].id && !noLogo.has(side)"
                    :team="card.game.teams[side].id"
                    :size="68"
                    @missing="noLogo.add(side)"
                  /><span v-else class="tm-ini">{{
                    (card.game.teams[side].code ?? teamName(card.game.teams[side])).slice(0, 3)
                  }}</span
                  ><b>{{ card.game.teams[side].code ?? teamName(card.game.teams[side]) }}</b></span
                >
                <span class="sc">
                  <span v-if="live(card.game) || finished(card.game)" class="fg-xl num"
                    ><b :class="{ lo: lost(card.game, 0) }">{{ card.game.teams[0].score ?? 0 }}</b
                    ><i /><b :class="{ lo: lost(card.game, 1) }">{{
                      card.game.teams[1].score ?? 0
                    }}</b></span
                  >
                  <span v-else class="fg-l vs">vs</span>
                  <span class="meta"
                    ><template v-if="live(card.game)">Game {{ gameNow(card.game) }}, live</template
                    ><MatchTime v-else :at="card.game.at"
                  /></span>
                </span>
              </span>
              <span class="lc-f"
                ><span class="meta ell"
                  >{{ bestOf(card.game)
                  }}<template v-if="finished(card.game) && winner(card.game)"
                    >, {{ winner(card.game) }} win</template
                  ></span
                ><button
                  v-if="live(card.game) && card.game.stream"
                  type="button"
                  class="btn sm pri"
                  @click.prevent.stop="watch(card.game.stream)"
                >
                  <Icon name="play" :size="15" />Watch</button
                ><span v-else class="more">Esports<Icon name="chevr" :size="14" /></span
              ></span>
            </Link>

            <!-- Where the patch moved champions in their role. -->
            <Link
              v-else-if="card.key === 'moves'"
              class="lc"
              :href="version ? patchPath(version) : '/tier-list'"
              prefetch
            >
              <span class="lc-h"
                ><Icon name="news" :size="16" /><b>Where {{ patch }} moved them</b
                ><span class="lc-m"
                  ><span class="lc-long">Rank in role since</span
                  ><span class="lc-short">Since</span> {{ patchName(card.previousPatch) }}</span
                ></span
              >
              <span v-for="m in card.rows" :key="`${m.championId}-${m.position}`" class="lc-r">
                <span class="ic s"><img :src="champIcon(m.championId)" alt="" /></span>
                <span class="tx"
                  ><b>{{ m.name }}</b
                  ><span class="hrl">{{ positionOf(m.position).label }}</span></span
                >
                <span v-if="m.kind === 'up' || m.kind === 'down'" class="pt" :class="m.kind"
                  ><Icon :name="m.kind" :size="11" />{{
                    m.kind === 'up' ? 'Buffed' : 'Nerfed'
                  }}</span
                >
                <span v-else-if="m.kind" class="pt mix">Adjusted</span>
                <span class="mv num" :class="{ up: m.to < m.from }"
                  ><span>#{{ m.from }}</span
                  ><Icon name="arrow" :size="12" /><b>#{{ m.to }}</b></span
                >
              </span>
            </Link>

            <!-- A lane figure from the patch's games. -->
            <Link v-else class="lc bully" href="/stats" prefetch>
              <span class="lc-h"
                ><Icon :name="card.key === 'bullies' ? 'swords' : 'flame'" :size="16" /><b>{{
                  card.key === 'bullies' ? 'Lane bullies' : 'First bloods'
                }}</b
                ><span class="lc-m">{{
                  card.key === 'bullies' ? 'Gold ahead at 10 min' : 'Share of games'
                }}</span></span
              >
              <span v-for="r in card.rows" :key="`${r.championId}-${r.position}`" class="lc-r">
                <span class="ic s"><img :src="champIcon(r.championId)" alt="" /></span>
                <span class="tx"
                  ><b>{{ r.name }}</b
                  ><span class="hrl">{{ positionOf(r.position).label }}</span></span
                >
                <span v-if="card.key === 'bullies'" class="gv num"
                  >+{{ Math.round(r.value) }}<span class="u">gold</span></span
                >
                <span v-else class="gv num">{{ pct1(r.value) }}<span class="u">%</span></span>
                <i class="gb" :style="{ '--w': (r.value / topBully(card.rows)).toFixed(3) }" />
              </span>
            </Link>
          </template>
        </div>
      </section>

      <section v-if="picks.length" class="sec hm-s" aria-labelledby="hm-picks">
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
            <span class="fr s stage hm-pro"
              ><ProPic :slug="p.slug" :photo="p.photo" :team="p.team" :size="44"
            /></span>
            <span class="col grow"
              ><span class="h4 ell">{{ p.name }}</span
              ><span class="meta ell">{{ p.team?.name ?? 'Free agent' }}</span></span
            >
            <span v-if="p.movement && p.movement.lp" class="stat2 num">{{
              moved(p.movement.lp)
            }}</span>
            <span class="fg-xs num hm-lp">{{ lp(p.lp) }}<span class="u">LP</span></span>
          </Link>
        </div>
        <div v-if="bans.length" class="card hm-bans">
          <CardHead
            title="Most banned"
            icon="ban"
            meta="Share of games banned"
            as="h2"
            :more="{ label: 'Stats', href: '/stats' }"
          />
          <Link
            v-for="(b, i) in bans"
            :key="b.championId"
            class="bn"
            :href="championHref(b.slug, b.position)"
            prefetch
          >
            <span class="bn-n num">{{ i + 1 }}</span>
            <span class="ic m"><img :src="champIcon(b.championId)" :alt="b.name" /></span>
            <span class="col grow bn-t"
              ><b class="h4">{{ b.name }}</b
              ><span class="meta bn-m"
                ><RoleIcon :lane="positionOf(b.position).lane" :size="13" />{{
                  positionOf(b.position).label
                }}<template v-if="b.winRate !== undefined"
                  >, wins {{ pct1(b.winRate) }}%</template
                ></span
              ></span
            >
            <span class="fg-xs num bn-v">{{ pct1(b.banRate) }}<span class="u">%</span></span>
            <i class="bn-l"
              ><i :style="{ width: `${((b.banRate / topBan) * 100).toFixed(1)}%` }"
            /></i>
          </Link>
        </div>
      </section>

      <section class="sec" aria-labelledby="hm-app">
        <div class="promo">
          <div class="hm-promo">
            <Glyph :h="44" />
            <h2 id="hm-app" class="h1">Invade for desktop</h2>
            <p class="body">
              It opens with League, brings the build into champion select and scores each of your
              games out of 100.
            </p>
            <DownloadApp track="home" />
            <p class="meta hm-free">Free, no account needed.</p>
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

      <section class="sec cm hm-last" aria-label="Invade on Discord and X">
        <a
          class="cm-d"
          :href="DISCORD_URL"
          target="_blank"
          rel="noreferrer"
          data-track="home_discord"
        >
          <span class="cm-h"
            ><span class="cm-ico"><Icon name="discord" :size="24" /></span
            ><span class="col cm-n"
              ><b class="h2">Invade on Discord</b
              ><span class="meta">Bugs, ideas and games with other players</span></span
            ><span class="btn cm-b">Join<Icon name="external" :size="15" /></span
          ></span>
          <span v-if="discord" class="cm-s"
            ><span
              ><b class="fg-m num">{{ thousands(discord.members) }}</b
              >members</span
            ><span
              ><b class="fg-m num"><i class="dot" />{{ thousands(discord.online) }}</b
              >online now</span
            ></span
          >
          <span class="cm-l"
            ><span class="lab">Channels in</span>English, Français, Español, Português</span
          >
        </a>
        <a class="cm-x" :href="X_URL" target="_blank" rel="noreferrer" data-track="home_x">
          <span class="cm-h"
            ><span class="cm-ico x"
              ><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.17h1.7L7.4 4.74H5.58l11.09 14.43Z"
                /></svg></span
            ><span class="col cm-n"
              ><b class="h2">@invadedotlol</b><span class="meta">On X</span></span
            ><span class="btn cm-b">Follow<Icon name="external" :size="15" /></span
          ></span>
          <span class="cm-xp"
            >Patch day numbers, stat posters from our games, and each new version of the app.</span
          >
          <span class="cm-l"><span class="lab">Posts in</span>English</span>
        </a>
      </section>
    </div>
  </SiteLayout>
</template>
