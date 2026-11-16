<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Icon from './Icon.vue'

/**
 * A page's masthead (`.mast`): the breadcrumb, the title (h1, 32 px) and its grey line, with the
 * page's controls (selects, a segmented filter, a share button) at the right (`end` slot). The
 * default slot goes under the line (a tab row, a filter bar).
 */
withDefaults(
  defineProps<{
    title: string
    crumbs?: { label: string; href?: string }[]
    meta?: string | null
  }>(),
  { crumbs: () => [], meta: null }
)
</script>

<template>
  <section class="mast">
    <nav v-if="crumbs.length" class="crumbs" aria-label="Breadcrumb">
      <template v-for="(c, i) in crumbs" :key="i">
        <Link v-if="c.href && i < crumbs.length - 1" :href="c.href" prefetch>{{ c.label }}</Link>
        <span v-else class="t2" aria-current="page">{{ c.label }}</span>
        <Icon v-if="i < crumbs.length - 1" name="chevr" :size="12" />
      </template>
    </nav>
    <div class="mast-r">
      <div class="col mast-t">
        <h1 class="h1">{{ title }}</h1>
        <p v-if="meta || $slots.meta" class="meta">
          <slot name="meta">{{ meta }}</slot>
        </p>
      </div>
      <div v-if="$slots.end" class="ctl"><slot name="end" /></div>
    </div>
    <slot />
  </section>
</template>
