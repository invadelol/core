<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Icon from './Icon.vue'

/** The quiet "see all" link at the end of a head: a label and a small chevron. */
defineProps<{ href: string; label: string; external?: boolean }>()
</script>

<template>
  <a v-if="external" class="more" :href="href" target="_blank" rel="noreferrer"
    >{{ label }}<Icon name="external" :size="14"
  /></a>
  <Link v-else class="more" :href="href" prefetch>{{ label }}<Icon name="fwd" :size="14" /></Link>
</template>
