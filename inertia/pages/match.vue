<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { computed, onMounted, ref, shallowRef } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import MatchHeader from '../components/MatchHeader.vue'
import MatchCharts from '../components/MatchCharts.vue'
import EventTimeline from '../components/EventTimeline.vue'
import Scoreboard from '../components/Scoreboard.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { loadChampions, loadItems, loadRunes } from '../lib/assets.js'
import { decodeSlug, parseSlug, profilePath } from '../lib/format.js'
import { indexTimeline } from '../lib/match.js'
import { matchView } from '../lib/match_view.js'
import type { Match } from '../lib/types.js'

const props = defineProps<{ summoner: string; matchId: string }>()

/** The route param, decoded exactly once. Encode from this, never from the prop. */
const slug = computed(() => decodeSlug(props.summoner))
const parsed = computed(() => parseSlug(props.summoner))

const match = shallowRef<Match | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const openPuuid = ref('')
const ownerPuuid = ref('')

onMounted(async () => {
  loadChampions()
  loadItems()
  loadRunes()

  try {
    const res = await fetch(`/api/matches/${encodeURIComponent(props.matchId)}`)
    if (!res.ok) {
      error.value = 'This match could not be found.'
      return
    }
    match.value = await res.json()
    const owner = match.value?.participants.find((p) => `${p.gameName}-${p.tagLine}` === slug.value)
    ownerPuuid.value = owner?.puuid ?? ''
    openPuuid.value = owner?.puuid ?? ''
  } catch {
    error.value = 'Something broke while loading this match.'
  } finally {
    isLoading.value = false
  }
})

const timeline = computed(() => indexTimeline(match.value))

/** The timeline and the charts follow whichever row is open. */
const focusPuuid = computed(
  () => openPuuid.value || ownerPuuid.value || match.value?.participants[0]?.puuid || ''
)

function toggleRow(puuid: string) {
  openPuuid.value = openPuuid.value === puuid ? '' : puuid
}

/* The timeline reads the match as the desktop app does, and follows the focused player. */
const view = computed(() => (match.value ? matchView(match.value) : null))
const focusIndex = computed(() =>
  Math.max(0, view.value?.players.findIndex((p) => p.puuid === focusPuuid.value) ?? 0)
)
const viewer = computed(() => view.value?.players.find((p) => p.puuid === ownerPuuid.value))
function focusIndexed(i: number) {
  const p = view.value?.players[i]
  if (p) openPuuid.value = p.puuid
}

const SECTIONS = computed(() => [
  { id: 'scoreboard', label: 'Scoreboard' },
  { id: 'analysis', label: 'Analysis' },
  ...(view.value?.timeline ? [{ id: 'timeline', label: 'Timeline' }] : []),
])
</script>

<template>
  <Head :title="`${parsed.gameName} · match`" />

  <div class="flex min-h-screen flex-col">
    <AppHeader
      :crumbs="[
        {
          label: `${parsed.gameName}#${parsed.tagLine}`,
          href: profilePath(parsed.gameName, parsed.tagLine),
        },
        { label: 'Match' },
      ]"
    />

    <main class="mx-auto w-full max-w-[1320px] flex-1 px-5 pt-6 sm:px-6 2xl:max-w-[1480px]">
      <div v-if="isLoading" class="space-y-6">
        <div class="skel h-[184px]" />
        <div class="skel h-[480px]" />
        <div class="skel h-[260px]" />
      </div>

      <div v-else-if="error" class="mx-auto max-w-[520px] py-24">
        <p class="text-[20px] font-semibold text-ink">{{ error }}</p>
        <a :href="`/${encodeURIComponent(slug)}`" class="btn mt-5">Back to profile</a>
      </div>

      <template v-else-if="match">
        <MatchHeader :match="match" :owner-puuid="ownerPuuid" />

        <nav
          class="tabs sticky top-[57px] z-20 -mx-5 mt-4 bg-bg/90 px-5 backdrop-blur sm:-mx-6 sm:px-6"
          aria-label="Sections"
        >
          <a v-for="item in SECTIONS" :key="item.id" :href="`#${item.id}`" class="tabs-link">
            {{ item.label }}
          </a>
        </nav>

        <section id="scoreboard" class="scroll-mt-28 pt-6">
          <div class="section">
            <h2>Scoreboard</h2>
            <span class="meta">Select a player for the full breakdown</span>
          </div>
          <div class="card">
            <Scoreboard
              :match="match"
              :owner-puuid="ownerPuuid"
              :timeline="timeline"
              :open-puuid="openPuuid"
              @open="toggleRow"
            />
          </div>
        </section>

        <section id="analysis" class="scroll-mt-28 pt-8">
          <MatchCharts
            :match="match"
            :owner-puuid="ownerPuuid"
            :selected-puuid="focusPuuid"
            @select="toggleRow"
          />
        </section>

        <section v-if="view?.timeline" id="timeline" class="scroll-mt-28 pt-8">
          <div class="section">
            <h2>Timeline</h2>
          </div>
          <div class="card card-pad">
            <EventTimeline
              :detail="view"
              :timeline="view.timeline"
              :selected="focusIndex"
              :me="viewer"
              @select="focusIndexed"
            />
          </div>
        </section>
      </template>
    </main>

    <SiteFooter v-if="!isLoading" />
  </div>
</template>
