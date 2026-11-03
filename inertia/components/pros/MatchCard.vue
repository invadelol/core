<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import Logo from '../champions/Logo.vue'
import MatchTime from './MatchTime.vue'
import {
  bestOfText,
  statusText,
  teamLabel,
  teamName,
  type ProMatch,
} from '../../lib/pro_matches.js'
import '../../css/pro_matches.css'

/**
 * A pro match as a compact card, for the strips of next games (`/pros`, the home): its league
 * and format, when it starts (or "Live" while it runs), and both teams with their logos and,
 * once it has started, their scores. The winner reads in full ink, the other team quieter.
 */
const props = defineProps<{ match: ProMatch; showLeague?: boolean }>()
const m = computed(() => props.match)
const live = computed(() => m.value.status === 'running')
const status = computed(() => statusText(m.value))
const started = computed(() => live.value || m.value.status === 'finished')
const href = (t: ProMatch['teams'][number]) => (t.slug ? `/team/${t.slug}` : null)
const logoTeam = (t: ProMatch['teams'][number]) => ({
  id: t.id,
  name: teamName(t),
  shortName: t.code,
})
</script>

<template>
  <article
    class="pm-card"
    :class="{ live }"
    :aria-label="`${teamLabel(m.teams[0])} vs ${teamLabel(m.teams[1])}`"
  >
    <div class="pm-top">
      <span class="when">
        <span v-if="live" class="pm-live">Live</span>
        <span v-else-if="status" class="pm-state">{{ status }}</span>
        <span v-else-if="m.status === 'finished'" class="pm-state">Final</span>
        <MatchTime v-else :at="m.at" />
      </span>
      <span class="end">
        <template v-if="showLeague && m.league">
          <Logo :league="m.league" :size="16" /><span class="lg">{{ m.league.code }}</span>
        </template>
        <span v-if="bestOfText(m)" class="bo" :title="`Best of ${m.bestOf}`">{{
          bestOfText(m)
        }}</span>
      </span>
    </div>
    <component
      :is="href(t) ? Link : 'div'"
      v-for="(t, i) in m.teams"
      :key="i"
      :href="href(t) ?? undefined"
      class="pm-team"
      :class="{ won: m.winner === i + 1, lost: m.winner !== null && m.winner !== i + 1 }"
    >
      <Logo :team="logoTeam(t)" :size="20" />
      <span class="nm" :title="t.name">{{ teamName(t) }}</span>
      <b v-if="started && t.score !== null" class="sc num">{{ t.score }}</b>
    </component>
  </article>
</template>
