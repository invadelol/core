<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { ChevronDown, RefreshCw, X } from 'lucide-vue-next'
import { ChampIcon, PerfDial, RankCrest, RoleIcon } from '@invadelol/ui'
import {
  positionName,
  positionOf,
  rankFromCore,
  rankLabel,
  tierColor,
  type Position,
} from '@invadelol/ui/logic'
import { championName, profileIcon, regionLabel } from '../../lib/assets.js'
import FormStrip from '../ui/FormStrip.vue'
import WinLoss from '../ui/WinLoss.vue'
import { profilePath, timeAgo } from '../../lib/format.js'
import { scoutTags, type Scout, type Season } from '../../lib/scout.js'
import type { RiotIdentity } from '../../lib/multisearch.js'
import type { RanksPayload, Summoner } from '../../lib/types.js'

export interface ScoutEntry {
  key: string
  identity: RiotIdentity
  status: 'loading' | 'ready' | 'not-found' | 'riot-unavailable' | 'error'
  /** Asking Riot for the player's newest games. */
  syncing: boolean
  summoner: Summoner | null
  ranks: RanksPayload | null
  /** Champions and positions over the season. */
  season: Season | null
  /** The latest games. */
  scout: Scout | null
  /** A short line after an update ("Riot rate limit reached…"). */
  note: string | null
}

const props = defineProps<{
  entry: ScoutEntry
  /** Others of this search seen in the player's stored games. */
  mates: Array<{ gameName: string; tagLine: string; games: number }>
  /** `row`: one wide line per player, for a search of more than five (from 64rem). */
  layout?: 'card' | 'row'
}>()

defineEmits<{ refresh: []; remove: [] }>()

const name = computed(() => props.entry.summoner?.gameName ?? props.entry.identity.gameName)
const tag = computed(() => props.entry.summoner?.tagLine ?? props.entry.identity.tagLine)
const href = computed(() => profilePath(name.value, tag.value))

const solo = computed(() => {
  const rank = props.entry.ranks?.current?.find((r) => r.queueType === 'RANKED_SOLO_5x5' && r.tier)
  if (!rank) return null
  const total = rank.losses === null || rank.losses === undefined ? null : rank.wins + rank.losses
  return {
    tier: rank.tier,
    label: rankLabel(rankFromCore(rank), false),
    lp: rank.leaguePoints,
    wins: rank.wins,
    losses: rank.losses ?? null,
    record: [
      total === null ? `${rank.wins}W` : `${rank.wins}W ${rank.losses}L`,
      total ? `${Math.round((rank.wins / total) * 100)}%` : '',
    ]
      .filter(Boolean)
      .join(', '),
  }
})

const sample = computed(() =>
  props.entry.season?.queue === 'rift' ? 'All games this season' : 'Solo/Duo this season'
)

/** Every position played this season, most played first, as a share of the most played. */
const roles = computed(() => {
  const list = (props.entry.season?.roles ?? [])
    .map((r) => ({ lane: positionOf(r.role), games: r.games, wins: r.wins }))
    .filter((r): r is { lane: Position; games: number; wins: number } => Boolean(r.lane))
  const top = Math.max(1, ...list.map((r) => r.games))
  return list.map((r) => ({
    ...r,
    share: (r.games / top) * 100,
    winrate: Math.round((r.wins / r.games) * 100),
  }))
})

const champions = computed(() =>
  (props.entry.season?.champions ?? []).slice(0, 10).map((c) => ({
    championId: c.championId,
    games: c.games,
    kda: c.deaths ? ((c.kills + c.assists) / c.deaths).toFixed(1) : 'Perfect',
    winrate: Math.round((c.wins / c.games) * 100),
  }))
)

const games = computed(() => (props.entry.scout?.recent ?? []).slice(0, 10))

const tags = computed(() => scoutTags(props.entry.season, props.entry.scout, championName))

const empty = computed(() => !champions.value.length && !games.value.length)

const failure = computed(() => {
  switch (props.entry.status) {
    case 'not-found':
      return 'No player with this Riot ID'
    case 'riot-unavailable':
      return 'Riot is not answering right now'
    case 'error':
      return 'Could not load this player'
    default:
      return ''
  }
})

const score = (value: number | undefined) => (value === undefined ? null : Math.round(value * 10))

