<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { RoleIcon } from '@invadelol/ui'
import { positionOf } from '@invadelol/ui/logic'
import LensStage from './LensStage.vue'
import LensLaning from './LensLaning.vue'
import LensDomainStory from './LensDomainStory.vue'
import { championName } from '../../lib/assets.js'
import { LENS_ROLES, type LensPayload, type LensRole } from '../../lib/lens.js'

/**
 * Lens: the player's games in one role, read domain by domain against the role's Emerald pace
 * and their lane opponents. The role defaults to the one they play most; the server decides it.
 */
const props = defineProps<{ puuid: string }>()

const ROLE_NAMES: Record<LensRole, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MIDDLE: 'Mid',
  BOTTOM: 'Bot',
  UTILITY: 'Support',
}
const QUEUES = [
  ['all', 'All'],
  ['ranked', 'Solo/Duo'],
  ['flex', 'Flex'],
  ['normal', 'Normals'],
] as const
const WINDOWS = [20, 50] as const

/** Null until the player picks one: the server reads their main role. */
const role = ref<LensRole | null>(null)
const queue = ref<(typeof QUEUES)[number][0]>('all')
const count = ref<(typeof WINDOWS)[number]>(20)

const lens = shallowRef<LensPayload | null>(null)
const loading = ref(true)
const failed = ref(false)
let controller: AbortController | undefined

async function load() {
  controller?.abort()
  controller = new AbortController()
  const { signal } = controller
  loading.value = true
  failed.value = false
  const query = new URLSearchParams({ type: queue.value, count: String(count.value) })
  if (role.value) query.set('role', role.value)
  try {
    const response = await fetch(`/api/summoners/puuid/${props.puuid}/lens?${query}`, { signal })
    if (!response.ok) throw new Error()
    const data = (await response.json()) as LensPayload
    if (!signal.aborted) lens.value = data
  } catch {
    if (!signal.aborted) failed.value = true
  } finally {
    if (!signal.aborted) loading.value = false
  }
}

onMounted(() => {
  watch([role, queue, count], () => void load())
  watch(
    () => props.puuid,
    () => {
      lens.value = null
      if (role.value === null) void load()
      else role.value = null
    },
    { immediate: true }
  )
})
onBeforeUnmount(() => controller?.abort())

const shownRole = computed(() => lens.value?.role ?? role.value)
const gamesBy = computed(
  () => new Map((lens.value?.roles ?? []).map((r) => [r.role, r.games] as const))
)
const roleName = computed(() => (shownRole.value ? ROLE_NAMES[shownRole.value] : ''))

/** What each game was, for the trends' hover: "Darius · Win". */
const labels = computed(() =>
  (lens.value?.games ?? []).map((g) => `${championName(g.championId)} · ${g.win ? 'Win' : 'Loss'}`)
)

/** The champion played most in the window: the stage's art and the face of the cards. */
const champion = computed(() => lens.value?.champions[0]?.championId ?? null)

const summary = computed(() => {
  const l = lens.value
  if (!l?.role || !l.games.length) return ''
  return `${ROLE_NAMES[l.role]} · last ${l.games.length} ${l.games.length === 1 ? 'game' : 'games'}`
})

function open(key: string) {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document
    .getElementById(`lens-${key}`)
    ?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
}
</script>

