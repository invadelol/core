<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import { ROLES } from '../../lib/ladders.js'

/**
 * The role filter of a ladder (`.seg`): All roles, then each role with its glyph and, when known,
 * its share of the ladder. Each option is an address. On a phone the role names give way to the
 * glyphs (every role: four squares), so the row fits the width.
 */
defineProps<{
  active: string | null
  href: (role: string | null) => string
  shares?: Record<string, number> | null
}>()
</script>

<template>
  <nav class="seg" aria-label="Role">
    <Link :href="href(null)" :class="{ on: !active }" aria-label="All roles" preserve-scroll
      ><svg class="rf-g" width="16" height="16" viewBox="0 0 34 34" aria-hidden="true">
        <path fill="currentColor" d="M4 4h11v11H4Zm15 15h11v11H19Z" />
        <path fill="currentColor" opacity=".5" d="M19 4h11v11H19ZM4 19h11v11H4Z" /></svg
      ><span class="rf-l">All roles</span></Link
    >
    <Link
      v-for="r in ROLES"
      :key="r.slug"
      :href="href(r.slug)"
      :class="{ on: active === r.slug }"
      :aria-label="
        shares && shares[r.lane] !== undefined
          ? `${r.label}, ${Math.round(shares[r.lane] * 100)}% of the ladder`
          : r.label
      "
      preserve-scroll
      ><RoleIcon :lane="r.lane" :size="15" /><span class="rf-l">{{ r.label }}</span
      ><span v-if="shares && shares[r.lane] !== undefined" class="lb-sh"
        >{{ Math.round(shares[r.lane] * 100) }}%</span
      ></Link
    >
  </nav>
</template>

<style scoped>
.rf-g {
  display: none;
  flex: none;
}
@media (max-width: 560px) {
  .seg > * {
    justify-content: center;
    min-width: 44px;
    padding: 0 10px;
  }
  .rf-l {
    display: none;
  }
  .rf-g {
    display: block;
  }
}
</style>
