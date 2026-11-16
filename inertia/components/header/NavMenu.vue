<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import MenuArt from './MenuArt.vue'
import type { NavContext, NavSection } from '../../lib/site_nav.js'
import { teamLabel } from '../../lib/pro_matches.js'

/**
 * A section's menu under its trigger (352 px): one row per page, a League-art picture, the title
 * and two grey lines, then a hairline link at the foot. The Esports menu opens on the pro game
 * being played now, when there is one.
 */
const props = defineProps<{ section: NavSection; ctx: NavContext; path: string }>()
defineEmits<{ close: [] }>()

const gone = (event: Event) => ((event.target as HTMLImageElement).style.visibility = 'hidden')
const foot = computed(() => props.section.foot?.(props.ctx) ?? null)
const live = computed(() =>
  props.section.key === 'esports' ? (props.ctx.nav?.live ?? null) : null
)
const liveGame = computed(() => {
  const m = live.value
  if (!m) return null
  const played = (m.teams[0].score ?? 0) + (m.teams[1].score ?? 0)
  return m.bestOf && m.bestOf > 1 ? `Game ${played + 1}, best of ${m.bestOf}` : 'Best of 1'
})
const liveTitle = computed(() => {
  const m = live.value
  if (!m) return ''
  return [m.league?.name ?? m.tournament, m.name && !m.name.includes(' vs ') ? m.name : null]
    .filter(Boolean)
    .join(', ')
})
</script>

<template>
  <div class="hx-menu dm">
    <component
      :is="live.stream ? 'a' : Link"
      v-if="live"
      class="dm-live"
      :href="live.stream ?? '/esports'"
      v-bind="live.stream ? { target: '_blank', rel: 'noreferrer' } : {}"
      data-track="menu_esports_live"
      @click="$emit('close')"
    >
      <span class="r1"
        ><span class="live">Live</span><span class="ell">{{ liveTitle }}</span
        ><span class="wt">Watch<Icon name="arrow" :size="13" /></span
      ></span>
      <span class="r2">
        <img
          v-if="live.teams[0].id"
          :src="`/cdn/team/${live.teams[0].id}?s=32`"
          alt=""
          data-fallback="applied"
          @error="gone"
        />{{ teamLabel(live.teams[0])
        }}<b class="num">{{ live.teams[0].score ?? 0 }} – {{ live.teams[1].score ?? 0 }}</b
        >{{ teamLabel(live.teams[1])
        }}<img
          v-if="live.teams[1].id"
          :src="`/cdn/team/${live.teams[1].id}?s=32`"
          alt=""
          data-fallback="applied"
          @error="gone"
        /><span class="g">{{ liveGame }}</span>
      </span>
    </component>
    <div class="dm-l">
      <Link
        v-for="l in section.links"
        :key="l.key"
        class="dm-r"
        :class="{ on: l.here(path) }"
        :href="l.href"
        :aria-current="l.here(path) ? 'page' : undefined"
        prefetch
        @click="$emit('close')"
      >
        <span class="dm-i"><MenuArt :name="l.art" :size="56" /></span>
        <span class="dm-t"
          ><b>{{ l.label }}</b
          ><span>{{ l.line(ctx) }}</span></span
        >
      </Link>
    </div>
    <div v-if="foot" class="dm-f">
      <Link :href="foot.href" prefetch @click="$emit('close')"
        ><Icon name="arrow" :size="14" />{{ foot.label }}</Link
      >
    </div>
  </div>
</template>
