<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import Icon from '../../ui/Icon.vue'
import Frame from '../../ui/Frame.vue'
import EmptyState from '../../ui/EmptyState.vue'
import ProPic from '../../pros/ProPic.vue'
import GameDetail from '../../profile/GameDetail.vue'
import { champIcon, assetUrl } from '../../../lib/assets.js'
import { profilePath } from '../../../lib/format.js'
import { afterPaint } from '../../../lib/after_paint.js'
import type { ChampionNames, ProGame, StoredGame } from './types.js'

/**
 * A pro's solo queue games of every account, newest first, each opening in place under its line
 * like a profile's. `limit` lines show first, the rest one tap away; `items` adds the build.
 */
const props = withDefaults(
  defineProps<{
    games: ProGame[]
    stored: StoredGame[]
    names: ChampionNames
    limit?: number
    items?: boolean
    /** Other pros' faces drawn on a line before "+N". */
    faces?: number
    /** Keys the open game to a pro: another pro, nothing stays open. */
    slug: string
  }>(),
  { limit: 20, items: false, faces: 4 }
)

const withPros = ref(false)
const all = ref(false)
const list = computed(() => props.games.filter((g) => !withPros.value || (g.pros?.length ?? 0) > 0))
const shownGames = computed(() => (all.value ? list.value : list.value.slice(0, props.limit)))
const nameOf = (id: number | null) => (id ? (props.names[id]?.[0] ?? '') : '')
const when = (ms: number) => {
  const d = new Date(ms)
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const kda = (g: { kills: number; deaths: number; assists: number }) =>
  ((g.kills + g.assists) / Math.max(1, g.deaths)).toFixed(2)
const gamePath = (g: ProGame) => {
  const at = g.account.lastIndexOf('#')
  return at > 0
    ? `${profilePath(g.account.slice(0, at), g.account.slice(at + 1))}/match/${g.matchId}`
    : null
}

/** The other pros of a game, those with a photo first, as many as `faces`. */
const facesOf = (g: ProGame) =>
  [...(g.pros ?? [])]
    .sort((a, b) => Number(Boolean(b.pro.photo)) - Number(Boolean(a.pro.photo)))
    .slice(0, props.faces)

const stored = computed(() => new Map(props.stored.map((g) => [g.match.matchId, g])))
const open = shallowRef<string | null>(null)
const shown = shallowRef<string | null>(null)
function openGame(event: MouseEvent, g: ProGame) {
  if (!stored.value.has(g.matchId)) return
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  const next = open.value === g.matchId ? null : g.matchId
  open.value = next
  if (!next) return void (shown.value = null)
  afterPaint(() => open.value === next && (shown.value = next))
}
watch(
  () => props.slug,
  () => {
    open.value = null
    shown.value = null
    all.value = false
  }
)
</script>

<template>
  <div class="card pp-games">
    <div class="card-h">
      <Icon name="chart" />
      <h2 class="h3">Solo queue</h2>
      <span class="meta">{{ games.length }} games, every account</span>
      <span class="seg" style="margin-left: auto">
        <button type="button" :class="{ on: !withPros }" @click="withPros = false">All</button>
        <button type="button" :class="{ on: withPros }" @click="withPros = true">With pros</button>
      </span>
    </div>
    <div
      v-for="g in shownGames"
      :key="g.matchId"
      class="sq-g"
      :class="{ open: open === g.matchId }"
    >
      <component
        :is="gamePath(g) ? 'a' : 'div'"
        class="sq pp-sq"
        :class="[g.win ? 'w' : 'l', { it: items }]"
        :href="gamePath(g) ?? undefined"
        :aria-expanded="stored.has(g.matchId) ? open === g.matchId : undefined"
        @click="openGame($event, g)"
      >
        <Frame :src="champIcon(g.champion)" size="s" :alt="nameOf(g.champion)" />
        <span class="col">
          <span class="res">{{ g.win ? 'Win' : 'Loss' }}</span>
          <span class="meta">{{ when(g.startMs) }}</span>
        </span>
        <span class="col">
          <span class="kda"
            >{{ g.kills }}<span class="sl">/</span><span class="d">{{ g.deaths }}</span
            ><span class="sl">/</span>{{ g.assists }}</span
          >
          <span class="meta">{{ kda(g) }} KDA</span>
        </span>
        <span class="col" style="min-width: 0">
          <span class="h5 num"
            >{{ g.durationSec ? (g.cs / (g.durationSec / 60)).toFixed(1) : '-' }}
            <span class="meta">CS/min</span></span
          >
          <span class="meta num">{{ clock(g.durationSec) }}</span>
        </span>
        <span v-if="items" class="sq-it">
          <template v-for="(it, k) in g.items.slice(0, 6)" :key="k"
            ><img v-if="it" :src="assetUrl('item', it)" alt="" loading="lazy" /><i v-else></i
          ></template>
        </span>
        <span class="faces2" :title="(g.pros ?? []).map((p) => p.pro.name).join(', ')">
          <span
            v-for="p in facesOf(g)"
            :key="p.pro.slug"
            :class="{ en: !p.ally }"
            :title="`${p.pro.name}, ${p.ally ? 'on their side' : 'against them'}`"
            ><ProPic :slug="p.pro.slug" :photo="p.pro.photo" :team="p.pro.team" :size="32"
          /></span>
          <b v-if="(g.pros?.length ?? 0) > faces" class="pp-plus"
            >+{{ (g.pros?.length ?? 0) - faces }}</b
          >
        </span>
      </component>
      <GameDetail
        v-if="shown === g.matchId && stored.get(g.matchId)"
        :match="stored.get(g.matchId)!.match"
        :puuid="stored.get(g.matchId)!.puuid"
        :game-name="stored.get(g.matchId)!.gameName"
        :tag-line="stored.get(g.matchId)!.tagLine"
      />
    </div>
    <EmptyState
      v-if="!shownGames.length"
      compact
      icon="chart"
      :title="
        withPros ? 'No game with another pro in 30 days' : 'No stored solo queue game in 30 days'
      "
    />
    <button
      v-if="!all && list.length > shownGames.length"
      type="button"
      class="more pp-more"
      @click="all = true"
    >
      {{ list.length - shownGames.length }} more games<Icon name="chev" />
    </button>
  </div>
</template>
