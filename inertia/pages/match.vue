<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { Breakdown, BuildTab, GoldChart, Timeline } from '@invadelol/ui'
import { hasEvents, type MatchDetail } from '@invadelol/ui/logic'
import AppHeader from '../components/AppHeader.vue'
import DamageChart from '../components/DamageChart.vue'
import MatchBoard from '../components/MatchBoard.vue'
import MatchGold from '../components/MatchGold.vue'
import MatchHeader from '../components/MatchHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { decodeSlug, parseSlug, profilePath } from '../lib/format.js'
import { detailOf } from '../lib/match.js'
import '../css/rd-players.css'
import type { Match } from '../lib/types.js'

const props = defineProps<{ summoner: string; matchId: string }>()

/** The route param, decoded exactly once. Encode from this, never from the prop. */
const slug = computed(() => decodeSlug(props.summoner))
const parsed = computed(() => parseSlug(props.summoner))

const match = shallowRef<Match | null>(null)
const detail = shallowRef<MatchDetail | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

/** The player whose profile led here, when they played this game. */
const ownerPuuid = computed(
  () =>
    match.value?.participants.find((p) => `${p.gameName}-${p.tagLine}` === slug.value)?.puuid ?? ''
)

/** The player the Analysis, Timeline and Build follow: the owner first, then whoever is picked. */
const selected = ref(0)
const me = computed(() => detail.value?.players.find((p) => p.puuid === ownerPuuid.value))

/** Gold needs the per-minute frames; Timeline also needs events (old stored games have none). */
const SECTIONS = computed(() => [
  { id: 'scoreboard', label: 'Scoreboard' },
  { id: 'breakdown', label: 'Breakdown' },
  ...(detail.value?.timeline ? [{ id: 'gold', label: 'Gold' }] : []),
  ...(detail.value?.timeline && hasEvents(detail.value)
    ? [{ id: 'timeline', label: 'Timeline' }]
    : []),
  { id: 'builds', label: 'Builds' },
])

/** The open tab, kept in the address's hash (older links said `#analysis` and `#build`). */
const tab = ref('scoreboard')
const ALIASES: Record<string, string> = { analysis: 'breakdown', build: 'builds' }
function readHash() {
  const id = location.hash.slice(1)
  const wanted = ALIASES[id] ?? id
  if (SECTIONS.value.some((s) => s.id === wanted)) tab.value = wanted
}
function show(id: string) {
  tab.value = id
  history.replaceState(
    history.state,
    '',
    id === 'scoreboard' ? location.pathname + location.search : `#${id}`
  )
}

/**
 * A game that just ended is not stored yet: the API answers 202 while it fetches it from Riot,
 * which publishes a game minutes after its end. The page says so and asks again when told to,
 * for as long as the API keeps it queued, and a little longer.
 */
const pending = ref(false)
const PENDING_FOR_MS = 20 * 60_000
let pendingSince = 0
let retry: ReturnType<typeof setTimeout> | undefined
let disposed = false

/** Asks again after `seconds`, once the tab is in view. */
function askAgain(seconds: number) {
  retry = setTimeout(
    () => {
      if (document.visibilityState === 'visible') void load()
      else document.addEventListener('visibilitychange', onVisible, { once: true })
    },
    Math.min(60, Math.max(3, seconds)) * 1000
  )
}
function onVisible() {
  if (!disposed) void load()
}

async function load() {
  try {
    const res = await fetch(`/api/matches/${encodeURIComponent(props.matchId)}`, {
      cache: 'no-store',
    })
    if (disposed) return
    if (res.status === 202) {
      const body = await res.json().catch(() => null)
      pendingSince ||= Date.now()
      if (Date.now() - pendingSince < PENDING_FOR_MS) {
        pending.value = true
        askAgain(Number(res.headers.get('Retry-After')) || Number(body?.retryAfter) || 10)
        return
      }
    }
    pending.value = false
    if (res.status !== 200) {
      error.value = 'This match could not be found.'
      return
    }
    match.value = await res.json()
    detail.value = detailOf(match.value!)
    selected.value = Math.max(
      0,
      detail.value.players.findIndex((p) => p.puuid === ownerPuuid.value)
    )
    readHash()
  } catch {
    pending.value = false
    error.value = 'Something broke while loading this match.'
  } finally {
    isLoading.value = false
  }
}

