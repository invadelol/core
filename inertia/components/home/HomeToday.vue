<script setup lang="ts">
import { TrendLine } from '@invadelol/ui'
import { compact } from '../../lib/format.js'
import type { HomeToday } from '../../lib/home.js'

/**
 * The day on invade.lol in four figures: games of the last 24 hours (with their hours as one
 * line), profiles refreshed, profiles and games stored. `stacked` is the rail's narrow form.
 */
defineProps<{ today: HomeToday; stacked?: boolean }>()

const full = (n: number) => n.toLocaleString('en-US')
</script>

<template>
  <section class="iv-panel today" :class="{ stacked }" aria-label="Today on invade.lol">
    <div class="games">
      <div class="label">Games · 24 h</div>
      <div class="iv-fig mt-2 text-[28px] text-ink">{{ full(today.games) }}</div>
      <div
        class="spark"
        role="img"
        :aria-label="`Stored games per hour over the last 24 hours, ${today.games} in all`"
      >
        <TrendLine :values="today.hourly" :height="40" area />
        <div class="flex justify-between text-[11px] leading-4 text-ink-4">
          <span>24 h ago</span><span>now</span>
        </div>
      </div>
    </div>

    <dl class="figures">
      <div>
        <dt class="label">Updated · 24 h</dt>
        <dd class="num mt-2 text-[20px] font-semibold leading-none text-ink">
          {{ full(today.updated) }}
        </dd>
      </div>
      <div>
        <dt class="label">Players</dt>
        <dd class="num mt-2 text-[20px] font-semibold leading-none text-ink">
          {{ compact(today.players) }}
        </dd>
      </div>
      <div>
        <dt class="label">Games stored</dt>
        <dd class="num mt-2 text-[20px] font-semibold leading-none text-ink">
          {{ compact(today.stored) }}
        </dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.today {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

.games {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: auto auto;
  column-gap: 24px;
  align-items: end;
  padding: 16px 16px 14px;
}

.games > .label {
  grid-column: 1;
}

.games > .iv-fig {
  grid-column: 1;
  grid-row: 2;
}

.spark {
  grid-column: 2;
  grid-row: 1 / span 2;
  min-width: 0;
}

.figures {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-top: 1px solid var(--line);
}

.figures > div {
  min-width: 0;
  padding: 14px 16px 16px;
}

.figures > div + div {
  border-left: 1px solid var(--line);
}

.figures .num {
  text-align: left;
}

/* Wide: one band, the games and their line first, then the three counts. */
@media (min-width: 48rem) {
  .today:not(.stacked) {
    grid-template-columns: minmax(0, 1.5fr) minmax(0, 1.6fr);
  }

  .today:not(.stacked) .games {
    padding: 18px 20px;
  }

  .today:not(.stacked) .figures {
    border-top: 0;
    border-left: 1px solid var(--line);
  }

  .today:not(.stacked) .figures > div {
    padding: 18px 20px;
    align-self: stretch;
  }
}
</style>
