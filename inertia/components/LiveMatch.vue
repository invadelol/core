<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import PlayerLink from './PlayerLink.vue'
import {
  champIcon,
  championName,
  queueName,
  runeIcon,
  runeStyleIcon,
  spellIcon,
  TIER_NAMES,
} from '../lib/assets.js'
import { duration } from '../lib/format.js'
import type { LiveGame } from '../lib/types.js'

const props = defineProps<{ puuid: string; name: string }>()

const game = ref<LiveGame | null>(null)
const loading = ref(true)
const error = ref('')
const checkedAt = ref('')
const now = ref(Date.now())

let controller: AbortController | undefined
let clock: ReturnType<typeof setInterval> | undefined
let poll: ReturnType<typeof setTimeout> | undefined

async function refresh(background = false) {
  clearTimeout(poll)
  controller?.abort()
  controller = new AbortController()
  const signal = controller.signal
  if (!background) {
    loading.value = true
    error.value = ''
  }
  try {
    const response = await fetch(`/api/summoners/puuid/${props.puuid}/live`, {
      signal,
      cache: 'no-store',
    })
    if (!response.ok)
      throw new Error(
        response.status === 503
          ? 'Riot is temporarily unavailable. Try again shortly.'
          : "Could not check this player's live game."
      )
    const data = await response.json()
    if (signal.aborted) return
    error.value = ''
    game.value = data.game
    checkedAt.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch (e) {
    if (!signal.aborted) error.value = (e as Error).message
  } finally {
    if (!signal.aborted) {
      loading.value = false
      poll = setTimeout(() => {
        if (document.visibilityState === 'visible') void refresh(true)
      }, 30_000)
    }
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') void refresh(true)
}

/**
 * The poll, the clock and the listener are browser-only, so none of them may
 * start during SSR: a timer scheduled while rendering outlives the response
 * and fires inside the Node process, where `document` does not exist. That
 * throws outside any request, which takes the server down with it. The server
 * renders the loading state; the browser starts the polling.
 */
onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  clock = setInterval(() => (now.value = Date.now()), 1000)
  watch(
    () => props.puuid,
    () => {
      game.value = null
      void refresh()
    },
    { immediate: true }
  )
})