// Browser-only, like every timer here: one scheduled during SSR would fire inside the server.
onMounted(load)
onBeforeUnmount(() => {
  disposed = true
  clearTimeout(retry)
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<template>
  <Head :title="`${parsed.gameName} | match`" />

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

    <main class="page flex-1">
      <div v-if="isLoading" class="space-y-6 pt-6" aria-busy="true">
        <div class="iv-skel h-[168px]" />
        <div class="iv-skel h-[480px]" />
        <div class="iv-skel h-[260px]" />
      </div>

      <div v-else-if="error" class="mx-auto max-w-[520px] py-24">
        <h1 class="text-[20px] font-semibold text-ink">{{ error }}</h1>
        <a :href="`/${encodeURIComponent(slug)}`" class="iv-btn mt-5">Back to profile</a>
      </div>

      <!-- A game that just ended: Riot publishes it a few minutes later, and the page fills in
           on its own once it is stored. -->
      <div v-else-if="pending" class="mx-auto max-w-[520px] py-24" role="status">
        <h1 class="text-[20px] font-semibold text-ink">This game just ended</h1>
        <p class="mt-2 text-[14px] leading-relaxed text-ink-2">
          It will be ready in a moment. This page opens it as soon as it is.
        </p>
        <a :href="`/${encodeURIComponent(slug)}`" class="iv-btn mt-5">Back to profile</a>
      </div>

      <!-- The game: the scoreline, then one tab at a time: the scoreboard with the gold lead and the
           damage, what the numbers mean, the gold race, the story and the builds. -->
      <template v-else-if="match && detail">
        <h1 class="sr-only">{{ parsed.gameName }}'s match</h1>
        <MatchHeader
          :detail="detail"
          :match="match"
          :puuid="ownerPuuid"
          :back="{
            label: `${parsed.gameName}#${parsed.tagLine}`,
            href: profilePath(parsed.gameName, parsed.tagLine),
          }"
        />

        <nav class="match-nav rd-tabs" aria-label="Sections">
          <a
            v-for="item in SECTIONS"
            :key="item.id"
            :href="`#${item.id}`"
            :class="{ on: tab === item.id }"
            :aria-current="tab === item.id ? 'page' : undefined"
            @click.prevent="show(item.id)"
            >{{ item.label }}</a
          >
        </nav>

        <section v-if="tab === 'scoreboard'" id="scoreboard">
          <MatchBoard :detail="detail" :puuid="ownerPuuid" />
          <MatchGold :detail="detail" :puuid="ownerPuuid" />
        </section>

        <section v-else-if="tab === 'breakdown'" id="breakdown" class="pt-6">
          <p class="hint">Select a player to read their game</p>
          <div class="rd-card iv-md match-part">
            <Breakdown :detail="detail" :selected="selected" :me="me" @select="selected = $event" />
          </div>
          <div class="rd-card match-part mt-3">
            <DamageChart
              :detail="detail"
              :selected="selected"
              :me="me"
              @select="selected = $event"
            />
          </div>
        </section>

        <section v-else-if="tab === 'gold' && detail.timeline" id="gold" class="pt-6">
          <div class="rd-card iv-md match-part">
            <GoldChart :detail="detail" :timeline="detail.timeline" :selected="selected" :me="me" />
          </div>
        </section>

        <section
          v-else-if="tab === 'timeline' && detail.timeline && hasEvents(detail)"
          id="timeline"
          class="pt-6"
        >
          <div class="rd-card iv-md match-part">
            <Timeline
              :detail="detail"
              :timeline="detail.timeline"
              :selected="selected"
              :me="me"
              @select="selected = $event"
            />
          </div>
        </section>

        <section v-else-if="tab === 'builds'" id="builds" class="pt-6">
          <div class="rd-card iv-md match-part">
            <BuildTab :detail="detail" :selected="selected" :me="me" @select="selected = $event" />
          </div>
        </section>
      </template>
    </main>

    <SiteFooter v-if="!isLoading" />
  </div>
</template>

<style scoped>
/* The tabs stay under the header while the page scrolls under them. */
.match-nav {
  position: sticky;
  top: 60px;
  z-index: 20;
  margin-top: 14px;
  background: var(--ink-1);
}
@media (max-height: 31rem) {
  .match-nav {
    position: static;
  }
}
.hint {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--text-3);
}

/* A section of the detail as its own sheet (the shared views size themselves on `.iv-md`). The
   build's player strip is wider than a phone: it scrolls in its sheet, not the page. */
.match-part {
  padding: 16px;
  overflow-x: auto;
}
</style>
