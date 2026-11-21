<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import RankEmblem from '../../ui/RankEmblem.vue'
import Logo from '../../pros/Logo.vue'
import ProPic from '../../pros/ProPic.vue'
import { laneOf, n, rankWords, roleLabel } from '../../../lib/ladders.js'
import { APEX, type RosterMember } from './types.js'

/**
 * A pro's current team in one line, the last line of their header: the team, then its five
 * players in lane order, each with face, role and rank; the pro whose page this is is marked.
 */
const props = defineProps<{
  team: { id: string; slug: string; name: string; league: { code: string } | null }
  members: RosterMember[]
  /** The pro whose page this is. */
  me: string
}>()
const ORDER = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT']
const five = computed(() =>
  props.members
    .filter((m) => m.title === 'player')
    .sort((a, b) => ORDER.indexOf(a.role ?? '') - ORDER.indexOf(b.role ?? ''))
    .slice(0, 5)
)
const rank = (m: RosterMember) =>
  m.best
    ? APEX.includes(m.best.tier)
      ? `${n(m.best.lp)} LP`
      : rankWords(m.best.tier, m.best.division)
    : 'Unranked'
</script>

<template>
  <div class="pp-strip" :style="{ '--n': five.length }">
    <Link class="pp-strip-t" :href="`/team/${team.slug}`" :title="team.name"
      ><Logo :team="team.id" :size="32" /><span class="col" style="min-width: 0"
        ><span class="h5 ell">{{ team.name }}</span
        ><span class="meta">{{ team.league?.code ?? 'Team' }}</span></span
      ></Link
    >
    <component
      :is="m.slug ? Link : 'div'"
      v-for="m in five"
      :key="m.name"
      class="pp-sm"
      :class="{ me: m.slug === me }"
      :href="m.slug ? `/pro/${m.slug}` : undefined"
      :title="`${m.name}, ${roleLabel(m.role) || 'player'}${m.best ? `, ${rankWords(m.best.tier, m.best.division)}` : ''}`"
    >
      <span class="pp-face"
        ><ProPic :slug="m.slug" :photo="m.photo" :team="team" :size="40" position="50% 8%"
      /></span>
      <span class="col" style="min-width: 0">
        <span class="h5 ell">{{ m.name }}</span>
        <span class="pp-rk sm" :class="{ un: !m.best }"
          ><RoleIcon v-if="laneOf(m.role)" :lane="laneOf(m.role)!" :size="12" /><RankEmblem
            v-if="m.best"
            :tier="m.best.tier"
            :size="16"
          /><span class="ell">{{ rank(m) }}</span></span
        >
      </span>
    </component>
  </div>
</template>
