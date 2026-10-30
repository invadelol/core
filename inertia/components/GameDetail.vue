<script lang="ts">
import type { MatchDetail } from '@invadelol/ui/logic'

/** Games opened during the visit, so closing and reopening one is instant. */
const cache = new Map<string, MatchDetail>()
</script>

<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { Link } from '@inertiajs/vue3'
import { Icon, MatchDetailPanel } from '@invadelol/ui'
import { detailOf } from '../lib/match.js'
import { profilePath } from '../lib/format.js'
import type { Match } from '../lib/types.js'

/**
 * An opened game of a profile's feed, drawn by the shared detail, with its link and the way to
 * its own page on the tab line.
 * The list already carries the scoreboard columns, so the game opens on them at once; the stored
 * match with its timeline and events follows.
 */
const props = defineProps<{ match: Match; puuid: string; gameName: string; tagLine: string }>()

const detail = shallowRef<MatchDetail | null>(null)
const error = shallowRef<string | null>(null)
const loading = shallowRef(false)

async function load() {
  const id = props.match.matchId
  error.value = null
  detail.value = cache.get(id) ?? detailOf(props.match)
  loading.value = !cache.has(id)
  if (!loading.value) return
  try {
    const res = await fetch(`/api/matches/${encodeURIComponent(id)}`)
    // 202 is a game not stored yet (the API is fetching it), never a match to draw.
    if (res.status !== 200) throw new Error()
    const d = detailOf((await res.json()) as Match)
    cache.set(id, d)
    if (id === props.match.matchId) detail.value = d
  } catch {
    if (id === props.match.matchId) error.value = 'This game could not be loaded.'
  } finally {
    if (id === props.match.matchId) loading.value = false
  }
}
watch(() => props.match.matchId, load, { immediate: true })

const href = computed(
  () =>
    `${profilePath(props.gameName, props.tagLine)}/match/${encodeURIComponent(props.match.matchId)}`
)
const copied = shallowRef(false)
async function copyLink() {
  try {
    await navigator.clipboard.writeText(`${location.origin}${href.value}`)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    /* the match page is still one click away */
  }
}
</script>

<template>
  <MatchDetailPanel
    :detail="detail"
    :puuid="puuid"
    :error="error"
    :match-id="match.matchId"
    :loading="loading"
    @retry="load"
  >
    <template #actions>
      <button
        type="button"
        class="iv-btn ghost sm"
        :title="copied ? 'Copied' : 'Copy the link to this game'"
        @click="copyLink"
      >
        <Icon :name="copied ? 'check' : 'copy'" :size="13" /><span>{{
          copied ? 'Copied' : 'Copy link'
        }}</span>
      </button>
      <Link :href="href" class="iv-btn ghost sm" title="Open this game on its own page">
        <span>Match page</span><Icon name="arrow" :size="13" />
      </Link>
    </template>
  </MatchDetailPanel>
</template>
