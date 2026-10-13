<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { onMounted, ref } from 'vue'
import { RankCrest } from '@invadelol/ui'
import { profileIcon } from '../../lib/assets.js'
import { profilePath } from '../../lib/format.js'
import { forgetRecent, recentPlayers, type RecentPlayer } from '../../lib/recent.js'

/** The profiles this browser opened last, as one quiet row under the search. */
const recent = ref<RecentPlayer[]>([])
onMounted(() => (recent.value = recentPlayers()))

function forget() {
  forgetRecent()
  recent.value = []
}
</script>

<template>
  <nav v-if="recent.length" class="recent" aria-label="Recently viewed">
    <ul class="scroll-x fade-r flex items-center gap-1.5 pr-6">
      <li v-for="player in recent" :key="`${player.gameName}#${player.tagLine}`" class="shrink-0">
        <Link :href="profilePath(player.gameName, player.tagLine)" class="chip">
          <img
            :src="profileIcon(player.profileIconId)"
            alt=""
            width="20"
            height="20"
            loading="lazy"
            class="thumb h-5 w-5 rounded-[4px]"
          />
          <span class="max-w-[16ch] truncate">
            <span class="font-medium text-ink">{{ player.gameName }}</span>
            <span class="text-ink-3">#{{ player.tagLine }}</span>
          </span>
          <RankCrest v-if="player.rank?.tier" :tier="player.rank.tier" :size="14" />
        </Link>
      </li>
    </ul>
    <button type="button" class="iv-btn ghost sm shrink-0" @click="forget">Clear</button>
  </nav>
</template>

<style scoped>
.recent {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.recent > ul {
  min-width: 0;
  flex: 1;
  padding-block: 2px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 10px 0 5px;
  font-size: 12.5px;
  color: var(--text-2);
  background: var(--surface-1);
  border-radius: 999px;
  box-shadow: var(--lit);
  transition: background-color var(--t-fast) var(--ease);
}

.chip:hover {
  background: var(--surface-2);
}

@media (pointer: coarse) {
  .chip {
    height: 36px;
  }
}
</style>
