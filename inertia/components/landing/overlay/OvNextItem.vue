<script setup lang="ts">
import type { NextItem } from './types.js'
import { itemIcon } from '../../../lib/assets.js'

/**
 * Next item, as the overlay draws it: the next item of the build with the gold it still takes,
 * the route with what is already bought, and the slot's alternatives.
 */
defineProps<{ build: NextItem }>()
</script>

<template>
  <div class="ov-panel build">
    <div class="build-next" :class="{ ready: build.next.affordable }">
      <img :src="itemIcon(build.next.id)" :alt="build.next.name" width="36" height="36" />
      <span class="build-next-text">
        <b>{{ build.next.name }}</b>
        <span class="build-cost" :class="{ ready: build.next.affordable }">
          {{ build.next.affordable ? 'Buy now' : `${build.next.missing} to go` }}
        </span>
      </span>
    </div>
    <div class="build-path">
      <img
        v-for="(s, i) in build.path"
        :key="i"
        :src="itemIcon(s.id)"
        alt=""
        width="24"
        height="24"
        :class="{ owned: s.owned, next: s.id === build.next.id }"
      />
    </div>
    <div v-if="build.next.options.length" class="build-options">
      <span>or</span>
      <img
        v-for="id in build.next.options"
        :key="id"
        :src="itemIcon(id)"
        alt=""
        width="20"
        height="20"
      />
    </div>
  </div>
</template>
