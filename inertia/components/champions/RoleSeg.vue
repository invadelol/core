<script setup lang="ts">
import { Link, usePage } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import { withQuery } from '../../lib/tier_lists.js'

/**
 * The role filter of a statistics page (`.seg`): each role is an address (`?role=`), every role
 * first when `all` names it ("All roles"). `value` is the role the page shows (null: every role).
 */
withDefaults(
  defineProps<{
    value: string | null
    all?: string | null
    /** The query key (`role`). */
    param?: string
  }>(),
  { all: null, param: 'role' }
)
const page = usePage()

const ROLES = [
  { slug: 'top', position: 'TOP', lane: 'TOP', label: 'Top' },
  { slug: 'jungle', position: 'JUNGLE', lane: 'JUNGLE', label: 'Jungle' },
  { slug: 'mid', position: 'MIDDLE', lane: 'MID', label: 'Mid' },
  { slug: 'bot', position: 'BOTTOM', lane: 'ADC', label: 'Bot' },
  { slug: 'support', position: 'UTILITY', lane: 'SUPPORT', label: 'Support' },
] as const
</script>

<template>
  <nav class="seg role-seg" aria-label="Role">
    <Link
      v-if="all"
      :href="withQuery(page.url, { [param]: null })"
      :class="{ on: !value }"
      :aria-current="!value ? 'page' : undefined"
      preserve-scroll
      >{{ all }}</Link
    >
    <Link
      v-for="r in ROLES"
      :key="r.slug"
      :href="withQuery(page.url, { [param]: r.slug })"
      :class="{ on: value === r.position }"
      :aria-current="value === r.position ? 'page' : undefined"
      preserve-scroll
      ><RoleIcon :lane="r.lane" :size="16" />{{ r.label }}</Link
    >
  </nav>
</template>
