<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { RefreshCw, X } from 'lucide-vue-next'
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
    record: [
      total === null ? `${rank.wins}W` : `${rank.wins}W ${rank.losses}L`,
      total ? `${Math.round((rank.wins / total) * 100)}%` : '',
    ]
      .filter(Boolean)
      .join(' · '),
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
</script>

<template>
  <article
    class="scout iv-panel"
    :class="{ row: layout === 'row' }"
    :aria-busy="entry.status === 'loading' || entry.syncing"
  >
    <header class="head">
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
          width="40"
          height="40"
          class="portrait"
        />
        <span v-else class="portrait iv-skel" :class="{ still: entry.status !== 'loading' }" />
        <span class="who">
          <span class="name">{{ name }}<span class="tag">#{{ tag }}</span></span>
          <span class="meta num">
            <template v-if="entry.summoner">
              {{ regionLabel(entry.summoner.platform) }}
              <template v-if="entry.summoner.summonerLevel">
                · Lv {{ entry.summoner.summonerLevel }}
              </template>
            </template>
            <template v-else-if="failure">{{ failure }}</template>
            <template v-else>&nbsp;</template>
          </span>
        </span>
      </component>
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
    </header>

    <template v-if="entry.status === 'loading'">
      <div class="block rank">
        <div class="iv-skel h-[34px] w-3/4" />
      </div>
      <div class="block roles">
        <div class="iv-skel h-[96px]" />
      </div>
      <div class="block champs space-y-1.5">
        <div v-for="i in 6" :key="i" class="iv-skel h-[26px]" />
      </div>
    </template>

    <template v-else-if="entry.status === 'ready'">
      <div class="block rank">
        <RankCrest :tier="solo?.tier ?? null" :size="34" />
        <div v-if="solo" class="min-w-0">
          <div class="tier" :style="{ color: tierColor(solo.tier) }">
            {{ solo.label }}&nbsp;<span class="lp num">{{ solo.lp }} LP</span>
          </div>
          <div class="meta num">{{ solo.record }}</div>
        </div>
        <div v-else>
          <div class="tier text-ink-3">Unranked</div>
          <div class="meta">Solo/Duo</div>
        </div>
      </div>

      <ul v-if="tags.length" class="block tags" aria-label="Notes">
        <li
          v-for="t in tags"
          :key="t.label"
          class="note"
          :class="t.tone"
          :title="t.detail"
          tabindex="0"
        >
          {{ t.label }}
        </li>
      </ul>

      <div v-if="empty" class="block roles empty">
        {{ entry.syncing ? 'Fetching their games…' : 'No games stored yet' }}
      </div>

      <section v-if="roles.length" class="block roles">
        <h3 class="label">{{ sample }}</h3>
        <ul class="role-list">
          <li v-for="role in roles" :key="role.lane" class="role">
            <RoleIcon :lane="role.lane" :size="15" class="role-icon" />
            <span class="role-name">{{ positionName(role.lane) }}</span>
            <span class="meter"><span :style="{ width: `${role.share}%` }" /></span>
            <span class="num role-games">{{ role.games }}</span>
            <span class="num role-wr" :class="{ quiet: role.games < 5 }">{{ role.winrate }}%</span>
          </li>
        </ul>
      </section>

      <section v-if="champions.length" class="block champs">
        <!-- A wide row has room for columns; a card stacks the figures under the name. -->
        <template v-if="layout === 'row'">
          <div class="cols label">
            <span>Champions</span>
            <span class="num">Games</span>
            <span class="num">KDA</span>
            <span class="num">Win</span>
          </div>
          <ul>
            <li v-for="champ in champions" :key="champ.championId" class="cols champ">
              <span class="champ-who">
                <ChampIcon :id="champ.championId" :size="22" />
                <span class="champ-name">{{ championName(champ.championId) }}</span>
              </span>
              <span class="num">{{ champ.games }}</span>
              <span class="num">{{ champ.kda }}</span>
              <span class="num champ-wr" :class="{ quiet: champ.games < 3 }">{{ champ.winrate }}%</span>
            </li>
          </ul>
        </template>
        <template v-else>
          <h3 class="label">Champions this season</h3>
          <ul>
            <li v-for="champ in champions" :key="champ.championId" class="stack">
              <ChampIcon :id="champ.championId" :size="26" />
              <span class="stack-text">
                <span class="champ-name">{{ championName(champ.championId) }}</span>
                <span class="stack-meta num">
                  {{ champ.games }} {{ champ.games === 1 ? 'game' : 'games' }} · {{ champ.kda }} KDA
                </span>
              </span>
              <span class="num champ-wr" :class="{ quiet: champ.games < 3 }">{{ champ.winrate }}%</span>
            </li>
          </ul>
        </template>
      </section>

      <section v-if="games.length" class="block games">
        <h3 class="label">Last {{ games.length }} games</h3>
        <ul>
          <li v-for="game in games" :key="game.gameId">
            <Link
              :href="`${href}/match/${game.matchId}`"
              class="game"
              :aria-label="`${championName(game.championId)}, ${game.win ? 'win' : 'loss'}, ${game.kills}/${game.deaths}/${game.assists}`"
            >
              <span class="result" :class="game.win ? 'win' : 'loss'">{{ game.win ? 'W' : 'L' }}</span>
              <ChampIcon :id="game.championId" :size="22" />
              <span class="num game-kda">
                {{ game.kills }}<span class="slash">/</span>{{ game.deaths }}<span class="slash">/</span>{{ game.assists }}
              </span>
              <span class="num game-ago">{{ timeAgo(game.creation) }}</span>
              <PerfDial :score="score(game.score?.score)" size="sm" />
            </Link>
          </li>
        </ul>
      </section>

      <footer v-if="mates.length || entry.note" class="block foot">
        <p v-for="mate in mates" :key="`${mate.gameName}#${mate.tagLine}`" class="mate">
          Played with <span class="text-ink">{{ mate.gameName }}</span>
          <span class="num text-ink-3"> · {{ mate.games }} {{ mate.games === 1 ? 'game' : 'games' }}</span>
        </p>
        <p v-if="entry.note" class="meta">{{ entry.note }}</p>
      </footer>
    </template>
  </article>
