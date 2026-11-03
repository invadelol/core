<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { ExternalLink } from 'lucide-vue-next'
import Logo from '../champions/Logo.vue'
import MatchCountdown from './MatchCountdown.vue'
import MatchTime from './MatchTime.vue'
import { stageLine, statusText, teamLabel, teamName, type ProMatch } from '../../lib/pro_matches.js'
import '../../css/pro_matches.css'

/**
 * A pro match as a face-off: both teams' logos and codes across from each other, "vs" before it
 * starts and the score once it has (the winner in full ink, the other team quieter), when it
 * starts with the time left, its stage and format, and the stream while it runs. It draws no sheet of its own: the strips,
 * the home and the pro and team pages lay several in one sheet, split by hairlines. `lg` is the
 * featured next match of a team.
 */
const props = withDefaults(
  defineProps<{
    match: ProMatch
    showLeague?: boolean
    size?: 'md' | 'lg'
    /** A team's page: its id, so it always faces from the left. */
    team?: string | null
  }>(),
  { showLeague: false, size: 'md', team: null }
)
const m = computed(() => props.match)
const live = computed(() => m.value.status === 'running')
const done = computed(() => m.value.status === 'finished')
const status = computed(() => statusText(m.value))
const scored = computed(
  () => (live.value || done.value) && m.value.teams.every((t) => t.score !== null)
)
const stage = computed(() => stageLine(m.value))
/** The stream, while the match runs: before it, the time left says enough. */
const watch = computed(() => (live.value && m.value.stream ? m.value.stream : null))
const logoSize = computed(() => (props.size === 'lg' ? 56 : 32))
const href = (t: ProMatch['teams'][number]) => (t.slug ? `/team/${t.slug}` : null)
const logoTeam = (t: ProMatch['teams'][number]) => ({
  id: t.id,
  name: teamName(t),
  shortName: t.code,
})
/** The order the two teams read in, left to right: the page's team first. */
const sides = computed(() => (props.team && m.value.teams[1].id === props.team ? [1, 0] : [0, 1]))
const sideClass = (i: number) => ({
  won: m.value.winner === i + 1,
  lost: m.value.winner !== null && m.value.winner !== i + 1,
})
</script>

<template>
  <article
    class="pm-card"
    :class="[size, { live, done }]"
    :aria-label="`${teamName(m.teams[sides[0]])} vs ${teamName(m.teams[sides[1]])}`"
  >
    <header class="pm-top">
      <span v-if="live" class="pm-live">Live</span>
      <span v-else-if="status" class="pm-state">{{ status }}</span>
      <MatchTime v-else :at="m.at" />
      <span class="end">
        <span v-if="done" class="pm-state">Final</span>
        <MatchCountdown v-else-if="!live && !status" :at="m.at" />
      </span>
    </header>

    <div class="pm-face">
      <component
        :is="href(m.teams[i]) ? Link : 'div'"
        v-for="(i, at) in sides"
        :key="i"
        :href="href(m.teams[i]) ?? undefined"
        class="pm-side"
        :class="[at ? 'b' : 'a', sideClass(i)]"
        :style="{ order: at ? 3 : 1 }"
      >
        <Logo :team="logoTeam(m.teams[i])" :size="logoSize" :eager="size === 'lg'" />
        <b class="code">{{ teamLabel(m.teams[i]) }}</b>
        <span class="nm" :title="teamName(m.teams[i])">{{ teamName(m.teams[i]) }}</span>
      </component>
      <span class="pm-mid" style="order: 2">
        <template v-if="scored"
          ><b class="num" :class="sideClass(sides[0])">{{ m.teams[sides[0]].score }}</b
          ><span class="sep" aria-hidden="true">:</span
          ><b class="num" :class="sideClass(sides[1])">{{ m.teams[sides[1]].score }}</b></template
        >
        <span v-else class="vs">vs</span>
      </span>
    </div>

    <footer v-if="stage || watch || (showLeague && m.league)" class="pm-foot">
      <span class="st">
        <template v-if="showLeague && m.league"
          ><Logo :league="m.league" :size="16" /><span class="lg">{{
            m.league.code
          }}</span></template
        >
        <span v-if="stage" class="q">{{ stage }}</span>
      </span>
      <a
        v-if="watch"
        :href="watch"
        target="_blank"
        rel="noreferrer"
        class="pm-watch"
        :class="{ on: live }"
        >Watch<ExternalLink :size="12" aria-hidden="true" /><span class="nb-sr">
          (opens a new tab)</span
        ></a
      >
    </footer>
  </article>
</template>
