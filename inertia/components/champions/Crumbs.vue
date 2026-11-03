<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

/**
 * A page's breadcrumb (the current page last) with an optional way back before it. On a phone
 * only the way back shows, or the current page when there is none.
 */
defineProps<{
  items: { label: string; href?: string }[]
  back?: { label: string; href: string } | null
}>()
</script>

<template>
  <nav class="nb-crumbs" aria-label="Breadcrumb">
    <Link v-if="back" :href="back.href" class="back"
      ><ChevronLeft :size="14" aria-hidden="true" />{{ back.label }}</Link
    >
    <ol>
      <li v-for="(c, i) in items" :key="i">
        <Link v-if="c.href && i < items.length - 1" :href="c.href">{{ c.label }}</Link>
        <span v-else class="here" aria-current="page">{{ c.label }}</span>
        <span v-if="i < items.length - 1" class="chev" aria-hidden="true"
          ><ChevronRight :size="13"
        /></span>
      </li>
    </ol>
    <span v-if="$slots.end" class="end"><slot name="end" /></span>
  </nav>
</template>
