<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import HomeRank from './HomeRank.vue'
import { compact, profilePath } from '../../lib/format.js'
import { profileIcon, regionLabel } from '../../lib/assets.js'
import type { HomeTrending } from '../../lib/home.js'

/** The most viewed profiles of the week (lifetime views until a week has been counted). */
defineProps<{ trending: HomeTrending }>()
</script>

<template>
  <section aria-labelledby="trending-title">
    <div class="section">
      <h2 id="trending-title">Trending</h2>
      <span class="meta">{{
        trending.window === 'week' ? 'Views · 7 days' : 'Views · all time'
      }}</span>
    </div>

    <ol class="iv-panel overflow-hidden">
      <li
        v-for="(player, i) in trending.players"
        :key="`${player.gameName}#${player.tagLine}`"
        class="line"
      >
        <Link :href="profilePath(player.gameName, player.tagLine)" class="row">
          <span class="num w-4 shrink-0 text-right text-[12px] text-ink-4">{{ i + 1 }}</span>
          <img
            :src="profileIcon(player.profileIconId)"
            alt=""
            width="32"
            height="32"
            loading="lazy"
            class="thumb h-8 w-8 rounded-[6px]"
          />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[13.5px] leading-[18px]">
              <span class="font-semibold text-ink">{{ player.gameName }}</span>
              <span class="text-ink-3">#{{ player.tagLine }}</span>
            </span>
            <span class="mt-0.5 flex min-w-0 items-center gap-2 text-[12px] leading-4">
              <HomeRank :rank="player.rank" />
            </span>
          </span>
          <span class="shrink-0 text-right">
            <span class="num block text-[13px] font-semibold leading-[18px] text-ink">
              {{ compact(player.views) }}
            </span>
            <span class="mt-0.5 block text-[12px] leading-4 text-ink-3">
              {{ regionLabel(player.platform) }}
            </span>
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
  padding: 8px 16px 8px 10px;
  transition: background-color var(--t-fast) var(--ease);
}

.row:hover {
  background: var(--surface-2);
}
</style>
