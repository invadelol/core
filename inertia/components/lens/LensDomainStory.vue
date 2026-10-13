<script setup lang="ts">
import { computed } from 'vue'
import LensStory from './LensStory.vue'
import LensPace from './LensPace.vue'
import LensShare from './LensShare.vue'
import LensWards from './LensWards.vue'
import LensTug from './LensTug.vue'
import LensDeaths from './LensDeaths.vue'
import LensSwarm from './LensSwarm.vue'
import { figureText, type LensDomain, type LensFigure, type LensPayload } from '../../lib/lens.js'

/**
 * Every domain but laning as a story: one big figure, one picture of it, the sentence. Laning
 * has its own (LensLaning).
 */
const props = defineProps<{
  domain: LensDomain
  lens: LensPayload
  champion: number | null
  labels: string[]
}>()

const figure = (key: string): LensFigure | undefined =>
  props.domain.figures.find((f) => f.key === key)
const refOf = (f: LensFigure | undefined, label: string) =>
  f?.refs.find((r) => r.label === label)?.value ?? null
const value = (key: string) => figure(key)?.value ?? null

/** The figure that carries the card. */
const leadKey = computed(
  () =>
    ({
      farming: figure('csm') ? 'csm' : 'gpm',
      fighting: 'dpm',
      vision: 'vision',
      objectives: 'objectives',
      survival: 'kda',
      consistency: 'swing',
    })[props.domain.key as string] ?? null
)

/** That figure big, with its unit. */
const lead = computed(() => {
  const f = leadKey.value ? figure(leadKey.value) : undefined
  if (!f || f.value === null) return null
  const unit: Record<string, string> = {
    csm: 'CS a minute',
    gpm: 'gold a minute',
    dpm: 'damage a minute',
    vision: 'vision score a minute',
    objectives: 'objective damage a game',
    kda: 'KDA',
    swing: 'points of swing around your average',
  }
  const text = (v: number) => figureText(v, f.digits, f.unit)
  return {
    value: `${f.plusMinus ? '±' : ''}${text(f.value)}`,
    unit: unit[f.key] ?? f.label,
  }
})

/** Only when fewer games than the window say this; the window itself is in the page header. */
const meta = computed(() => {
  const n = props.domain.games
  const all = props.lens.games.length
  return n < all ? `${n} of ${all} games` : ''
})

const pace = computed(() =>
  ['csm', 'gpm']
    .map((key) => figure(key))
    .filter((f): f is LensFigure => Boolean(f && f.value !== null))
    .map((f) => ({
      label: f.label,
      you: f.value!,
      pace: refOf(f, 'Emerald'),
      opponents: refOf(f, 'Opponents'),
      digits: f.digits,
    }))
)

const wards = computed(() => [
  {
    key: 'wards',
    item: 3340,
    label: 'placed a game',
    you: value('wards'),
    opponents: refOf(figure('wards'), 'Opponents'),
  },
  {
    key: 'control',
    item: 2055,
    label: 'control wards',
    you: value('control'),
    opponents: refOf(figure('control'), 'Opponents'),
  },
  {
    key: 'cleared',
    item: 3364,
    label: 'cleared a game',
    you: value('cleared'),
    opponents: refOf(figure('cleared'), 'Opponents'),
  },
])

const objectives = computed(() => {
  const o = props.lens.objectives
  if (!o) return []
  return [
    {
      key: 'dragons',
      icon: 'dragon' as const,
      label: 'Dragons',
      you: o.you.dragons,
      them: o.them.dragons,
    },
    {
      key: 'heralds',
      icon: 'herald' as const,
      label: 'Heralds',
      you: o.you.heralds,
      them: o.them.heralds,
    },
    {
      key: 'barons',
      icon: 'baron' as const,
      label: 'Barons',
      you: o.you.barons,
      them: o.them.barons,
    },
    {
      key: 'towers',
      icon: 'tower' as const,
      label: 'Towers',
      you: o.you.towers,
      them: o.them.towers,
    },
  ]
})

const epic = computed(() => figure('epic'))
const scores = computed(() =>
  props.lens.games.map((g) => g.score).filter((s): s is number => s !== null)
)
const average = computed(() =>
  scores.value.length ? scores.value.reduce((a, b) => a + b, 0) / scores.value.length : null
)
const wide = computed(() => ['survival', 'consistency'].includes(props.domain.key))
</script>

<template>
  <LensStory
    :domain="domain"
    :meta="meta"
    :labels="labels"
    :wide="wide"
    :shown="leadKey ? [leadKey] : []"
    :class="{ 'lg:col-span-2': wide }"
  >
    <template #figure>
      <div v-if="lead" class="lv-lead">
        <span class="iv-fig">{{ lead.value }}</span>
        <span class="lv-lead-unit">{{ lead.unit }}</span>
      </div>
    </template>

    <template #visual>
      <LensPace v-if="domain.key === 'farming'" :rows="pace" />

      <LensShare
        v-else-if="domain.key === 'fighting'"
        :champion="champion"
        :kills="value('kp')"
        :damage="value('share')"
        :pace="refOf(figure('kp'), 'Emerald')"
        :opponents="{
          kills: refOf(figure('kp'), 'Opponents'),
          damage: refOf(figure('share'), 'Opponents'),
        }"
      />

      <LensWards v-else-if="domain.key === 'vision'" :items="wards" />

      <div v-else-if="domain.key === 'objectives'" class="lv-objectives">
        <LensTug v-if="objectives.length" :rows="objectives" :sides="['Your team', 'Theirs']" />
        <p v-if="epic?.value !== null && epic?.value !== undefined" class="lv-epic num">
          You took {{ figureText(epic.value, 1) }} of them a game yourself<template
            v-if="refOf(epic, 'Opponents') !== null"
            >, the enemy jungler {{ figureText(refOf(epic, 'Opponents')!, 1) }}</template
          >.
        </p>
      </div>

      <LensDeaths v-else-if="domain.key === 'survival'" :games="lens.games" :labels="labels" />

      <LensSwarm
        v-else-if="domain.key === 'consistency'"
        :games="lens.games"
        :average="average"
        :swing="value('swing')"
      />
    </template>
  </LensStory>
</template>

<style scoped>
.lv-lead {
  display: grid;
  gap: 4px;
}

.lv-lead .iv-fig {
  font-size: 48px;
  line-height: 0.95;
  letter-spacing: -0.02em;
}

.lv-lead-unit {
  font-size: 13px;
  color: var(--text-2);
}

.lv-epic {
  margin-top: 14px;
  font-size: 12.5px;
  color: var(--text-3);
}
</style>
