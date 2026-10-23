<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'

export interface BannerTab {
  label: string
  href: string
  on: boolean
  small?: string | number
  lane?: string
}

/**
 * The art band every champion, tier list and pro page opens on: the picture full width, the name
 * and the figures over it, and the page's tabs on its bottom edge.
 */
withDefaults(
  defineProps<{
    art: string[]
    title: string
    face?: string | null
    figures?: { label: string; value: string | number; sub?: string }[]
    tabs?: BannerTab[]
    list?: boolean
  }>(),
  { face: null, figures: () => [], tabs: () => [], list: false }
)
</script>

<template>
  <!-- The champion's art: a dark stage in every theme (DESIGN.md, `.iv-dark`). -->
  <section class="cs-hero iv-dark" :class="{ list }">
    <div class="cs-art" :class="{ band: art.length > 1 }">
      <img
        v-for="(src, i) in art"
        :key="i"
        :src="src"
        alt=""
        :fetchpriority="i === 0 ? 'high' : 'auto'"
      />
    </div>
    <div class="page">
      <div class="cs-id">
        <slot name="face">
          <img v-if="face" class="cs-face" :src="face" alt="" width="96" height="96" />
        </slot>
        <div class="min-w-0">
          <span class="cs-kick"><slot name="kicker" /></span>
          <h1>{{ title }}</h1>
          <slot name="under" />
        </div>
        <div v-if="figures.length" class="cs-nums">
          <div v-for="f in figures" :key="f.label">
            <span>{{ f.label }}</span>
            <b>{{ f.value }}</b>
            <small v-if="f.sub">{{ f.sub }}</small>
          </div>
        </div>
      </div>
      <nav v-if="tabs.length" class="cs-tabs">
        <Link
          v-for="t in tabs"
          :key="t.href"
          :href="t.href"
          :class="{ on: t.on }"
          preserve-scroll
          prefetch
          cache-for="30s"
        >
          <RoleIcon v-if="t.lane" :lane="t.lane as any" :size="14" />
          {{ t.label }}<small v-if="t.small !== undefined">{{ t.small }}</small>
        </Link>
      </nav>
    </div>
  </section>
</template>
