<script setup lang="ts">
import { Link, usePage } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import { withQuery } from '../../lib/tier_lists.js'

/**
 * The role filter of a statistics page (`.seg`): each role is an address (`?role=`), every role
 * first when `all` names it ("All roles"). `value` is the role the page shows (null: every role).
 * With `icons`, each option is its glyph alone (every role: four squares, as "all" reads on
 * League sites), its name in the label and the tooltip.
 */
withDefaults(
  defineProps<{
    value: string | null
    all?: string | null
    /** The query key (`role`). */
    param?: string
    /** Glyphs only, the words kept for the label and the tooltip. */
    icons?: boolean
  }>(),
  { all: null, param: 'role', icons: false }
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
  <nav class="seg role-seg" :class="{ 'role-seg-ic': icons }" aria-label="Role">
    <Link
      v-if="all"
      :href="withQuery(page.url, { [param]: null })"
      :class="{ on: !value }"
      :aria-current="!value ? 'page' : undefined"
      :aria-label="icons ? all : undefined"
      :title="icons ? all : undefined"
      preserve-scroll
      ><svg
        v-if="icons"
        class="iv-role-icon"
        width="18"
        height="18"
        viewBox="0 0 34 34"
        aria-hidden="true"
      >
        <path fill="currentColor" d="M4 4h11v11H4Zm15 15h11v11H19Z" />
        <path fill="currentColor" opacity=".5" d="M19 4h11v11H19ZM4 19h11v11H4Z" /></svg
      ><template v-else>{{ all }}</template></Link
    >
    <Link
      v-for="r in ROLES"
      :key="r.slug"
      :href="withQuery(page.url, { [param]: r.slug })"
      :class="{ on: value === r.position }"
      :aria-current="value === r.position ? 'page' : undefined"
      :aria-label="icons ? r.label : undefined"
      :title="icons ? r.label : undefined"
      preserve-scroll
      ><RoleIcon :lane="r.lane" :size="icons ? 18 : 16" /><template v-if="!icons">{{
        r.label
      }}</template></Link
    >
  </nav>
</template>
