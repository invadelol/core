<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { n } from '../../lib/ladders.js'

/** A ladder's footer: "1 to 20 of 1,000 apex players", the page and Previous / Next links. */
const props = defineProps<{
  page: number
  pages: number
  total: number
  pageSize: number
  noun: string
  href: (page: number) => string
}>()
const first = () => (props.total ? (props.page - 1) * props.pageSize + 1 : 0)
const last = () => Math.min(props.total, props.page * props.pageSize)
</script>

<template>
  <div class="lb-pg">
    <span>{{ n(first()) }} to {{ n(last()) }} of {{ n(total) }} {{ noun }}</span>
    <span class="row" style="gap: 8px">
      <template v-if="pages > 1">
        <span class="meta">Page</span>
        <span class="lb-pn">{{ page }}</span>
        <span class="meta">of {{ n(pages) }}</span>
      </template>
      <Link
        class="btn sm"
        :href="href(Math.max(1, page - 1))"
        :aria-disabled="page <= 1"
        preserve-scroll
        style="margin-left: 8px"
        >Previous</Link
      >
      <Link
        class="btn sm"
        :href="href(Math.min(pages, page + 1))"
        :aria-disabled="page >= pages"
        preserve-scroll
        >Next</Link
      >
    </span>
  </div>
</template>
