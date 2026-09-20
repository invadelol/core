<script setup lang="ts">
import { ref, watch, onBeforeUnmount, computed } from 'vue'
import { Radio, RefreshCw, Clock3 } from 'lucide-vue-next'
import {
  championName,
  championSplash,
  spellIcon,
  runeIcon,
  runeStyleIcon,
  queueName,
  champIcon,
  TIER_NAMES,
} from '../lib/assets.js'
import type { LiveGame } from '../lib/types.js'
const props = defineProps<{ puuid: string; name: string }>()
const game = ref<LiveGame | null>(null)
const loading = ref(true)
const error = ref('')
const checked = ref('')
let controller: AbortController | undefined
let timer: ReturnType<typeof setInterval> | undefined
async function refresh() {
  controller?.abort()
  controller = new AbortController()
  const signal = controller.signal
  loading.value = true
  error.value = ''
  try {
    const response = await fetch(`/api/summoners/puuid/${props.puuid}/live`, { signal })
    if (!response.ok)
      throw new Error(
        response.status === 503
          ? 'Riot is temporarily unavailable. Please try again shortly.'
          : 'Could not check this player’s live game.'
      )
    const data = await response.json()
    if (signal.aborted) return
    game.value = data.game
    checked.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch (e) {
    if (!signal.aborted) error.value = (e as Error).message
  } finally {
    if (!signal.aborted) loading.value = false
  }
}
watch(
  () => props.puuid,
  () => {
    game.value = null
    void refresh()
  },
  { immediate: true }
)
const now = ref(Date.now())
timer = setInterval(() => {
  now.value = Date.now()
}, 1000)
onBeforeUnmount(() => {
  controller?.abort()
  clearInterval(timer)
})
const elapsed = computed(() =>
  game.value?.gameStartTime
    ? Math.max(0, Math.floor((now.value - game.value.gameStartTime) / 1000))
    : (game.value?.gameLength ?? 0)
)
</script>
<template>
  <section class="space-y-5">
    <div class="section-intro">
      <div>
        <span class="eyebrow">ON THE RIFT, RIGHT NOW</span>
        <h2>Live game <Radio :size="22" /></h2>
        <p>See the lineup, summoner spells, and rune choices before the next play.</p>
      </div>
      <button class="btn" :disabled="loading" @click="refresh">
        <RefreshCw :size="14" :class="{ 'animate-spin': loading }" />{{
          loading ? 'Checking…' : 'Refresh live game'
        }}
      </button>
    </div>
    <div v-if="error" class="card live-empty" role="alert">
      <Radio :size="35" />
      <h3>Unable to check live status</h3>
      <p>{{ error }}</p>
      <button class="btn" @click="refresh">Try again</button>
    </div>
    <div
      v-else-if="loading && !game"
      class="skel h-96"
      role="status"
      aria-label="Checking live game"
    />
    <div v-else-if="!game" class="card live-empty">
      <div class="live-empty-icon"><Radio :size="32" /></div>
      <span class="eyebrow">BETWEEN GAMES</span>
      <h3>{{ name }} isn’t in a live game</h3>
      <p>
        When they enter a supported match, their team and opponents will appear here. Refresh after
        the game begins.
      </p>
      <span class="subtle"><Clock3 :size="13" /> Checked at {{ checked }}</span>
    </div>
    <template v-else
      ><div class="live-game-heading">
        <span><i class="live-dot" /> IN PROGRESS · {{ queueName(game.gameQueueConfigId) }}</span
        ><strong class="num"
          >{{ Math.floor(elapsed / 60) }}:{{ String(elapsed % 60).padStart(2, '0') }}</strong
        >
      </div>
      <div v-for="teamId in [100, 200]" :key="teamId" class="space-y-3">
        <div class="live-team-title">
          <h3 :class="teamId === 100 ? 'text-win' : 'text-loss'">
            {{ teamId === 100 ? 'Blue side' : 'Red side' }}
          </h3>
          <div>
            <span class="subtle">Bans</span
            ><img
              v-for="(ban, i) in game.bannedChampions.filter(
                (b) => b.teamId === teamId && b.championId > 0
              )"
              :key="i"
              :src="champIcon(ban.championId)"
              :alt="championName(ban.championId)"
              :title="championName(ban.championId)"
            />
          </div>
        </div>
        <div class="live-lineup">
          <article
            v-for="(p, i) in game.participants.filter((p) => p.teamId === teamId)"
            :key="p.puuid ?? i"
            class="live-player"
            :class="{ 'live-player-me': p.puuid === puuid }"
          >
            <img
              class="live-player-art"
              :src="championSplash(p.championId)"
              :alt="championName(p.championId)"
            />
            <div class="live-player-info">
              <span class="eyebrow">{{ championName(p.championId) }}</span>
              <h4>{{ p.riotId || 'Hidden player' }}</h4>
              <span class="live-history" v-if="p.championStats"
                >{{ p.championStats.games }} tracked games ·
                {{ Math.round(p.championStats.winrate * 100) }}% WR</span
              ><span v-else class="live-history">No tracked games on this champion</span>
              <span v-if="p.rank" class="live-rank" title="Latest tracked Solo/Duo rank"
                >{{ TIER_NAMES[p.rank.tier] || p.rank.tier }} {{ p.rank.division }} ·
                {{ p.rank.leaguePoints }} LP</span
              >
              <span v-if="p.puuid === puuid" class="live-you">THIS PLAYER</span>
              <div class="live-loadout">
                <img :src="spellIcon(p.spell1Id)" alt="Summoner spell 1" /><img
                  :src="spellIcon(p.spell2Id)"
                  alt="Summoner spell 2"
                /><img
                  v-if="p.perks?.perkIds[0]"
                  :src="runeIcon(p.perks.perkIds[0])"
                  alt="Keystone"
                /><img
                  v-if="p.perks?.perkSubStyle"
                  :src="runeStyleIcon(p.perks.perkSubStyle)"
                  alt="Secondary rune tree"
                />
              </div>
            </div>
          </article>
        </div></div
    ></template>
  </section>
</template>
