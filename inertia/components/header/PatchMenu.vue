<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import type { NavPatchNotes } from '../../lib/home.js'

/**
 * The Patch pill's menu: every patch the site has notes for, newest first, each with the day Riot
 * published them and how many champions and items changed. Until the menus' data lands it lists
 * the newest patch alone.
 */
const props = defineProps<{
  notes: NavPatchNotes[] | null
  /** The newest patch the statistics read ("26.22"), when known. */
  patch: string | null
  path: string
}>()
defineEmits<{ close: [] }>()

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const rows = computed(() => {
  const list: (NavPatchNotes | { patch: string; published?: undefined })[] = props.notes?.length
    ? props.notes
    : props.patch
      ? [{ patch: props.patch }]
      : []
  return list.map((n) => {
    const [, month, day] = (n.published ?? '').split('-').map(Number)
    return {
      patch: n.patch,
      href: `/patch/${n.patch}`,
      day: day ? String(day) : null,
      month: month ? MONTHS[month - 1] : null,
      line:
        n.published !== undefined
          ? `${n.champions} ${n.champions === 1 ? 'champion' : 'champions'}, ${n.items} ${n.items === 1 ? 'item' : 'items'}`
          : 'Patch notes',
      on: props.path === `/patch/${n.patch}`,
    }
  })
})
</script>

<template>
  <div class="hx-menu dm pm">
    <div class="dm-l">
      <Link
        v-for="(r, i) in rows"
        :key="r.patch"
        class="dm-r pm-r"
        :class="{ on: r.on, new: i === 0 }"
        :href="r.href"
        :aria-current="r.on ? 'page' : undefined"
        prefetch
        @click="$emit('close')"
      >
        <span class="pm-d num" aria-hidden="true"
          ><template v-if="r.day"
            ><b>{{ r.day }}</b>{{ r.month }}</template
          ></span
        >
        <span class="dm-t"
          ><b>Patch {{ r.patch }}</b><span>{{ r.line }}</span></span
        >
        <span v-if="i === 0" class="pm-new">Newest</span>
      </Link>
    </div>
  </div>
</template>
