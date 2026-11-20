<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { VoteTally } from '../../lib/new_dawn.js'

/**
 * A rumour's no-stakes vote: Yes and No until the visitor has voted, then the result on the
 * site's win-rate line ("64% say yes", the true count, "you said yes"). The line grows from
 * nothing after a vote (600 ms), never on load. `card` is the overview's row, `row` the Rumours
 * tab's column. Without the counts (the store did not answer) the buttons stay, without a figure.
 */
const props = defineProps<{
  rumour: string
  question: string
  tally: VoteTally | null
  layout: 'card' | 'row'
}>()

const current = ref<VoteTally | null>(props.tally)
watch(
  () => props.tally,
  (t) => (current.value = t)
)
/** Voted in this view: the result shows even when the address had no vote left to give. */
const voted = ref(false)
const busy = ref(false)
const failed = ref<string | null>(null)

const total = computed(() => (current.value ? current.value.yes + current.value.no : 0))
const pct = computed(() =>
  total.value ? Math.round(((current.value?.yes ?? 0) / total.value) * 100) : 0
)
const shown = computed(() => Boolean(current.value?.mine) || voted.value)
/** The line's width: the result at once on load, from 0 after a vote. */
const width = ref<number | null>(null)

const n = (x: number) => x.toLocaleString('en-US')
const votes = computed(() => `${n(total.value)} ${total.value === 1 ? 'vote' : 'votes'}`)
const before = computed(() => {
  if (failed.value) return failed.value
  if (!current.value) return props.layout === 'row' ? 'Results after yours' : ''
  return props.layout === 'row' ? `${votes.value}, results after yours` : votes.value
})
const after = computed(() =>
  current.value?.mine ? `${votes.value}, you said ${current.value.mine}` : votes.value
)

async function vote(choice: 'yes' | 'no') {
  if (busy.value) return
  busy.value = true
  failed.value = null
  try {
    const response = await fetch(`/api/new-dawn/votes/${encodeURIComponent(props.rumour)}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'accept': 'application/json' },
      body: JSON.stringify({ choice }),
    })
    if (!response.ok) {
      failed.value =
        response.status === 429 ? 'Too many votes, try again later' : 'Votes are closed right now'
      return
    }
    const body = (await response.json()) as VoteTally
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    current.value = { yes: body.yes, no: body.no, mine: body.mine }
    width.value = still ? pct.value : 0
    voted.value = true
    if (!still) {
      await nextTick()
      requestAnimationFrame(() => requestAnimationFrame(() => (width.value = pct.value)))
    }
  } catch {
    failed.value = 'Votes are closed right now'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div :class="layout === 'row' ? 'nw-rv' : 'nw-vote'" aria-live="polite">
    <span v-if="layout === 'row'" class="nw-vq">{{ question }}</span>
    <span v-else-if="!shown" class="qq">{{ question }}</span>
    <template v-if="!shown">
      <div v-if="layout === 'row'" class="nw-vb">
        <button type="button" class="btn sm" :disabled="busy" @click="vote('yes')">Yes</button>
        <button type="button" class="btn sm" :disabled="busy" @click="vote('no')">No</button>
      </div>
      <template v-else>
        <button type="button" class="btn sm" :disabled="busy" @click="vote('yes')">Yes</button>
        <button type="button" class="btn sm" :disabled="busy" @click="vote('no')">No</button>
      </template>
      <span v-if="before" class="meta num">{{ before }}</span>
    </template>
    <template v-else>
      <span class="wrt nw-wrt" role="img" :aria-label="`${pct}% of ${votes} say yes`"
        ><span class="wrt-t" aria-hidden="true"
          ><b class="num">{{ pct }}%</b><span class="meta">say yes</span></span
        ><span class="wrt-a" aria-hidden="true"><i :style="{ width: `${width ?? pct}%` }" /></span
      ></span>
      <span class="meta num">{{ after }}</span>
    </template>
  </div>
</template>
