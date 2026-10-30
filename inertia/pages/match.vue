<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import { ChevronLeft } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { Breakdown, BuildTab, GoldChart, Scoreboard, Timeline } from '@invadelol/ui'
import { hasEvents, type MatchDetail } from '@invadelol/ui/logic'
import AppHeader from '../components/AppHeader.vue'
import DamageChart from '../components/DamageChart.vue'
import MatchHeader from '../components/MatchHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { decodeSlug, parseSlug, profilePath } from '../lib/format.js'
import { detailOf } from '../lib/match.js'
import { patchName } from '../lib/patch.js'
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
  { id: 'analysis', label: 'Analysis' },
  ...(detail.value && hasEvents(detail.value) ? [{ id: 'timeline', label: 'Timeline' }] : []),
  { id: 'build', label: 'Build' },
])

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

    <main class="page flex-1 pt-6">
      <div v-if="isLoading" class="space-y-6" aria-busy="true">
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
        <p class="mt-2 text-[14px] text-ink-2">
          It will be ready in a moment. This page opens it as soon as it is.
        </p>
        <a :href="`/${encodeURIComponent(slug)}`" class="iv-btn mt-5">Back to profile</a>
      </div>

      <!-- The game read top to bottom: the scoreboard, then what the numbers mean, the story, the
           builds. Each section is the desktop app's view of it. -->
      <template v-else-if="match && detail">
        <!-- The header's breadcrumb is hidden on a phone: the way back to the player, here. -->
        <Link
          :href="profilePath(parsed.gameName, parsed.tagLine)"
          class="-ml-1 mb-2 inline-flex h-10 max-w-full items-center gap-1 text-[13px] font-medium text-ink-2 md:hidden"
        >
          <ChevronLeft :size="16" class="shrink-0 text-ink-3" />
          <span class="truncate">{{ parsed.gameName }}</span>
          <span class="shrink-0 text-ink-3">#{{ parsed.tagLine }}</span>
        </Link>
        <MatchHeader :detail="detail" :match="match" :puuid="ownerPuuid" />

        <nav
          class="match-nav iv-tabs sticky top-[57px] z-20 mt-4 [@media(max-height:31rem)]:static"
          aria-label="Sections"
        >
          <a v-for="item in SECTIONS" :key="item.id" :href="`#${item.id}`">{{ item.label }}</a>
        </nav>

        <section id="scoreboard" class="scroll-mt-28 pt-6">
          <div class="section">
            <h2>Scoreboard</h2>
            <span class="meta">Patch {{ patchName(detail.version) }}</span>
          </div>
          <div class="iv-panel iv-md match-part">
            <Scoreboard :detail="detail" :puuid="ownerPuuid" />
          </div>
        </section>

        <section id="analysis" class="scroll-mt-28 pt-8">
          <div class="section">
            <h2>Analysis</h2>
            <span class="meta">Select a player to read their game</span>
          </div>
          <div class="iv-panel iv-md match-part">
            <Breakdown :detail="detail" :selected="selected" :me="me" @select="selected = $event" />
          </div>
          <div class="iv-panel match-part mt-3">
            <DamageChart
              :detail="detail"
              :selected="selected"
              :me="me"
              @select="selected = $event"
            />
          </div>
          <div v-if="detail.timeline" class="iv-panel iv-md match-part mt-3">
            <GoldChart :detail="detail" :timeline="detail.timeline" :selected="selected" :me="me" />
          </div>
        </section>

        <section
          v-if="detail.timeline && hasEvents(detail)"
          id="timeline"
          class="scroll-mt-28 pt-8"
        >
          <div class="section">
            <h2>Timeline</h2>
          </div>
          <div class="iv-panel iv-md match-part">
            <Timeline
              :detail="detail"
              :timeline="detail.timeline"
              :selected="selected"
              :me="me"
              @select="selected = $event"
            />
          </div>
        </section>

        <section id="build" class="scroll-mt-28 pt-8">
          <div class="section">
            <h2>Build</h2>
          </div>
          <div class="iv-panel iv-md match-part">
            <BuildTab :detail="detail" :selected="selected" :me="me" @select="selected = $event" />
          </div>
        </section>
      </template>
    </main>

    <SiteFooter v-if="!isLoading" />
  </div>
</template>

<style scoped>
/* The section links: a lit bar that stays under the header, opaque so the page scrolls under it. */
.match-nav {
  padding: 0 16px;
  background: var(--sheen), var(--solid-1);
  border-bottom: 0;
  border-radius: var(--r-md);
  box-shadow: var(--lit);
}

/* A section of the detail as its own panel (the shared views size themselves on `.iv-md`). The
   build's player strip is wider than a phone: it scrolls in its panel, not the page. */
.match-part {
  padding: 16px;
  overflow-x: auto;
  background: var(--sheen), var(--surface-1);
  border-radius: var(--r-md);
}
</style>
