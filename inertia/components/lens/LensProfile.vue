<script setup lang="ts">
import { computed } from 'vue'
import { PerfDial } from '@invadelol/ui'
import { dot, tone } from './tone.js'
import { PACE_RATING, type LensDomain } from '../../lib/lens.js'

/**
 * The Lens at a glance: the average score of the games read, and every domain on one scale with
 * the Emerald pace as a dashed line through them all, each rating to its left or right.
 */
const props = defineProps<{
  domains: LensDomain[]
  score: number | null
  games: number
  roleName: string
  timelineGames: number
}>()

const emit = defineEmits<{ open: [key: string] }>()

const rated = computed(() =>
  props.domains.filter((d): d is LensDomain & { rating: number } => d.rating !== null)
)
const strongest = computed(() =>
  rated.value.length > 1 ? [...rated.value].sort((a, b) => b.rating - a.rating)[0] : null
)
const weakest = computed(() =>
  rated.value.length > 1 ? [...rated.value].sort((a, b) => a.rating - b.rating)[0] : null
)
/** The strongest and weakest domains, each with the first sentence of its read. */
const calls = computed(() =>
  strongest.value && weakest.value
    ? [
        { title: 'Strongest', domain: strongest.value, says: lead(strongest.value.read) },
        { title: 'Weakest', domain: weakest.value, says: lead(weakest.value.read) },
      ]
    : []
)
const lead = (read: string | null) => read?.match(/^[^.]*\./)?.[0] ?? null

/**
 * Where a rating sits on the track. Ratings live mostly between 10 and 80 (the pace is ~41, 80 a
 * rare window), so the track spans that range and anything past it rests at its end.
 */
const LOW = 10
const HIGH = 80
const at = (rating: number) => Math.max(0, Math.min(100, ((rating - LOW) / (HIGH - LOW)) * 100))
const pace = at(PACE_RATING)

function bar(rating: number) {
  return {
    left: `${Math.min(at(rating), pace)}%`,
    width: `${Math.abs(at(rating) - pace)}%`,
    background: tone(rating),
  }
}

const NEEDS: Record<string, string> = {
  timeline: 'Needs a timeline',
  games: 'Needs more games',
}
</script>

<template>
  <section class="iv-panel lit-sheet lv-hero">
    <div class="lv-summary">
      <div class="label">Invade score</div>
      <div class="mt-2 flex items-center gap-3">
        <PerfDial :score="score" />
        <div class="num text-[12px] leading-[18px] text-ink-3">
          <div>
            <span class="font-semibold text-ink-2">{{ games }}</span>
            {{ games === 1 ? 'game' : 'games' }} as {{ roleName }}
          </div>
          <div>{{ timelineGames }} with a timeline</div>
        </div>
      </div>
      <p class="lv-key">
        Each domain is rated like the Invade score. The dashed line is the Emerald pace for
        {{ roleName }}; a dot to its right is ahead of it.
      </p>
    </div>

    <dl v-if="strongest && weakest" class="lv-calls">
      <div v-for="call in calls" :key="call.title" class="lv-call">
        <dt>
          <span>{{ call.title }}</span>
          <button type="button" @click="emit('open', call.domain.key)">
            {{ call.domain.label }}
            <span class="num" :style="{ color: tone(call.domain.rating) }">{{
              call.domain.rating
            }}</span>
          </button>
        </dt>
        <dd v-if="call.says">{{ call.says }}</dd>
      </div>
    </dl>

    <div class="lv-scale" :style="{ '--pace': `${pace}%` }">
      <div class="lv-scale-head" aria-hidden="true">
        <span class="lv-scale-pace">Emerald pace</span>
      </div>
      <ol class="lv-rows">
        <li v-for="domain in domains" :key="domain.key">
          <button
            type="button"
            class="lv-row"
            :aria-label="`${domain.label}: ${domain.rating ?? 'not rated yet'}`"
            @click="emit('open', domain.key)"
          >
            <span class="lv-row-label">{{ domain.label }}</span>
            <span class="lv-track" :class="{ empty: domain.rating === null }">
              <template v-if="domain.rating !== null">
                <i class="lv-fill" :style="bar(domain.rating)" />
                <i
                  class="lv-dot"
                  :style="{ left: `${at(domain.rating)}%`, ...dot(domain.rating) }"
                />
              </template>
              <span v-else class="lv-track-need">{{ NEEDS[domain.need ?? 'games'] }}</span>
            </span>
            <span class="lv-row-value num" :class="{ quiet: domain.rating === null }">
              {{ domain.rating ?? '–' }}
            </span>
          </button>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.lv-hero {
  display: grid;
  gap: 24px;
  padding: 20px;
}

