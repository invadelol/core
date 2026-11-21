<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import RankEmblem from '../../ui/RankEmblem.vue'
import ProPic from '../../pros/ProPic.vue'
import { profileIcon } from '../../../lib/assets.js'
import { n } from '../../../lib/ladders.js'
import { ord, type TopPlayer } from './types.js'

/**
 * The race at the top: the first ten on one LP line, so the gaps read as distance. The first
 * three stand on it with their face, name and LP; the next seven are marks with their place.
 */
const props = defineProps<{ players: TopPlayer[] }>()
const ranked = computed(() => props.players.filter((p) => p.lp !== null))
const domain = computed(() => {
  const lps = ranked.value.map((p) => p.lp!)
  const hi = Math.max(...lps)
  const lo = Math.min(...lps)
  const pad = Math.max(10, (hi - lo) * 0.04)
  return { lo: lo - pad, hi: hi + pad }
})
/** A player's spot on the line, 0 to 100 (%). */
const at = (p: TopPlayer) => {
  const { lo, hi } = domain.value
  return hi === lo ? 100 : ((p.lp! - lo) / (hi - lo)) * 100
}
const leaders = computed(() => ranked.value.slice(0, 3))
/** The next seven, each with its place written unless a written one sits too close. */
const rest = computed(() => {
  let last = Infinity
  return ranked.value.slice(3).map((p) => {
    const x = at(p)
    const label = Math.abs(last - x) >= 2.4
    if (label) last = x
    return { p, x, label }
  })
})
/** The line's width in px, so pins that would touch are told apart at any width. */
const track = ref<HTMLElement | null>(null)
const width = ref(1100)
let watcher: ResizeObserver | null = null
onMounted(() => {
  if (!track.value || typeof ResizeObserver === 'undefined') return
  watcher = new ResizeObserver(([e]) => (width.value = e.contentRect.width || width.value))
  watcher.observe(track.value)
})
onBeforeUnmount(() => watcher?.disconnect())
/** The first three's pins: a pin that would touch one already placed stands a level higher. */
const pins = computed(() => {
  const room = (48 / Math.max(1, width.value)) * 100
  const placed: { p: TopPlayer; x: number; level: number; i: number }[] = []
  leaders.value.forEach((p, i) => {
    const x = at(p)
    let level = 0
    while (placed.some((q) => q.level === level && Math.abs(q.x - x) < room)) level++
    placed.push({ p, x, level, i })
  })
  return placed
})
const levels = computed(() => Math.max(0, ...pins.value.map((x) => x.level)))
const gapText = computed(() => {
  const [a, b, c] = leaders.value
  if (!a || !b) return null
  return c
    ? `${n(a.lp! - b.lp!)} LP between 1st and 2nd, ${n(a.lp! - c.lp!)} between 1st and 3rd`
    : `${n(a.lp! - b.lp!)} LP between 1st and 2nd`
})
const span = computed(() => {
  const last = ranked.value[ranked.value.length - 1]
  const first = ranked.value[0]
  return first && last && last !== first
    ? `${n(first.lp! - last.lp!)} LP from 1st to ${last.place}${ord(last.place)}`
    : null
})
</script>

<template>
  <div class="tr">
    <div class="tr-cards">
      <Link
        v-for="p in leaders"
        :key="p.place"
        class="tr-card"
        :class="{ one: p === leaders[0] }"
        :href="p.href"
      >
        <span class="tr-no"
          >{{ p.place }}<sup>{{ ord(p.place) }}</sup></span
        >
        <span v-if="p.pro" class="tr-face"
          ><ProPic
            :slug="p.pro.slug"
            :photo="p.pro.photo"
            :team="p.pro.team"
            :size="48"
            position="50% 8%"
        /></span>
        <img v-else class="tr-face" :src="profileIcon(p.icon)" alt="" />
        <span class="col" style="min-width: 0">
          <span class="h4 ell"
            ><span :data-riot="p.riot ? '' : undefined">{{ p.name }}</span
            ><span v-if="p.tag" class="lb-tag" :data-riot-tag="p.riot ? '' : undefined">{{
              p.tag
            }}</span></span
          >
          <span class="row" style="gap: 6px"
            ><RankEmblem :tier="p.tier" :size="18" /><span class="h5 num"
              >{{ n(p.lp!) }} LP</span
            ></span
          >
        </span>
      </Link>
    </div>
    <div
      ref="track"
      class="tr-track"
      :style="{ '--lift': `${levels * 46}px` }"
      role="img"
      :aria-label="gapText ?? 'The first ten by LP'"
    >
      <span class="tr-line"></span>
      <Link
        v-for="d in rest"
        :key="d.p.place"
        class="tr-dot"
        :style="{ left: `${d.x}%` }"
        :href="d.p.href"
        :title="`${d.p.place}${ord(d.p.place)}, ${d.p.lp !== null ? n(d.p.lp) : '-'} LP`"
        ><i></i><span v-if="d.label">{{ d.p.place }}</span></Link
      >
      <Link
        v-for="{ p, x, level, i } in pins"
        :key="p.place"
        class="tr-pin"
        :class="[`l${i}`]"
        :style="{
          'left': `${x}%`,
          'top': `calc(var(--lift) - ${level * 46}px)`,
          '--stem': `${18 + level * 46}px`,
        }"
        :href="p.href"
        :title="`${p.place}${ord(p.place)}, ${n(p.lp!)} LP`"
      >
        <span v-if="p.pro" class="tr-pf"
          ><ProPic
            :slug="p.pro.slug"
            :photo="p.pro.photo"
            :team="p.pro.team"
            :size="32"
            position="50% 8%"
        /></span>
        <img v-else class="tr-pf" :src="profileIcon(p.icon)" alt="" />
        <i></i>
      </Link>
      <span class="tr-end lo meta num">{{ n(ranked[ranked.length - 1]?.lp ?? 0) }} LP</span>
      <span class="tr-end hi meta num">{{ n(ranked[0]?.lp ?? 0) }} LP</span>
    </div>
    <p class="meta tr-cap">
      <template v-if="gapText">{{ gapText }}</template
      ><template v-if="span">; {{ span }}</template>
    </p>
  </div>
</template>
