<script setup lang="ts">
import { computed } from 'vue'
import { ObjectiveIcon, StatIcon, type ObjectiveIconName, type StatIconName } from '@invadelol/ui'
import { ICONS, ICON_TONES, type IconDef, type IconName, type IconTone } from '../../lib/icons.js'

/**
 * One of the site's icons (lib/icons.ts), by name: a Lucide line glyph (24 px grid, 2 px strokes,
 * round caps), Riot's own glyph for a game concept, or a brand mark. `tone` colours it: `auto`
 * takes the name's meaning colour (gold, red) for a section or card head, a tone forces one.
 */
const props = withDefaults(
  defineProps<{
    name: IconName
    size?: number
    strokeWidth?: number
    tone?: IconTone | 'auto' | null
  }>(),
  { size: 16, strokeWidth: 2, tone: null }
)

const def = computed<IconDef>(() => ICONS[props.name])
const kind = computed(() => {
  const d = def.value as object
  if ('paths' in d) return 'paths'
  if ('stat' in d) return 'stat'
  if ('objective' in d) return 'objective'
  return 'line'
})
const paths = computed(() => (def.value as { paths: { d: string; transform?: string }[] }).paths)
const stat = computed(() => (def.value as { stat: StatIconName }).stat)
const objective = computed(() => (def.value as { objective: ObjectiveIconName }).objective)
/** Inline, so it wins over whatever colour the head around it gives its icons. */
const TONE_COLOR: Record<IconTone, string> = { gold: 'var(--gold)', red: 'var(--loss)' }
const toneStyle = computed(() => {
  const tone = props.tone === 'auto' ? ICON_TONES[props.name] : props.tone
  return tone ? { color: TONE_COLOR[tone] } : undefined
})
</script>

<template>
  <StatIcon
    v-if="kind === 'stat'"
    class="i riot"
    :style="toneStyle"
    :name="stat"
    :size="size"
    aria-hidden="true"
  />
  <ObjectiveIcon
    v-else-if="kind === 'objective'"
    class="i riot"
    :style="toneStyle"
    :name="objective"
    :size="size"
    aria-hidden="true"
  />
  <svg
    v-else-if="kind === 'paths'"
    class="i"
    :style="toneStyle"
    :width="size"
    :height="size"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth * 0.8"
    stroke-linejoin="round"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path v-for="(p, i) in paths" :key="i" :d="p.d" :transform="p.transform" />
  </svg>
  <component
    :is="def"
    v-else
    class="i"
    :style="toneStyle"
    :size="size"
    :stroke-width="strokeWidth"
    aria-hidden="true"
  />
</template>