/* Wide: the summary above its calls on the left, the scale beside both. Narrow: the scale comes
   right after the summary, the calls under it. */
@media (min-width: 48rem) {
  .lv-hero {
    grid-template-columns: 220px minmax(0, 1fr);
    grid-template-rows: auto 1fr;
    column-gap: 40px;
    row-gap: 0;
  }

  .lv-summary {
    grid-column: 1;
    grid-row: 1;
  }

  .lv-scale {
    grid-column: 2;
    grid-row: 1 / span 2;
  }

  .lv-calls {
    grid-column: 1;
    grid-row: 2;
    align-self: end;
  }
}

@media (max-width: 47.99rem) {
  .lv-calls {
    order: 3;
  }
}

.lv-key {
  margin-top: 16px;
  font-size: 12px;
  line-height: 18px;
  color: var(--text-3);
  text-wrap: pretty;
}

.lv-calls {
  display: grid;
  gap: 14px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}

.lv-call dt {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: var(--text-3);
}

.lv-call dt button {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  transition: color var(--t-fast) var(--ease);
}

.lv-call dt button:hover {
  color: var(--brand-hi);
}

.lv-call dd {
  margin-top: 3px;
  font-size: 12.5px;
  line-height: 18px;
  color: var(--text-2);
  text-wrap: pretty;
}

/* The scale: a label column, the 0–100 track, the rating. The pace runs through every track. */
.lv-scale {
  --label: 104px;
  --value: 32px;
  --gap: 14px;
  min-width: 0;
}

.lv-scale-head {
  position: relative;
  height: 18px;
  margin-left: calc(var(--label) + var(--gap));
  margin-right: calc(var(--value) + var(--gap));
}

.lv-scale-pace {
  position: absolute;
  left: var(--pace);
  bottom: 2px;
  font-size: 11px;
  line-height: 14px;
  color: var(--text-4);
  white-space: nowrap;
  transform: translateX(-50%);
}

.lv-row {
  display: grid;
  grid-template-columns: var(--label) minmax(0, 1fr) var(--value);
  align-items: center;
  gap: var(--gap);
  width: 100%;
  height: 38px;
  padding: 0;
  text-align: left;
  border-radius: var(--r-sm);
  transition: background-color var(--t-base) var(--ease);
}

@media (hover: hover) {
  .lv-row:hover {
    background: linear-gradient(90deg, var(--glint), transparent 92%);
  }
}

.lv-row-label {
  padding-left: 2px;
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.lv-row-value {
  font-size: 14px;
  font-weight: 600;
  text-align: right;
  color: var(--text-1);
}

.lv-row-value.quiet {
  color: var(--text-4);
  font-weight: 500;
}

/* The track: a hairline 0–100; the pace a dashed line that joins from row to row. */
.lv-track {
  position: relative;
  align-self: stretch;
  background:
    repeating-linear-gradient(var(--line-3) 0 3px, transparent 3px 6px) var(--pace) 0 / 1px 100%
      no-repeat,
    linear-gradient(var(--track), var(--track)) 0 50% / 100% 2px no-repeat;
}

.lv-fill {
  position: absolute;
  top: 50%;
  height: 4px;
  margin-top: -2px;
  border-radius: 2px;
  opacity: 0.55;
}

.lv-dot {
  position: absolute;
  top: 50%;
  width: 9px;
  height: 9px;
  margin: -4.5px 0 0 -4.5px;
  border-radius: 50%;
}

.lv-track.empty {
  background: repeating-linear-gradient(var(--line-3) 0 3px, transparent 3px 6px) var(--pace) 0 /
    1px 100% no-repeat;
}

.lv-track-need {
  position: absolute;
  top: 50%;
  left: calc(var(--pace) + 10px);
  max-width: calc(100% - var(--pace) - 10px);
  overflow: hidden;
  font-size: 11.5px;
  line-height: 14px;
  color: var(--text-4);
  white-space: nowrap;
  text-overflow: ellipsis;
  transform: translateY(-50%);
}

@media (max-width: 26rem) {
  .lv-scale {
    --label: 86px;
    --value: 24px;
    --gap: 10px;
  }

  .lv-hero {
    padding: 16px;
  }
}
</style>
