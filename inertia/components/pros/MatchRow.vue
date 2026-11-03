<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { ExternalLink } from 'lucide-vue-next'
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
 * A pro match as a row, from one team's side (`team`, its id): the opponent with its logo, the
 * league, the format, and when it starts, "Live" with the score while it runs, or the result.
 * Without `team` (or when it is not in the match), both teams show.
 */
const props = defineProps<{ match: ProMatch; team?: string | null }>()
const m = computed(() => props.match)
const live = computed(() => m.value.status === 'running')
const status = computed(() => statusText(m.value))
const ours = computed(() => {
  if (!props.team) return -1
  return m.value.teams.findIndex((t) => t.id === props.team)
})
const opponent = computed(() => (ours.value >= 0 ? m.value.teams[1 - ours.value] : null))
const result = computed(() => {
  if (m.value.status !== 'finished' || !m.value.winner || ours.value < 0) return null
  return m.value.winner === ours.value + 1 ? 'Win' : 'Loss'
})
/** Our score first when the row is one team's. */
const scores = computed(() => {
  const [a, b] = m.value.teams.map((t) => t.score)
  return ours.value === 1 ? [b, a] : [a, b]
})
const showScore = computed(
  () => (live.value || m.value.status === 'finished') && scores.value.every((s) => s !== null)
)
const href = (t: ProMatch['teams'][number]) => (t.slug ? `/team/${t.slug}` : null)
const logoTeam = (t: ProMatch['teams'][number]) => ({
  id: t.id,
  name: teamName(t),
  shortName: t.code,
})
</script>

<template>
  <div class="pm-row" :class="{ live }">
    <span class="when">
      <span v-if="live" class="pm-live">Live</span>
      <span v-else-if="status" class="pm-state">{{ status }}</span>
      <MatchTime :at="m.at" />
    </span>
    <span class="who">
      <template v-if="opponent">
        <span class="vs q">vs</span>
        <Logo :team="logoTeam(opponent)" :size="20" />
        <component
          :is="href(opponent) ? Link : 'span'"
          :href="href(opponent) ?? undefined"
          class="nm"
          >{{ teamName(opponent) }}</component
        >
      </template>
      <template v-else>
        <template v-for="(t, i) in m.teams" :key="i">
          <span v-if="i" class="vs q">vs</span>
          <Logo :team="logoTeam(t)" :size="20" />
          <component
            :is="href(t) ? Link : 'span'"
            :href="href(t) ?? undefined"
            class="nm"
            :class="{ q: m.winner !== null && m.winner !== i + 1 }"
            >{{ teamLabel(t) }}</component
          >
        </template>
      </template>
    </span>
    <span class="meta">
      <Logo v-if="m.league" :league="m.league" :size="16" />
      <span class="q">{{ [m.league?.code, bestOfText(m)].filter(Boolean).join(', ') }}</span>
    </span>
    <span class="res">
      <b v-if="result" :class="result === 'Win' ? 'up' : 'down'">{{ result }}</b>
      <span v-if="showScore" class="num sc">{{ scores[0] }} : {{ scores[1] }}</span>
      <a
        v-else-if="m.stream && m.status !== 'finished' && m.status !== 'canceled'"
        :href="m.stream"
        target="_blank"
        rel="noreferrer"
        class="iv-btn ghost sm"
        >Watch<ExternalLink :size="12" aria-hidden="true" /><span class="nb-sr">
          (opens a new tab)</span
        ></a
      >
    </span>
  </div>
</template>
