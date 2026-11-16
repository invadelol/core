<script setup lang="ts" generic="T extends string | number">
import { Link } from '@inertiajs/vue3'

/**
 * A segmented filter (`.seg`): a well with the options side by side, the chosen one on violet.
 * With `v-model` the options are buttons (a radio group); with an `href` on each option they are
 * links (a filter that is an address). `icon` is a small picture (a role), `note` a grey figure.
 */
defineProps<{
  options: ReadonlyArray<{ value: T; label: string; icon?: string; note?: string; href?: string }>
  label: string
}>()
const model = defineModel<T>()
</script>

<template>
  <div class="seg" role="radiogroup" :aria-label="label">
    <template v-for="o in options" :key="String(o.value)">
      <Link
        v-if="o.href"
        :href="o.href"
        :class="{ on: o.value === model }"
        role="radio"
        :aria-checked="o.value === model"
        preserve-scroll
        prefetch
        ><img v-if="o.icon" :src="o.icon" alt="" />{{ o.label
        }}<span v-if="o.note" class="seg-n num">{{ o.note }}</span></Link
      >
      <button
        v-else
        type="button"
        :class="{ on: o.value === model }"
        role="radio"
        :aria-checked="o.value === model"
        @click="model = o.value"
      >
        <img v-if="o.icon" :src="o.icon" alt="" />{{ o.label
        }}<span v-if="o.note" class="seg-n num">{{ o.note }}</span>
      </button>
    </template>
  </div>
</template>
