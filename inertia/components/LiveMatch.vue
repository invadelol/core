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
  rankCrest,
  rankName,
  spellIcon,
  tierColor,
} from '../lib/assets.js'
import { duration, UI_LOCALE } from '../lib/format.js'
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
    checkedAt.value = new Date().toLocaleTimeString(UI_LOCALE, {
      hour: 'numeric',
      minute: '2-digit',
    })
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

/** The viewed player's team first, in blue; the enemy in red. */
const allyTeam = computed(
  () => game.value?.participants.find((p) => p.puuid === props.puuid)?.teamId ?? 100
)

const sides = computed(() =>
  [allyTeam.value, allyTeam.value === 100 ? 200 : 100].map((teamId) => ({
    teamId,
    label: teamId === allyTeam.value ? `${props.name}'s team` : 'Enemy team',
    side: teamId === 100 ? 'Blue side' : 'Red side',
    color: teamId === allyTeam.value ? 'var(--color-win)' : 'var(--color-loss)',
    bans: (game.value?.bannedChampions ?? []).filter(
      (b) => b.teamId === teamId && b.championId > 0
    ),
    players: (game.value?.participants ?? []).filter((p) => p.teamId === teamId),
  }))
)
</script>

<template>
  <section>
    <p v-if="error" class="notice" role="alert">
      <span>{{ error }}</span>
      <button class="btn btn-sm ml-auto" @click="refresh()">Retry</button>
    </p>

    <div v-else-if="loading && !game" class="grid gap-3 lg:grid-cols-2">
      <div class="skel h-[360px]" />
      <div class="skel h-[360px]" />
    </div>

    <div v-else-if="!game" class="flex flex-wrap items-center gap-x-4 gap-y-3 py-2">
      <p class="text-[13px] text-ink-2">
        {{ name }} is not in a game right now.
        <span class="text-ink-3">Checked again every 30 seconds.</span>
      </p>
      <button class="btn btn-sm" :disabled="loading" @click="refresh()">
        <RefreshCw :size="12" :class="{ 'animate-spin': loading }" />
        Check now
        <span v-if="checkedAt" class="font-medium text-ink-3">· last {{ checkedAt }}</span>
      </button>
    </div>

    <template v-else>
      <div class="section !items-center">
        <h2 class="flex items-center gap-2"><span class="pulse" />Live game</h2>
        <span class="meta">{{ queueName(game.gameQueueConfigId) }}</span>
        <span class="fig ml-auto text-[22px] text-ink">{{ duration(elapsed) }}</span>
        <button class="btn btn-sm" :disabled="loading" @click="refresh()">
          <RefreshCw :size="12" :class="{ 'animate-spin': loading }" />
          Refresh
        </button>
      </div>

      <div class="grid gap-3 lg:grid-cols-2">
        <!-- One panel per team: a thin rule says which side is whose -->
        <section
          v-for="side in sides"
          :key="side.teamId"
          class="card"
          :style="{ boxShadow: `inset 0 2px 0 ${side.color}` }"
        >
          <div class="section !items-center">
            <h3>{{ side.label }}</h3>
            <span class="meta">{{ side.side }}</span>
            <span v-if="side.bans.length" class="ml-auto flex items-center gap-1">
              <span class="mr-1 text-[12px] text-ink-3">Bans</span>
              <img
                v-for="(ban, i) in side.bans"
                :key="i"
                :src="champIcon(ban.championId)"
                :alt="championName(ban.championId)"
                :title="championName(ban.championId)"
                class="thumb h-[18px] w-[18px] rounded-[3px] opacity-40 grayscale"
              />
            </span>
          </div>

          <ul class="!px-0 !pb-1.5">
            <li
              v-for="(p, i) in side.players"
              :key="p.puuid ?? i"
              class="flex h-[56px] items-center gap-3 border-t border-line px-4"
              :class="
                p.puuid === puuid
                  ? 'bg-[rgb(var(--brand-rgb)/0.08)] shadow-[inset_2px_0_0_var(--color-brand)]'
                  : ''
              "
            >
              <span class="portrait h-10 w-10">
                <img
                  :src="champIcon(p.championId)"
                  :alt="championName(p.championId)"
                  loading="lazy"
                />
              </span>

              <span
                class="grid shrink-0 grid-cols-[18px_18px] grid-rows-[18px_18px] place-items-center gap-[2px]"
              >
                <img
                  :src="spellIcon(p.spell1Id)"
                  alt=""
                  class="thumb h-[18px] w-[18px] rounded-[3px]"
                />
                <img
                  v-if="p.perks?.perkIds?.[0]"
                  :src="runeIcon(p.perks.perkIds[0])"
                  alt="Keystone"
                  class="h-[18px] w-[18px]"
                />
                <i v-else />
                <img
                  :src="spellIcon(p.spell2Id)"
                  alt=""
                  class="thumb h-[18px] w-[18px] rounded-[3px]"
                />
                <img
                  v-if="p.perks?.perkSubStyle"
                  :src="runeStyleIcon(p.perks.perkSubStyle)"
                  alt="Secondary tree"
                  class="h-[13px] w-[13px] opacity-85"
                />
              </span>

              <span class="min-w-0 flex-1">
                <PlayerLink
                  v-bind="split(p.riotId)"
                  class="max-w-full text-[13px]"
                  :is-self="p.puuid === puuid"
                />
                <span class="num block truncate text-[12px] text-ink-3">
                  {{ championName(p.championId) }}
                  <template v-if="p.championStats">
                    <span class="text-ink-4">·</span>
                    <span class="text-ink-2">{{ Math.round(p.championStats.winrate * 100) }}%</span>
                    in {{ p.championStats.games }}
                    {{ p.championStats.games === 1 ? 'game' : 'games' }}
                  </template>
                </span>
              </span>

              <span v-if="p.rank" class="flex shrink-0 items-center gap-2 text-right">
                <span>
                  <span
                    class="block text-[13px] font-semibold leading-[17px]"
                    :style="{ color: tierColor(p.rank.tier) }"
                  >
                    {{ rankName(p.rank.tier, p.rank.division) }}
                  </span>
                  <span class="num block text-[12px] leading-4 text-ink-3">
                    {{ p.rank.leaguePoints }} LP
                  </span>
                </span>
                <img :src="rankCrest(p.rank.tier)" alt="" class="h-7 w-7" />
              </span>
              <span v-else class="shrink-0 text-[12px] text-ink-3">Unranked</span>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </section>
</template>
