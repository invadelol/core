<script setup lang="ts">
import { computed } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import Select from '../ui/Select.vue'
import { BRACKETS, REGIONS } from '../../lib/champions.js'
import { patchName, patchOptions } from '../../lib/patches.js'
import { withQuery } from '../../lib/tier_lists.js'
import { regionFlag } from '../../lib/flags.js'

/**
 * The rank, patch and region menus of a statistics page (the boards' three `.sel` at the top
 * right): each change is a visit of the same address with that filter, the others kept.
 */
const props = withDefaults(
  defineProps<{
    filter: { patch: string; bracket: string; region: string | null } | null
    patches: { patch: string; games: number }[]
    rank?: boolean
    region?: boolean
    /** The bracket the page shows without `rank` in its address (left out of it). */
    defaultRank?: string
  }>(),
  { rank: true, region: true, defaultRank: 'emerald_plus' }
)
const page = usePage()

const rankOptions = BRACKETS.map((b) => ({
  value: b.value as string,
  label: b.label as string,
  icon: b.crest ? `/cdn/rank/${b.crest}` : undefined,
}))
const patchMenu = computed(() =>
  patchOptions(
    props.patches.map((p) => p.patch),
    props.filter?.patch
  ).map((o) => ({ value: o.value, label: o.label.startsWith('Patch ') ? patchName(o.value) : o.label }))
)
const regionOptions = REGIONS.map((r) => ({
  value: r.value as string,
  label: r.value ? r.label : 'All servers',
  icon: regionFlag(r.value),
}))

function go(changes: Record<string, string | null>) {
  router.visit(withQuery(page.url, changes), { preserveScroll: true })
}

const rankValue = computed({
  get: () => props.filter?.bracket ?? props.defaultRank,
  set: (v: string) => go({ rank: v === props.defaultRank ? null : v }),
})
const patchValue = computed({
  get: () => props.filter?.patch ?? props.patches[0]?.patch ?? '',
  set: (v: string) => go({ patch: v === props.patches[0]?.patch ? null : v }),
})
const regionValue = computed({
  get: () => props.filter?.region ?? '',
  set: (v: string) => go({ region: v || null }),
})
</script>

<template>
  <div class="row stat-filters">
    <Select v-if="rank" v-model="rankValue" :options="rankOptions" width="13rem" align="right" />
    <Select
      v-if="patchMenu.length"
      v-model="patchValue"
      :options="patchMenu"
      label="Patch"
      width="13rem"
      align="right"
    />
    <Select
      v-if="region"
      v-model="regionValue"
      :options="regionOptions"
      label="Region"
      width="12rem"
      align="right"
    />
  </div>
</template>

<style>
/* The gap lives here, not only in tier-lists.css: pages that use the filters without that sheet
   (and navigations that arrive before it loaded) printed the menus edge to edge. */
.vb .row.stat-filters {
  gap: 8px;
  flex-wrap: wrap;
}
</style>
