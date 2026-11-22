<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import RankedQueue from './RankedQueue.vue'
import type { RanksPayload } from '../../lib/types.js'

/**
 * The rail's ranked card: Solo/Duo with its LP history (Unranked when it is), and the Flex rank
 * as one quiet line at its foot when the player is ranked there. One block, so the narrow layouts
 * place it as one piece beside the player's card. A Master or higher Solo/Duo rank also asks for the player's
 * place on their server's ladder (stored reads, no request to Riot).
 */
const props = defineProps<{ ranks: RanksPayload | null; puuid: string }>()

const find = (queue: string) =>
  props.ranks?.current?.find((r) => r.queueType === queue && r.tier) ?? null
const solo = computed(() => find('RANKED_SOLO_5x5'))
const flex = computed(() => find('RANKED_FLEX_SR'))
const history = computed(() => props.ranks?.history ?? [])

const APEX = ['MASTER', 'GRANDMASTER', 'CHALLENGER']
const ladder = ref<{ position: number; server: string } | null>(null)
let asked: AbortController | undefined
watch(
  () => [props.puuid, solo.value?.tier] as const,
  async ([puuid, tier]) => {
    asked?.abort()
    ladder.value = null
    if (!tier || !APEX.includes(tier) || typeof window === 'undefined') return
    asked = new AbortController()
    const { signal } = asked
    try {
      const response = await fetch(`/api/summoners/puuid/${puuid}/ladder`, { signal })
      const place = response.ok ? await response.json() : null
      if (!signal.aborted && place?.position) ladder.value = place
    } catch {
      /* the place is a bonus: the card stands without it */
    }
  },
  { immediate: true }
)
onBeforeUnmount(() => asked?.abort())
</script>

<template>
  <div class="pl-rank">
    <RankedQueue
      title="Ranked Solo/Duo"
      queue="RANKED_SOLO_5x5"
      :rank="solo"
      :history="history"
      :ladder="ladder"
      :flex="flex"
    />
  </div>
</template>