/** The two roles played most, with their share of the season's games. */
const mainRoles = computed(() => {
  const total = roles.value.reduce((n, r) => n + r.games, 0)
  return [...roles.value]
    .sort((a, b) => b.games - a.games)
    .slice(0, 2)
    .map((r) => ({ ...r, part: total ? Math.round((r.games / total) * 100) : 0 }))
})
/** The last games as a strip, oldest on the left. */
const form = computed(() => [...(props.entry.scout?.results ?? [])].slice(0, 10).reverse())
const formLine = computed(() => {
  const f = props.entry.scout
  if (!f || !f.results.length) return ''
  const last = f.results.slice(0, 10)
  if (f.streak >= 3) return `${f.streak} wins in a row`
  if (f.streak <= -3) return `${-f.streak} losses in a row`
  return `Won ${last.filter(Boolean).length} of ${last.length}`
})
const seasonGames = computed(() =>
  solo.value && solo.value.losses !== null ? solo.value.wins + solo.value.losses : null
)
const wrClass = (games: number, rate: number) =>
  games < 3 ? 'quiet' : rate >= 55 ? 'up' : rate < 48 ? 'dn' : ''
</script>

<template>
  <article
    class="scout rd-card"
    :class="{
      row: layout === 'row',
      hot: entry.status === 'ready' && tags.some((t) => t.label.startsWith('<3')),
    }"
    :aria-busy="entry.status === 'loading' || entry.syncing"
  >
    <header class="head">
      <div class="actions">
        <button
          v-if="entry.status === 'ready'"
          type="button"
          class="iv-btn ghost sm icon-only"
          :disabled="entry.syncing"
          :aria-label="`Update ${name}`"
          title="Update"
          @click="$emit('refresh')"
        >
          <RefreshCw :size="14" :class="{ 'animate-spin': entry.syncing }" />
        </button>
        <button
          type="button"
          class="iv-btn ghost sm icon-only"
          :aria-label="`Remove ${name}`"
          title="Remove"
          @click="$emit('remove')"
        >
          <X :size="14" />
        </button>
      </div>
      <component
        :is="entry.status === 'ready' ? Link : 'div'"
        :href="entry.status === 'ready' ? href : undefined"
        class="identity"
        :class="{ linked: entry.status === 'ready' }"
        :title="entry.status === 'ready' ? `Open ${name}#${tag}'s profile` : undefined"
      >
        <img
          v-if="entry.summoner"
          :src="profileIcon(entry.summoner.profileIconId)"
          alt=""
          width="64"
          height="64"
          class="portrait"
        />
        <span v-else class="portrait iv-skel" :class="{ still: entry.status !== 'loading' }" />
        <b class="name"
          >{{ name }} <span class="tag">#{{ tag }}</span></b
        >
      </component>
      <span v-if="entry.status === 'ready' && solo" class="rk">
        <RankCrest :tier="solo.tier" :size="18" />
        <span :style="{ color: tierColor(solo.tier) }">{{ solo.label }}</span>
        <span class="lp num">{{ solo.lp }} LP</span>
      </span>
      <span v-else-if="entry.status === 'ready'" class="rk quiet">Unranked</span>
      <span v-else class="meta num">
        <template v-if="failure">{{ failure }}</template>
        <template v-else-if="entry.status === 'loading'">Loading</template>
      </span>
      <span v-if="entry.summoner" class="meta num"
        >{{ regionLabel(entry.summoner.platform)
        }}<template v-if="entry.summoner.summonerLevel"
          >, level {{ entry.summoner.summonerLevel }}</template
        ></span
      >
      <ul v-if="entry.status === 'ready' && tags.length" class="tags" aria-label="Notes">
        <li
          v-for="t in tags"
          :key="t.label"
          class="rd-tag"
          :class="
            t.tone === 'win' ? 'b' : t.tone === 'loss' ? 'r' : t.label.startsWith('<3') ? 'v' : ''
          "
          :title="t.detail"
          tabindex="0"
        >
          {{ t.label.startsWith('<3') ? `${t.label.slice(3)} main` : t.label }}
        </li>
      </ul>
    </header>

    <template v-if="entry.status === 'loading'">
      <div class="block"><div class="iv-skel h-[30px]" /></div>
      <div class="block"><div class="iv-skel h-[40px]" /></div>
      <div class="block space-y-1.5">
        <div v-for="i in 3" :key="i" class="iv-skel h-[32px]" />
      </div>
    </template>

    <template v-else-if="entry.status === 'ready'">
      <div v-if="solo && solo.losses !== null" class="block season">
        <h3 class="label">
          <span>Season</span><span class="num">{{ seasonGames }} games</span>
        </h3>
        <WinLoss :wins="solo.wins" :losses="solo.losses" />
      </div>

      <div v-if="empty" class="block empty">
        {{ entry.syncing ? 'Fetching their games' : 'No games stored yet' }}
      </div>

      <section v-if="mainRoles.length" class="block plays">
        <h3 class="label">
          <span>Plays</span><span>{{ sample }}</span>
        </h3>
        <div class="rol">
          <span
            v-for="r in mainRoles"
            :key="r.lane"
            :title="`${r.games} games, ${r.winrate}% win rate`"
            ><RoleIcon :lane="r.lane" :size="15" />{{ positionName(r.lane) }}
            <span class="num">{{ r.part }}%</span></span
          >
        </div>
        <details v-if="roles.length > 2" class="more">
          <summary>Every role<ChevronDown :size="12" aria-hidden="true" /></summary>
          <ul class="role-list">
            <li v-for="role in roles" :key="role.lane" class="role">
              <RoleIcon :lane="role.lane" :size="14" />
              <span class="role-name">{{ positionName(role.lane) }}</span>
              <span class="rd-bar quiet meter"><i :style="{ width: `${role.share}%` }" /></span>
              <span class="num role-games">{{ role.games }}</span>
              <span class="num role-wr" :class="{ quiet: role.games < 5 }"
                >{{ role.winrate }}%</span
              >
            </li>
          </ul>
        </details>
      </section>

      <section v-if="champions.length" class="block champs">
        <h3 class="label"><span>Most played</span><span>Win rate</span></h3>
        <div v-for="champ in champions.slice(0, 3)" :key="champ.championId" class="cpr">
          <ChampIcon :id="champ.championId" :size="30" />
          <span class="min-w-0"
            ><b>{{ championName(champ.championId) }}</b
            ><small class="num"
              >{{ champ.games }} {{ champ.games === 1 ? 'game' : 'games' }},
              {{ champ.kda }} KDA</small
            ></span
          >
          <em class="num" :class="wrClass(champ.games, champ.winrate)">{{ champ.winrate }}%</em>
        </div>
        <details v-if="champions.length > 3" class="more">
          <summary>
            {{ champions.length - 3 }} more<ChevronDown :size="12" aria-hidden="true" />
          </summary>
          <div v-for="champ in champions.slice(3)" :key="champ.championId" class="cpr">
            <ChampIcon :id="champ.championId" :size="30" />
            <span class="min-w-0"
              ><b>{{ championName(champ.championId) }}</b
              ><small class="num"
                >{{ champ.games }} {{ champ.games === 1 ? 'game' : 'games' }},
                {{ champ.kda }} KDA</small
              ></span
            >
            <em class="num" :class="wrClass(champ.games, champ.winrate)">{{ champ.winrate }}%</em>
          </div>
        </details>
      </section>

      <section v-if="games.length" class="block games">
        <h3 class="label">
          <span>Last {{ form.length }}</span
          ><span class="num">{{ formLine }}</span>
        </h3>
        <FormStrip :results="form" tall />
        <details class="more">
          <summary>The games<ChevronDown :size="12" aria-hidden="true" /></summary>
          <ul>
            <li v-for="game in games" :key="game.gameId">
              <Link
                :href="`${href}/match/${game.matchId}`"
                class="game"
                :aria-label="`${championName(game.championId)}, ${game.win ? 'win' : 'loss'}, ${game.kills}/${game.deaths}/${game.assists}`"
              >
                <span class="result" :class="game.win ? 'win' : 'loss'">{{
                  game.win ? 'W' : 'L'
                }}</span>
                <ChampIcon :id="game.championId" :size="22" />
                <span class="num game-kda">
                  {{ game.kills }}<span class="slash">/</span>{{ game.deaths
                  }}<span class="slash">/</span>{{ game.assists }}
                </span>
                <span class="num game-ago">{{ timeAgo(game.creation) }}</span>
                <PerfDial :score="score(game.score?.score)" size="sm" />
              </Link>
            </li>
          </ul>
        </details>
      </section>

      <footer v-if="mates.length || entry.note" class="block foot">
        <p v-for="mate in mates" :key="`${mate.gameName}#${mate.tagLine}`" class="mate">
          Played with <b>{{ mate.gameName }}</b
          ><span class="num">, {{ mate.games }} {{ mate.games === 1 ? 'game' : 'games' }}</span>
        </p>
        <p v-if="entry.note" class="meta">{{ entry.note }}</p>
      </footer>
    </template>
  </article>
