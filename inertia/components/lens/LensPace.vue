<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { figureText } from '../../lib/lens.js'

/**
 * A figure as a speed: a track with the player's value filled in violet, the Emerald pace as a
 * dashed mark and the lane opponents as a hollow one. The scale is cut to the values so the gaps
 * read; the fill runs out when it first shows.
 */
const props = defineProps<{
  rows: Array<{
    label: string
    you: number
    pace: number | null
    opponents: number | null
    digits: number
  }>
}>()

const ready = ref(false)
onMounted(() => requestAnimationFrame(() => requestAnimationFrame(() => (ready.value = true))))

const tracks = computed(() =>
  props.rows.map((row) => {
    const values = [row.you, row.pace, row.opponents].filter((v): v is number => v !== null)
    const lo = Math.min(...values) * 0.7
    const hi = Math.max(...values) * 1.12
    const at = (v: number) => ((v - lo) / Math.max(1e-6, hi - lo)) * 100
    const pace = row.pace === null ? null : at(row.pace)
    const opponents = row.opponents === null ? null : at(row.opponents)
    return {
      ...row,
      you: at(row.you),
      pace,
      opponents,
      /* Two marks too close to label side by side: the opponents' label drops a line. */
      apart: pace === null || opponents === null || Math.abs(pace - opponents) > 22,
      text: (v: number) => figureText(v, row.digits),
      raw: { you: row.you, pace: row.pace, opponents: row.opponents },
    }
  })
)
</script>

<template>
  <div class="lv-pace" :class="{ ready }">
    <div v-for="t in tracks" :key="t.label" class="lv-pace-row">
      <div class="lv-pace-label">{{ t.label }}</div>
      <div class="lv-pace-track">
        <i class="lv-pace-fill" :style="{ width: ready ? `${t.you}%` : '0%' }" />
        <i
          v-if="t.pace !== null"
          class="lv-pace-mark pace"
          :style="{ left: `${t.pace}%` }"
          :title="`Emerald pace ${t.text(t.raw.pace!)}`"
        />
        <i
          v-if="t.opponents !== null"
          class="lv-pace-mark opp"
          :style="{ left: `${t.opponents}%` }"
          :title="`Opponents ${t.text(t.raw.opponents!)}`"
        />
        <i class="lv-pace-you" :style="{ left: ready ? `${t.you}%` : '0%' }" />
        <span class="lv-pace-tag you num" :style="{ left: `${t.you}%` }">
          {{ t.text(t.raw.you) }}
        </span>
        <span v-if="t.pace !== null" class="lv-pace-tag below num" :style="{ left: `${t.pace}%` }">
          Emerald {{ t.text(t.raw.pace!) }}
        </span>
        <span
          v-if="t.opponents !== null"
          class="lv-pace-tag below num"
          :class="{ low: !t.apart }"
          :style="{ left: `${t.opponents}%` }"
        >
          Opponents {{ t.text(t.raw.opponents!) }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lv-pace {
  display: grid;
  gap: 22px;
}

.lv-pace-label {
  font-size: 12px;
  color: var(--text-3);
}

.lv-pace-track {
  position: relative;
  height: 6px;
  margin: 30px 30px 40px 0;
  border-radius: 3px;
  background: var(--track);
}

.lv-pace-fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 3px;
  background: linear-gradient(90deg, rgb(var(--brand-rgb) / 0.08), rgb(var(--brand-rgb) / 0.55));
  transition: width 1100ms var(--ease-glide);
}

.lv-pace-you {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  margin: -7px 0 0 -7px;
  border-radius: 50%;
  background: var(--brand);
  box-shadow:
    0 0 0 3px var(--solid-1),
    var(--contact);
  transition: left 1100ms var(--ease-glide);
}

.lv-pace-mark {
  position: absolute;
  top: -7px;
  bottom: -7px;
  width: 0;
}

.lv-pace-mark.pace {
  border-left: 1px dashed var(--text-2);
}

.lv-pace-mark.opp {
  top: 50%;
  bottom: auto;
  width: 10px;
  height: 10px;
  margin: -5px 0 0 -5px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--text-3);
  background: var(--solid-1);
}

.lv-pace-tag {
  position: absolute;
  font-size: 12px;
  line-height: 14px;
  white-space: nowrap;
  color: var(--text-3);
  transform: translateX(-50%);
  transition: opacity 400ms 900ms var(--ease);
}

.lv-pace-tag.you {
  bottom: calc(100% + 12px);
  font-size: 15px;
  font-weight: 650;
  color: var(--text-1);
}

.lv-pace-tag.below {
  top: calc(100% + 10px);
}

.lv-pace-tag.below.low {
  top: calc(100% + 26px);
}

.lv-pace:not(.ready) .lv-pace-tag {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .lv-pace-fill,
  .lv-pace-you,
  .lv-pace-tag {
    transition: none;
  }
}
</style>
