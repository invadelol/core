<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import SkinPoster from '../skins/SkinPoster.vue'
import RarityGem from '../skins/RarityGem.vue'
import Stars from '../skins/Stars.vue'
import { skinPath } from '../../lib/skins.js'
import type { ProfileSkinsData } from '../../lib/skin_types.js'

/**
 * The favourite four: the owner's four skins as posters. `big` names them under the poster with
 * Riot's gem; `rated` adds the owner's stars (the Skins tab).
 */
withDefaults(
  defineProps<{ skins: ProfileSkinsData['favorites']; big?: boolean; rated?: boolean }>(),
  { big: false, rated: false }
)
</script>

<template>
  <div class="pf-f4" :class="{ big: big || rated }">
    <Link v-for="s in skins" :key="s.id" :href="skinPath(s.id)" :aria-label="s.name">
      <SkinPoster :skin="s" />
      <span v-if="big || rated" class="skn-fn"
        ><RarityGem :rarity="s.rarity" :size="13" bare /><span>{{ s.name }}</span></span
      >
      <Stars v-if="rated" :value="s.rating" :size="12" prompt />
    </Link>
  </div>
</template>
