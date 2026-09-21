<script setup lang="ts">
import { championName, championSplash } from '../lib/assets.js'

defineProps<{ championId: number }>()
</script>

<template>
  <div class="h-[150px] w-full overflow-hidden rounded-xl border border-line sm:h-[230px]">
    <img
      :src="championSplash(championId)"
      :alt="`${championName(championId)} champion artwork`"
      class="h-full w-full object-cover object-[50%_25%]"
    />
  </div>
</template>