</template>

<style scoped>
.scout {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.scout.hot {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--rd-violet) 45%, transparent);
}

.head {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 18px 16px 14px;
  text-align: center;
  background: linear-gradient(180deg, var(--surface-1), transparent);
}

.actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
}

.actions .iv-btn {
  color: var(--text-3);
}

.identity {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  padding: 4px 8px;
  border-radius: 8px;
}

.identity.linked:hover .name {
  color: var(--rd-violet-hi);
}

.identity.linked:focus-visible {
  outline: none;
  box-shadow: var(--focus);
}

.portrait {
  display: block;
  width: 64px;
  height: 64px;
  border-radius: 14px;
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.12);
}

.portrait.still {
  animation: none;
}

.name {
  display: block;
  max-width: 100%;
  margin-top: 10px;
  overflow: hidden;
  font-size: 15px;
  font-weight: 650;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-1);
}

.tag {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-3);
}

.rk {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 650;
}

.rk.quiet {
  color: var(--text-3);
}

.lp {
  font-weight: 500;
  color: var(--text-3);
}

.meta {
  min-height: 16px;
  font-size: 12px;
  color: var(--text-3);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  min-height: 20px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.tags li {
  cursor: default;
}

.tags li:focus-visible {
  outline: none;
  box-shadow: var(--focus);
}

.block {
  padding: 14px 16px;
  box-shadow: inset 0 1px 0 var(--rd-line);
}

.label {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-3);
}