onBeforeUnmount(() => {
  controller?.abort()
  clearInterval(clock)
  clearTimeout(poll)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

const elapsed = computed(() =>
  game.value?.gameStartTime
    ? Math.max(0, Math.floor((now.value - game.value.gameStartTime) / 1000))
    : (game.value?.gameLength ?? 0)
)

/** "Name#Tag" as Riot sends it for a live lobby, split for linking. */
function split(riotId?: string) {
  const hash = riotId?.indexOf('#') ?? -1
  if (!riotId || hash < 1) return { gameName: riotId ?? '', tagLine: '' }
  return { gameName: riotId.slice(0, hash), tagLine: riotId.slice(hash + 1) }
}

const sides = computed(() =>
  [100, 200].map((teamId) => ({
    teamId,
    label: teamId === 100 ? 'Blue side' : 'Red side',
    color: teamId === 100 ? 'var(--color-blue)' : 'var(--color-red)',
    bans: (game.value?.bannedChampions ?? []).filter(
      (b) => b.teamId === teamId && b.championId > 0
    ),
    players: (game.value?.participants ?? []).filter((p) => p.teamId === teamId),
  }))
)
</script>

<template>
  <section>
    <div v-if="error" class="py-20 text-center" role="alert">
      <p class="text-[13px] font-medium text-ink">Unable to check live status</p>
      <p class="mx-auto mt-1.5 max-w-[44ch] text-[12px] text-ink-3">{{ error }}</p>
      <button class="btn btn-sm mt-4" @click="refresh()">Try again</button>
    </div>

    <div v-else-if="loading && !game" class="skel h-[420px]" />

    <div v-else-if="!game" class="py-24 text-center">
      <span class="pulse mx-auto mb-4 block !h-2 !w-2" />
      <p class="text-[14px] font-medium text-ink">No live match found for {{ name }}</p>
      <p class="mx-auto mt-2 max-w-[48ch] text-[12.5px] leading-relaxed text-ink-3">
        Riot hasn't returned an active match. We'll check again automatically every 30 seconds.
      </p>
      <button class="btn btn-sm mt-5" :disabled="loading" @click="refresh()">
        <RefreshCw :size="12" :class="{ 'animate-spin': loading }" />
        Check again
        <span v-if="checkedAt" class="text-ink-3">· {{ checkedAt }}</span>
      </button>
    </div>

    <template v-else>
      <div class="section">
        <h2>Live</h2>
        <span class="meta flex items-center gap-1.5">
          <span class="pulse" />
          {{ queueName(game.gameQueueConfigId) }}
        </span>
        <span class="num display ml-auto text-[18px] text-ink">{{ duration(elapsed) }}</span>
        <button class="btn btn-sm" :disabled="loading" @click="refresh()">
          <RefreshCw :size="12" :class="{ 'animate-spin': loading }" />
          Refresh
        </button>
      </div>

      <div class="grid gap-x-10 gap-y-8 lg:grid-cols-2">
        <div v-for="side in sides" :key="side.teamId">
          <div class="mb-3 flex items-center gap-2">
            <span class="h-3 w-[3px] rounded-full" :style="{ background: side.color }" />
            <span class="label !text-[9.5px]">{{ side.label }}</span>
            <span v-if="side.bans.length" class="ml-auto flex items-center gap-1.5">
              <span class="label !text-[9.5px]">Bans</span>
              <img
                v-for="(ban, i) in side.bans"
                :key="i"
                :src="champIcon(ban.championId)"
                :alt="championName(ban.championId)"
                :title="championName(ban.championId)"
                class="thumb h-[18px] w-[18px] rounded-[3px] opacity-45 grayscale"
              />
            </span>
          </div>

          <ul class="divide-y divide-line">
            <li
              v-for="(p, i) in side.players"
              :key="p.puuid ?? i"
              class="flex items-center gap-3 py-2.5"
              :class="p.puuid === puuid ? 'bg-raised' : ''"
            >
              <img
                :src="champIcon(p.championId)"
                :alt="championName(p.championId)"
                loading="lazy"
                class="thumb h-9 w-9 rounded-[7px]"
              />

              <span class="flex shrink-0 flex-col gap-[2px]">
                <img
                  :src="spellIcon(p.spell1Id)"
                  alt=""
                  class="thumb h-[16px] w-[16px] rounded-[3px]"
                />
                <img
                  :src="spellIcon(p.spell2Id)"
                  alt=""
                  class="thumb h-[16px] w-[16px] rounded-[3px]"
                />
              </span>

              <span class="flex shrink-0 items-center gap-1">
                <img
                  v-if="p.perks?.perkIds?.[0]"
                  :src="runeIcon(p.perks.perkIds[0])"
                  alt="Keystone"
                  class="glyph h-[20px] w-[20px]"
                />
                <img
                  v-if="p.perks?.perkSubStyle"
                  :src="runeStyleIcon(p.perks.perkSubStyle)"
                  alt="Secondary tree"
                  class="h-[14px] w-[14px]"
                />
              </span>

              <span class="min-w-0 flex-1">
                <PlayerLink
                  v-bind="split(p.riotId)"
                  class="text-[12.5px]"
                  :is-self="p.puuid === puuid"
                />
                <span class="num block truncate text-[10.5px] text-ink-3">
                  {{ championName(p.championId) }}
                  <template v-if="p.championStats">
                    <span class="text-ink-4">·</span>
                    {{ p.championStats.games }} tracked ·
                    {{ Math.round(p.championStats.winrate * 100) }}% WR
                  </template>
                </span>
              </span>

              <span v-if="p.rank" class="num shrink-0 text-right text-[11px]">
                <span class="block text-ink-2">
                  {{ TIER_NAMES[p.rank.tier] || p.rank.tier }} {{ p.rank.division }}
                </span>
                <span class="block text-ink-4">{{ p.rank.leaguePoints }} LP</span>
              </span>
              <span v-else class="shrink-0 text-[11px] text-ink-4">Unranked</span>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </section>
</template>