</template>

<style scoped>
.scout {
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: 0;
}

.head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 8px 8px 6px;
}

/* The whole identity opens the profile: a wash on hover, a chevron that brightens. */
.identity {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: var(--r-sm);
  transition: background-color var(--t-base) var(--ease);
}

.identity.linked:hover {
  background: var(--glint);
}

.identity.linked:focus-visible {
  outline: none;
  box-shadow: var(--focus);
}

.portrait {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: var(--r-sm);
  box-shadow: var(--portrait-sm);
}

.portrait.still {
  animation: none;
}

.who {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.name {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  line-height: 18px;
  color: var(--text-1);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag {
  font-weight: 400;
  color: var(--text-3);
}

.meta {
  font-size: 12px;
  line-height: 16px;
  color: var(--text-3);
}

.actions {
  display: flex;
  align-self: flex-start;
  margin-top: 4px;
}

.actions .iv-btn {
  color: var(--text-3);
}

.block {
  padding: 12px 14px;
  border-top: 1px solid var(--line);
}

.label {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}

.rank {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tier {
  font-size: 14px;
  font-weight: 600;
  line-height: 18px;
}

.lp {
  font-weight: 500;
  color: var(--text-2);
}

/* Notes: quiet chips; only a streak takes the result's colour. */
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-block: 10px;
}

.note {
  height: 24px;
  padding: 0 8px;
  border-radius: var(--r-sm);
  background: var(--surface-2);
  font-size: 12px;
  font-weight: 500;
  line-height: 24px;
  color: var(--text-1);
  white-space: nowrap;
  cursor: default;
}

.note:focus-visible {
  outline: none;
  box-shadow: var(--focus);
}

.note.win {
  color: var(--win);
  background: rgb(var(--win-rgb) / 0.12);
}

.note.loss {
  color: var(--loss);
  background: rgb(var(--loss-rgb) / 0.12);
}

.empty {
  font-size: 13px;
  color: var(--text-3);
}

.role-list {
  display: grid;
  gap: 4px;
}

.role {
  display: grid;
  grid-template-columns: 16px 58px minmax(0, 1fr) 30px 40px;
  align-items: center;
  gap: 8px;
  height: 26px;
}

.role-icon {
  color: var(--text-3);
}

.role-name {
  font-size: 13px;
  color: var(--text-2);
}

.role-games {
  text-align: right;
  font-size: 12px;
  color: var(--text-3);
}

.role-wr {
  text-align: right;
  font-size: 14px;
  font-weight: 650;
  color: var(--text-1);
}

.quiet {
  color: var(--text-3) !important;
}

.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40px 44px 40px;
  align-items: center;
  gap: 6px;
}

.cols > :not(:first-child) {
  text-align: right;
}

.champs ul {
  display: grid;
  gap: 2px;
}

.champ {
  height: 30px;
  font-size: 12.5px;
  color: var(--text-2);
}

.stack {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  height: 36px;
  font-size: 12.5px;
}

.stack-text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  line-height: 16px;
}

