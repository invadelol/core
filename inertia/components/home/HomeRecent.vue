<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { onMounted, ref } from 'vue'
import { profileIcon } from '../../lib/assets.js'
import { profilePath } from '../../lib/format.js'
import { forgetRecent, recentPlayers, type RecentPlayer } from '../../lib/recent.js'

/**
 * The profiles this browser opened last, newest first, in one line under the search: a portrait
 * and the Riot ID. The list lives on this device only (lib/recent.ts), so it is read after
 * hydration and the server never renders it; its line keeps its height either way.
 */
const recent = ref<RecentPlayer[]>([])
onMounted(() => (recent.value = recentPlayers().slice(0, 5)))

function forget() {
  forgetRecent()
  recent.value = []
}
</script>

<template>
  <div class="hm-recent" :aria-hidden="recent.length ? undefined : 'true'">
    <div v-if="recent.length" class="in">
      <span class="lbl">Recent</span>
      <Link
        v-for="player in recent"
        :key="`${player.gameName}#${player.tagLine}`"
        :href="profilePath(player.gameName, player.tagLine)"
        prefetch
        class="hm-chip"
      >
        <img
          :src="profileIcon(player.profileIconId)"
          alt=""
          width="22"
          height="22"
          decoding="async"
        />
        <span class="nm">{{ player.gameName }}</span>
        <small>#{{ player.tagLine }}</small>
      </Link>
      <button type="button" class="clear" @click="forget">Clear</button>
    </div>
  </div>
</template>
