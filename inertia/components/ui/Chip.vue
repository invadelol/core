<script setup lang="ts">
import { Link } from '@inertiajs/vue3'

/**
 * A small label with an optional picture: `tag` (a fact: a team, a role, a region; grey on s2),
 * `stat` (a figure worth a glance, on the darkest violet), `violet` (a figure that leads: the
 * top value, a rank). With `href` it is a link.
 */
withDefaults(
  defineProps<{
    variant?: 'tag' | 'stat' | 'violet'
    icon?: string | null
    href?: string | null
  }>(),
  { variant: 'tag', icon: null, href: null }
)
const CLASS = { tag: 'tagx', stat: 'stat2', violet: 'vtop' } as const
</script>

<template>
  <Link v-if="href" :href="href" :class="CLASS[variant]" prefetch
    ><img v-if="icon" :src="icon" alt="" /><slot
  /></Link>
  <span v-else :class="CLASS[variant]"><img v-if="icon" :src="icon" alt="" /><slot /></span>
</template>
