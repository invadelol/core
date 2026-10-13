<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { TrendLine } from '@invadelol/ui'
import { tierRgb } from '@invadelol/ui/logic'
import HomeRank from './HomeRank.vue'
import { profilePath } from '../../lib/format.js'
import { profileIcon } from '../../lib/assets.js'
import type { Climb } from '../../lib/home.js'

/** The biggest Solo/Duo gains of the last day, each with its climb as one line. */
defineProps<{ climbs: Climb[] }>()

const record = (c: Climb) => (c.losses === null ? `${c.wins}W` : `${c.wins}W ${c.losses}L`)
</script>

<template>
  <section aria-labelledby="climbs-title">
    <div class="section">
      <h2 id="climbs-title">Climbs</h2>
      <span class="meta">Solo/Duo · 24 h</span>
    </div>

    <ol class="iv-panel lit-sheet overflow-hidden">
      <li v-for="c in climbs" :key="`${c.player.gameName}#${c.player.tagLine}`" class="line">
        <Link
          :href="profilePath(c.player.gameName, c.player.tagLine)"
          class="row"
          :class="{ plain: !c.player.rank }"
          :style="c.player.rank ? { '--tint': tierRgb(c.player.rank.tier) } : undefined"
        >
          <img
            :src="profileIcon(c.player.profileIconId)"
            alt=""
            width="32"
            height="32"
            loading="lazy"
            class="thumb h-8 w-8 rounded-[6px]"
          />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[13.5px] leading-[18px]">
              <span class="font-semibold text-ink">{{ c.player.gameName }}</span>
              <span class="text-ink-3">#{{ c.player.tagLine }}</span>
            </span>
            <span class="mt-0.5 flex min-w-0 items-center gap-2 text-[12px] leading-4">
              <HomeRank :rank="c.player.rank" />
            </span>
          </span>
          <span class="spark" role="img" :aria-label="`Climbed ${c.gain} LP today`">
            <TrendLine :values="c.points" :height="28" area />
          </span>
          <span class="w-[64px] shrink-0 text-right">
            <span class="num block text-[13.5px] font-semibold leading-[18px] text-ink">
              +{{ c.gain }} <span class="text-[11.5px] font-medium text-ink-3">LP</span>
            </span>
            <span class="num mt-0.5 block text-[12px] leading-4 text-ink-3">{{ record(c) }}</span>
          </span>
        </Link>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.line + .line {
  border-top: 1px solid var(--line);
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 8px 16px 8px 12px;
}

/* A ranked player's line takes the faint light of their tier, rising from the portrait. */
.row {
  --row: transparent;
  background:
    linear-gradient(
      90deg,
      rgb(var(--tint) / var(--home-tint)),
      rgb(var(--tint) / var(--home-tint-far)) 34%,
      rgb(var(--tint) / 0) 66%
    ),
    var(--row);
}

.row.plain {
  background: var(--row);
}

.row:hover {
  --row: var(--surface-2);
}

.spark {
  display: block;
  flex: 0 0 auto;
  width: clamp(48px, 16%, 96px);
}
</style>
