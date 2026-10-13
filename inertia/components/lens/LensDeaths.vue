<script setup lang="ts">
import { computed } from 'vue'
import type { LensGame } from '../../lib/lens.js'

/**
 * Deaths, game by game (oldest first): yours as violet columns, your lane opponent's as a faint
 * outline behind each, so the games that went wrong stand out. The columns rise when shown.
 */
const props = defineProps<{ games: LensGame[]; labels: string[] }>()

const max = computed(() =>
  Math.max(4, ...props.games.map((g) => Math.max(g.deaths, g.opponentDeaths ?? 0)))
)
const columns = computed(() =>
  props.games.map((g, i) => ({
    id: g.matchId,
    you: (g.deaths / max.value) * 100,
    them: g.opponentDeaths === null ? null : (g.opponentDeaths / max.value) * 100,
    title: `${props.labels[i] ?? ''} · ${g.deaths} deaths${
      g.opponentDeaths === null ? '' : `, opponent ${g.opponentDeaths}`
    }`,
    delay: `${120 + i * 22}ms`,
  }))
)
</script>

<template>
  <div class="lv-deaths">
    <div
      class="lv-deaths-plot"
      role="img"
      :aria-label="`Deaths in each of the last ${games.length} games`"
    >
      <span v-for="c in columns" :key="c.id" class="lv-deaths-col" :title="c.title">
        <i v-if="c.them !== null" class="them" :style="{ bottom: `${c.them}%` }" />
        <i class="you" :style="{ height: `${Math.max(2, c.you)}%`, animationDelay: c.delay }" />
      </span>
    </div>
    <div class="lv-deaths-axis">
      <span>{{ games.length }} games ago</span>
      <span class="lv-deaths-key"><i class="you" />You <i class="them" />Lane opponent</span>
      <span>Latest</span>
    </div>
  </div>
</template>

<style scoped>
.lv-deaths-plot {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 120px;
  padding-bottom: 1px;
  border-bottom: 1px solid var(--line-2);
}

.lv-deaths-col {
  position: relative;
  flex: 1;
  height: 100%;
  min-width: 0;
}

.lv-deaths-col i {
  position: absolute;
  bottom: 0;
  border-radius: 2px 2px 0 0;
}

/* The opponent's deaths: a short mark at their height, not a box. */
.lv-deaths-col .them {
  z-index: 1;
  inset-inline: 8%;
  height: 0 !important;
  border-top: 2px solid var(--text-3);
  border-radius: 1px;
}

.lv-deaths-col .you {
  inset-inline: 22%;
  background: var(--brand);
  transform-origin: bottom;
  animation: lv-rise 800ms var(--ease-glide) both;
}

@keyframes lv-rise {
  from {
    transform: scaleY(0);
  }
}

.lv-deaths-axis {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-4);
}

.lv-deaths-key {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-3);
}

.lv-deaths-key i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.lv-deaths-key i.you {
  background: var(--brand);
}

.lv-deaths-key i.them {
  height: 2px;
  margin-left: 6px;
  background: var(--text-3);
}

@media (prefers-reduced-motion: reduce) {
  .lv-deaths-col .you {
    animation: none;
  }
}
</style>