.empty {
  font-size: 12px;
  color: var(--text-3);
}

.rol {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

.rol > span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.rol > span + span {
  font-weight: 500;
  color: var(--text-3);
}

.rol .num {
  font-weight: 500;
  color: var(--text-3);
}

.cpr {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 40px;
}

.cpr :deep(.iv-champ) {
  border-radius: 7px;
}

.cpr b {
  display: block;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-1);
}

.cpr small {
  display: block;
  font-size: 11px;
  color: var(--text-3);
}

.cpr em {
  font-size: 13px;
  font-style: normal;
  font-weight: 650;
  color: var(--text-1);
}

.cpr em.up {
  color: var(--win);
}

.cpr em.dn {
  color: var(--loss);
}

.cpr em.quiet {
  color: var(--text-3);
}

.more {
  margin-top: 6px;
}

.more summary {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--rd-violet-hi);
  list-style: none;
  cursor: pointer;
  border-radius: 4px;
}

.more summary::-webkit-details-marker {
  display: none;
}

.more summary:focus-visible {
  outline: none;
  box-shadow: var(--focus);
}

.more[open] summary svg {
  transform: rotate(180deg);
}

.role-list {
  display: grid;
  gap: 6px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.role {
  display: grid;
  grid-template-columns: 14px 56px minmax(0, 1fr) 28px 34px;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-2);
}

.role-games,
.role-wr {
  text-align: right;
}

.role-wr.quiet {
  color: var(--text-3);
}

.games ul {
  display: grid;
  gap: 2px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.game {
  display: grid;
  grid-template-columns: 16px 22px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 4px;
  font-size: 12px;
  color: var(--text-2);
  border-radius: 6px;
}

.game:hover {
  background: var(--surface-1);
}

.game:focus-visible {
  outline: none;
  box-shadow: var(--focus);
}

.result {
  font-weight: 700;
}

.result.win {
  color: var(--win);
}

.result.loss {
  color: var(--loss);
}

.game-kda {
  font-weight: 600;
  color: var(--text-1);
}

.slash {
  margin: 0 2px;
  color: var(--text-4);
}

.game-ago {
  color: var(--text-3);
}

.foot {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: var(--text-3);
}

.mate b {
  font-weight: 600;
  color: var(--text-1);
}

/* More than five players, from 64rem: each player one wide row. */
@media (min-width: 64rem) {
  .scout.row {
    display: grid;
    grid-template-columns: 220px repeat(4, minmax(0, 1fr));
    align-items: stretch;
  }

  .scout.row .head {
    grid-row: span 2;
    justify-content: center;
  }

  .scout.row .block {
    box-shadow: inset 1px 0 0 var(--rd-line);
  }

  .scout.row .foot {
    grid-column: 2 / -1;
    box-shadow:
      inset 1px 0 0 var(--rd-line),
      inset 0 1px 0 var(--rd-line);
  }
}
</style>
