<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Stars from './Stars.vue'
import SkinPoster from './SkinPoster.vue'
import { skinPath } from '../../lib/skins.js'
import type { RatedSkin, SkinCard } from '../../lib/skin_types.js'

/** A skin in a row of posters: its poster, its place when ranked, its name and average. */
withDefaults(
  defineProps<{
    skin: SkinCard & Partial<Pick<RatedSkin, 'average' | 'ratings'>>
    rank?: number | null
    here?: boolean
    /** A grey line under the name instead of the stars ("1350 RP", "Patch 26.23"). */
    note?: string | null
  }>(),
  { rank: null, here: false, note: null }
)
</script>

<template>
  <Link
    :href="skinPath(skin.id)"
    class="skn-cell"
    :class="{ here }"
    :aria-current="here ? 'page' : undefined"
  >
    <SkinPoster :skin="skin" />
    <span class="skn-mn"
      ><span v-if="rank" class="skn-rn num">{{ rank }}</span
      >{{ skin.name }}</span
    >
    <span v-if="note" class="skn-mm">{{ note }}</span>
    <span v-else-if="skin.average" class="skn-mm"
      ><Stars :value="Math.round(skin.average * 2)" :size="11" /><span class="num">{{
        skin.average.toFixed(1)
      }}</span></span
    >
  </Link>
</template>
