<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Logo from '../pros/Logo.vue'

/** A verified pro's teams, the current one first: the logo, the team, the league and years. */
interface Stint {
  team: { id: string; slug: string; name: string }
  league: { slug: string; code: string } | null
  current: boolean
  joinedAt: string | null
  leftAt: string | null
}
defineProps<{ teams: Stint[] }>()

const year = (iso: string | null) => (iso ? new Date(iso).getUTCFullYear() : null)
const span = (t: Stint) => {
  const from = year(t.joinedAt)
  const to = t.current ? 'now' : year(t.leftAt)
  return [t.league?.code, from && to ? `${from} to ${to}` : (from ?? to)].filter(Boolean).join(', ')
}
</script>

<template>
  <ul class="pf-career">
    <li v-for="t in teams" :key="`${t.team.id}${t.joinedAt}`">
      <Link :href="`/team/${t.team.slug}`" class="pf-fr">
        <span class="pf-crl"><Logo :team="t.team.id" :size="32" /></span>
        <span class="pf-frt"
          ><b>{{ t.team.name }}</b
          ><span class="pf-st">{{ span(t) }}</span></span
        >
      </Link>
    </li>
  </ul>
</template>
