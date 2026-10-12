<script setup lang="ts">
import { computed } from 'vue'
import { ChampIcon, useFormat, useNames } from '@invadelol/ui'
import type { MatchDetail, PlayerView } from '@invadelol/ui/logic'
import PlayerLink from './PlayerLink.vue'

/**
 * Damage to champions against damage taken, one row per player on one scale, most damage first:
 * who carried the fight and who stood in front of it. A row selects its player for the page.
 */
const props = defineProps<{ detail: MatchDetail; selected: number; me?: PlayerView }>()
const emit = defineEmits<{ select: [index: number] }>()
const { compact } = useFormat()
const { champName } = useNames()

const us = computed(() => props.me?.teamId ?? props.detail.players[0]?.teamId)
const rows = computed(() => {
  const players = props.detail.players
  const scale = Math.max(1, ...players.map((p) => Math.max(p.damage, p.damageTaken)))
  return players
    .map((p, i) => ({ p, i, dealt: p.damage / scale, taken: p.damageTaken / scale }))
    .sort((a, b) => b.p.damage - a.p.damage)
})
</script>

<template>
  <section class="dmg" aria-label="Damage">
    <header class="dmg-head">
      <h3>Damage</h3>
      <span class="dmg-key"><i class="dealt" />To champions</span>
      <span class="dmg-key"><i class="taken" />Taken</span>
    </header>
    <ul>
      <li
        v-for="{ p, i, dealt, taken } in rows"
        :key="p.puuid"
        class="dmg-row"
        :class="{ on: i === selected }"
        @click="emit('select', i)"
      >
        <button
          type="button"
          class="dmg-pick"
          :aria-pressed="i === selected"
          :aria-label="`Select ${p.gameName || champName(p.championId)}`"
        >
          <ChampIcon :id="p.championId" :size="24" />
        </button>
        <i class="dmg-side" :class="p.teamId === us ? 'ally' : 'enemy'" />
        <PlayerLink
          v-if="p.gameName"
          :game-name="p.gameName"
          :tag-line="p.tagLine"
          :is-self="p.puuid === me?.puuid"
          class="dmg-name"
          @click.stop
        />
        <span v-else class="dmg-name">{{ champName(p.championId) }}</span>
        <span
          class="dmg-bars"
          :title="`${compact(p.damage)} to champions · ${compact(p.damageTaken)} taken`"
        >
          <i
            class="dealt"
            :class="{ self: p.puuid === me?.puuid }"
            :style="{ width: `${dealt * 100}%` }"
          />
          <i class="taken" :style="{ width: `${taken * 100}%` }" />
        </span>
        <b class="num">{{ compact(p.damage) }}</b>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.dmg-head {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--text-3);
}
.dmg-head h3 {
  margin-right: auto;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}
.dmg-key {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.dmg-key i {
  width: 8px;
  height: 6px;
  border-radius: 2px;
  background: var(--bar);
}
.dmg-key i.taken {
  height: 3px;
  background: var(--text-4);
}

.dmg-row {
  display: grid;
  grid-template-columns: 24px 2px minmax(0, 140px) minmax(0, 1fr) 48px;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 8px;
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: background var(--t-fast) var(--ease);
}
.dmg-row:hover,
.dmg-row.on {
  background: var(--surface-2);
}
.dmg-row.on {
  box-shadow: inset 2px 0 0 var(--brand);
}

.dmg-pick {
  display: grid;
  border-radius: var(--r-xs);
}
.dmg-pick:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}

/* The side as a thin tick, so ten rows sorted by damage still read as two teams. */
.dmg-side {
  width: 2px;
  height: 16px;
  border-radius: 1px;
  background: var(--win);
}
.dmg-side.enemy {
  background: var(--loss);
}

.dmg-name {
  min-width: 0;
  font-size: 12.5px;
}

.dmg-bars {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.dmg-bars i {
  display: block;
  height: 6px;
  min-width: 1px;
  border-radius: 2px;
  background: var(--bar);
}
.dmg-bars i.self {
  background: var(--brand);
}
.dmg-bars i.taken {
  height: 3px;
  background: var(--text-4);
}

.dmg-row b {
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

@media (max-width: 520px) {
  .dmg-row {
    grid-template-columns: 24px 2px minmax(0, 80px) minmax(0, 1fr) 40px;
    gap: 8px;
  }
}
</style>
