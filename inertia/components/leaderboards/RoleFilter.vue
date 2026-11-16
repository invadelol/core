<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import { ROLES } from '../../lib/ladders.js'

/**
 * The role filter of a ladder (`.seg`): All roles, then each role with its glyph and, when known,
 * its share of the ladder. Each option is an address.
 */
defineProps<{
  active: string | null
  href: (role: string | null) => string
  shares?: Record<string, number> | null
}>()
</script>

<template>
  <nav class="seg" aria-label="Role">
    <Link :href="href(null)" :class="{ on: !active }" preserve-scroll>All roles</Link>
    <Link
      v-for="r in ROLES"
      :key="r.slug"
      :href="href(r.slug)"
      :class="{ on: active === r.slug }"
      preserve-scroll
      ><RoleIcon :lane="r.lane" :size="15" />{{ r.label
      }}<span v-if="shares && shares[r.lane] !== undefined" class="lb-sh"
        >{{ Math.round(shares[r.lane] * 100) }}%</span
      ></Link
    >
  </nav>
</template>
