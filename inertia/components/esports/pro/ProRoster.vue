<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import CardHead from '../../ui/CardHead.vue'
import RankEmblem from '../../ui/RankEmblem.vue'
import Logo from '../../pros/Logo.vue'
import ProPic from '../../pros/ProPic.vue'
import { laneOf, n, rankWords, roleLabel } from '../../../lib/ladders.js'
import { APEX, type RosterMember } from './types.js'

/**
 * A pro's current team in little room: `list` is one line per player (face, role, name, rank),
 * `strip` the five side by side in one row, `faces` five faces with a name under each.
 */
const props = withDefaults(
  defineProps<{
    team: { id: string; slug: string; name: string; league: { code: string } | null }
    members: RosterMember[]
    /** The pro whose page this is: their line is marked. */
    me: string
    mode?: 'list' | 'strip' | 'faces'
  }>(),
  { mode: 'list' }
)
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
  <section v-if="mode === 'list'" class="card pv-team">
    <CardHead
      :title="team.name"
      :meta="team.league?.code ?? null"
      :more="{ label: 'Team', href: `/team/${team.slug}` }"
    />
    <component
      :is="m.slug ? Link : 'div'"
      v-for="m in five"
      :key="m.name"
      class="pv-mt"
      :class="{ me: m.slug === me }"
      :href="m.slug ? `/pro/${m.slug}` : undefined"
    >
      <span class="pv-face"
        ><ProPic :slug="m.slug" :photo="m.photo" :team="team" :size="32" position="50% 8%"
      /></span>
      <RoleIcon v-if="laneOf(m.role)" class="pv-role" :lane="laneOf(m.role)!" :size="14" />
      <span class="h5 ell grow">{{ m.name }}</span>
      <span class="pv-rk sm" :class="{ un: !m.best }"
        ><RankEmblem v-if="m.best" :tier="m.best.tier" :size="18" />{{ rank(m) }}</span
      >
    </component>
  </section>

  <div v-else-if="mode === 'strip'" class="pv-strip">
    <Link class="pv-strip-t" :href="`/team/${team.slug}`" :title="team.name"
      ><Logo :team="team.id" :size="32" /><span class="col" style="min-width: 0"
        ><span class="h5 ell">{{ team.name }}</span
        ><span class="meta">{{ team.league?.code ?? 'Team' }}</span></span
      ></Link
    >
    <component
      :is="m.slug ? Link : 'div'"
      v-for="m in five"
      :key="m.name"
      class="pv-sm"
      :class="{ me: m.slug === me }"
      :href="m.slug ? `/pro/${m.slug}` : undefined"
    >
      <span class="pv-face"
        ><ProPic :slug="m.slug" :photo="m.photo" :team="team" :size="40" position="50% 8%"
      /></span>
      <span class="col" style="min-width: 0">
        <span class="h5 ell">{{ m.name }}</span>
        <span class="pv-rk sm" :class="{ un: !m.best }"
          ><RoleIcon v-if="laneOf(m.role)" :lane="laneOf(m.role)!" :size="12" /><RankEmblem
            v-if="m.best"
            :tier="m.best.tier"
            :size="16"
          />{{ rank(m) }}</span
        >
      </span>
    </component>
  </div>

  <div v-else class="pv-faces">
    <Link class="pv-faces-h" :href="`/team/${team.slug}`"
      ><Logo :team="team.id" :size="20" /><span class="h5">{{ team.name }}</span
      ><span v-if="team.league" class="meta">{{ team.league.code }}</span></Link
    >
    <div class="pv-faces-r">
      <component
        :is="m.slug ? Link : 'div'"
        v-for="m in five"
        :key="m.name"
        class="pv-fc"
        :class="{ me: m.slug === me }"
        :href="m.slug ? `/pro/${m.slug}` : undefined"
        :title="`${m.name}, ${roleLabel(m.role)}${m.best ? `, ${rankWords(m.best.tier, m.best.division)}` : ''}`"
      >
        <span class="pv-face"
          ><ProPic :slug="m.slug" :photo="m.photo" :team="team" :size="48" position="50% 8%"
        /></span>
        <span class="pv-fc-n ell">{{ m.name }}</span>
        <RoleIcon v-if="laneOf(m.role)" class="pv-role" :lane="laneOf(m.role)!" :size="12" />
      </component>
    </div>
  </div>
</template>
