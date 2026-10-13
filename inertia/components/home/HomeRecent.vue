<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { onMounted, ref } from 'vue'
import { RankCrest } from '@invadelol/ui'
import { profileIcon } from '../../lib/assets.js'
import { profilePath } from '../../lib/format.js'
import { forgetRecent, recentPlayers, type RecentPlayer } from '../../lib/recent.js'

/**
 * The profiles this browser opened last, newest first: a portrait, the Riot ID and the rank's
 * crest, nothing else. The list lives on this device only (lib/recent.ts), so it is read after
 * hydration and the server never renders it.
 */
const recent = ref<RecentPlayer[]>([])
onMounted(() => (recent.value = recentPlayers()))

function forget() {
  forgetRecent()
  recent.value = []
}
</script>

<template>
  <section v-if="recent.length" class="recent" aria-labelledby="recent-title">
    <div class="section">
      <h2 id="recent-title">Recently viewed</h2>
      <button type="button" class="iv-btn ghost sm clear" @click="forget">Clear</button>
    </div>

    <ul class="list iv-panel">
      <li v-for="player in recent" :key="`${player.gameName}#${player.tagLine}`">
        <Link :href="profilePath(player.gameName, player.tagLine)" class="row">
          <img
            :src="profileIcon(player.profileIconId)"
            alt=""
            width="28"
            height="28"
            loading="lazy"
            class="thumb icon"
          />
          <span class="name">
            <span class="game-name">{{ player.gameName }}</span>
            <span class="tag">#{{ player.tagLine }}</span>
          </span>
          <RankCrest v-if="player.rank?.tier" :tier="player.rank.tier" :size="16" />
        </Link>
      </li>
    </ul>
  </section>
</template>

<style scoped>
/* It arrives after the page has painted, so it fades in rather than appearing at once. */
.recent {
  animation: recent-in 320ms var(--ease-settle) backwards;
}

.section {
  align-items: center;
}

.clear {
  margin-left: auto;
  margin-right: -8px;
}

/* One sheet, one profile per row, no rules between them. */
.list {
  display: grid;
  gap: 2px;
  padding: 6px;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 44px;
  padding: 0 12px 0 8px;
  border-radius: var(--r-sm);
  transition: background-color var(--t-base) var(--ease);
}

.row:hover {
  background: var(--glint);
}

.row:focus-visible {
  outline: none;
  box-shadow: var(--focus);
}

.icon {
  width: 28px;
  height: 28px;
  border-radius: var(--r-sm);
}

.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 13.5px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.game-name {
  font-weight: 600;
  color: var(--text-1);
}

.tag {
  color: var(--text-3);
}

@keyframes recent-in {
  from {
    opacity: 0;
  }
}
</style>
