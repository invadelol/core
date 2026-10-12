<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { computed, onMounted, ref, shallowRef } from 'vue'
import { MatchDetailPanel } from '@invadelol/ui'
import type { MatchDetail } from '@invadelol/ui/logic'
import AppHeader from '../components/AppHeader.vue'
import MatchHeader from '../components/MatchHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { decodeSlug, parseSlug, profilePath } from '../lib/format.js'
import { detailOf } from '../lib/match.js'
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

onMounted(async () => {
  try {
    const res = await fetch(`/api/matches/${encodeURIComponent(props.matchId)}`)
    if (!res.ok) {
      error.value = 'This match could not be found.'
      return
    }
    match.value = await res.json()
    detail.value = detailOf(match.value!)
  } catch {
    error.value = 'Something broke while loading this match.'
  } finally {
    isLoading.value = false
  }
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
      <div v-if="isLoading" class="grid gap-4" aria-busy="true">
        <div class="iv-skel h-[168px]" />
        <MatchDetailPanel :detail="null" puuid="" />
      </div>

      <div v-else-if="error" class="mx-auto max-w-[520px] py-24">
        <h1 class="text-[20px] font-semibold text-ink">{{ error }}</h1>
        <a :href="`/${encodeURIComponent(slug)}`" class="iv-btn mt-5">Back to profile</a>
      </div>

      <div v-else-if="match && detail" class="grid gap-4">
        <MatchHeader :detail="detail" :match="match" :puuid="ownerPuuid" />
        <!-- The same detail as an opened game of a profile, every tab of it. -->
        <MatchDetailPanel :detail="detail" :puuid="ownerPuuid" :match-id="match.matchId" />
      </div>
    </main>

    <SiteFooter v-if="!isLoading" />
  </div>
</template>
