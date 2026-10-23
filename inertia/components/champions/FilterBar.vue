<script setup lang="ts">
import { computed } from 'vue'
import { Link, router } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import Select from '../ui/Select.vue'
import { BRACKETS } from '../../lib/champions.js'

export interface RoleChoice {
  label: string
  lane: string
  href: string
  on: boolean
  share?: string
}

/**
 * The filters every champion page shares: the role (links), the rank bracket and the patch
 * (menus). A choice keeps the others: the address carries them all.
 */
const props = defineProps<{
  roles?: RoleChoice[]
  rank: string
  patch: string
  patches: { patch: string; games: number }[]
  /** The address of a choice: the page builds it so its own parameters stay. */
  href: (change: { rank?: string; patch?: string }) => string
}>()

const rankOptions = BRACKETS.map((b) => ({ value: b.value, label: b.label }))
const patchOptions = computed(() =>
  props.patches.map((p) => ({
    value: p.patch,
    label: `Patch ${p.patch}`,
    meta: `${Math.round(p.games / 1000)}k games`,
  }))
)
const rank = computed({
  get: () => props.rank,
  set: (value) => router.visit(props.href({ rank: value }), { preserveScroll: true }),
})
const patch = computed({
  get: () => props.patch,
  set: (value) => router.visit(props.href({ patch: value }), { preserveScroll: true }),
})
</script>

<template>
  <div class="cs-bar">
    <nav v-if="roles?.length" class="cs-roles" aria-label="Role">
      <Link
        v-for="r in roles"
        :key="r.href"
        :href="r.href"
        :class="{ on: r.on }"
        preserve-scroll
        prefetch
        cache-for="30s"
      >
        <RoleIcon :lane="r.lane as any" :size="13" />{{ r.label
        }}<small v-if="r.share">{{ r.share }}</small>
      </Link>
    </nav>
    <slot />
    <div class="cs-picks">
      <Select v-model="rank" :options="rankOptions" label="Rank" width="13rem" align="right" />
      <Select
        v-if="patchOptions.length"
        v-model="patch"
        :options="patchOptions"
        width="13rem"
        align="right"
      />
    </div>
  </div>
</template>