<template>
  <section class="lv" :aria-busy="loading">
    <div class="section flex-wrap">
      <h2>Lens</h2>
      <span class="meta num">{{ summary }}</span>
    </div>

    <!-- Role first: every figure is read against that role's pace. -->
    <div class="lv-filters" :class="{ busy: loading && lens }">
      <div class="iv-seg lv-seg" role="group" aria-label="Role">
        <button
          v-for="r in LENS_ROLES"
          :key="r"
          type="button"
          :class="{ on: shownRole === r }"
          :disabled="Boolean(lens) && !gamesBy.get(r)"
          :title="`${ROLE_NAMES[r]}${gamesBy.get(r) ? ` · ${gamesBy.get(r)} recent games` : ''}`"
          :aria-label="ROLE_NAMES[r]"
          @click="role = r"
        >
          <RoleIcon :lane="positionOf(r)" :size="15" />
          <span class="lv-seg-text">{{ ROLE_NAMES[r] }}</span>
        </button>
      </div>

      <div class="iv-seg lv-seg" role="group" aria-label="Queue">
        <button
          v-for="[value, label] in QUEUES"
          :key="value"
          type="button"
          :class="{ on: queue === value }"
          @click="queue = value"
        >
          {{ label }}
        </button>
      </div>

      <div class="iv-seg lv-seg lv-seg-window" role="group" aria-label="Games read">
        <button
          v-for="n in WINDOWS"
          :key="n"
          type="button"
          :class="{ on: count === n }"
          @click="count = n"
        >
          Last {{ n }}
        </button>
      </div>
    </div>

    <!-- First load: the shape of what is coming. -->
    <div v-if="!lens && loading" class="mt-5 space-y-3">
      <div class="iv-skel h-[300px]" />
      <div class="grid gap-3 lg:grid-cols-2">
        <div v-for="n in 4" :key="n" class="iv-skel h-[280px]" />
      </div>
    </div>

    <p v-else-if="failed" class="notice mt-5" role="alert">
      <span>The Lens could not be loaded.</span>
      <button type="button" class="iv-btn sm ml-auto" @click="load()">Retry</button>
    </p>

    <div
      v-else-if="lens && (!lens.role || !lens.games.length)"
      class="iv-panel mt-5 px-5 py-8 text-center"
    >
      <p class="text-[14px] font-medium text-ink">
        {{
          lens.role ? `No ${ROLE_NAMES[lens.role]} games in this queue yet.` : 'No laned games yet.'
        }}
      </p>
      <p class="mx-auto mt-1.5 max-w-[420px] text-[13px] text-ink-3">
        The Lens reads Summoner's Rift games with a role. Try another queue or role.
      </p>
    </div>

    <div v-else-if="lens" class="lv-body" :class="{ busy: loading }">
      <LensStage
        class="mt-5"
        :domains="lens.domains"
        :score="lens.score"
        :games="lens.games.length"
        :timeline-games="lens.timelineGames"
        :role-name="roleName"
        :champion="champion"
        @open="open"
      />

      <div class="mt-3 grid gap-3 lg:grid-cols-2">
        <template v-for="domain in lens.domains" :key="domain.key">
          <LensLaning
            v-if="domain.key === 'laning'"
            class="lg:col-span-2"
            :domain="domain"
            :duel="lens.duel"
            :games="lens.games"
            :champion="champion"
            :timeline-games="lens.timelineGames"
            :labels="labels"
          />
          <LensDomainStory
            v-else
            :domain="domain"
            :lens="lens"
            :champion="champion"
            :labels="labels"
          />
        </template>
      </div>

      <p class="lv-note">
        Figures are compared with the Emerald pace of the role where a public one exists, and with
        the lane opponents you met. Laning reads the minute-by-minute timeline of a game.
      </p>
    </div>
  </section>
</template>

<style scoped>
.lv-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 12px;
  transition: opacity var(--t-base) var(--ease);
}

.lv-filters.busy,
.lv-body.busy {
  opacity: 0.6;
}

.lv-body {
  transition: opacity var(--t-base) var(--ease);
}

.lv-seg button {
  gap: 6px;
}

.lv-seg button:disabled {
  opacity: 0.4;
}

/* On a phone each control takes the line, its segments sharing it; roles keep their glyph only. */
@media (max-width: 39.99rem) {
  .lv-seg {
    display: flex;
    width: 100%;
    flex-wrap: nowrap;
  }

  .lv-seg button {
    flex: 1 1 0;
    min-width: 0;
    padding-inline: 6px;
  }

  .lv-seg-text {
    display: none;
  }
}

.lv-note {
  max-width: 680px;
  margin-top: 16px;
  font-size: 12px;
  line-height: 18px;
  color: var(--text-4);
}
</style>