.stack-meta {
  overflow: hidden;
  font-size: 11.5px;
  line-height: 15px;
  color: var(--text-3);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.champ-who {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.champ-name {
  overflow: hidden;
  font-weight: 600;
  color: var(--text-1);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.champ-wr {
  font-weight: 650;
  color: var(--text-1);
}

.games {
  padding-inline: 8px;
}

.games .label {
  padding-inline: 6px;
}

.games ul {
  display: grid;
  gap: 1px;
}

.game {
  display: grid;
  grid-template-columns: 12px 22px minmax(0, 1fr) auto 30px;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 2px 0 6px;
  border-radius: var(--r-sm);
  font-size: 12.5px;
  transition: background-color var(--t-base) var(--ease);
}

.game:hover {
  background: var(--glint);
}

.game:focus-visible {
  outline: none;
  box-shadow: var(--focus);
}

.result {
  font-size: 11px;
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
  white-space: nowrap;
}

.slash {
  margin-inline: 2px;
  color: var(--text-4);
}

.game-ago {
  font-size: 11.5px;
  color: var(--text-3);
  white-space: nowrap;
}

.foot {
  display: grid;
  gap: 4px;
  margin-top: auto;
  font-size: 12px;
  color: var(--text-2);
}

.mate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* More than five players: one wide line each, read across like a scoreboard. */
@media (min-width: 64rem) {
  .row {
    display: grid;
    grid-template-columns: 250px minmax(0, 0.85fr) minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: auto auto auto 1fr;
    grid-template-areas:
      'head roles champs games'
      'rank roles champs games'
      'tags roles champs games'
      'foot roles champs games';
  }

  .row .head {
    grid-area: head;
  }

  .row .rank {
    grid-area: rank;
    border-top: 0;
    padding-top: 2px;
  }

  .row .tags {
    grid-area: tags;
    border-top: 0;
    padding-top: 0;
  }

  .row .foot {
    grid-area: foot;
    align-self: end;
    margin-top: 0;
  }

  .row .roles {
    grid-area: roles;
  }

  .row .champs {
    grid-area: champs;
  }

  .row .games {
    grid-area: games;
  }

  .row .roles,
  .row .champs,
  .row .games {
    border-top: 0;
    border-left: 1px solid var(--line);
    padding-top: 14px;
  }
}

@media (pointer: coarse) {
  .actions .iv-btn {
    width: 40px;
    height: 40px;
  }
}
</style>
