<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { onMounted, ref } from 'vue'
import { champIcon, profileIcon } from '../../lib/assets.js'
import {
  forgetRecent,
  recentHref,
  recentKey,
  recentPlayers,
  type RecentPlayer,
} from '../../lib/recent.js'
import ProPhoto from '../champions/ProPhoto.vue'

/**
 * The profiles this browser opened last, newest first, in one line under the search: a portrait
 * and the Riot ID, a pro's photo and name, or a champion's portrait and name. The list lives on this device only (lib/recent.ts), so it is read after
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
        :key="recentKey(player)"
        :href="recentHref(player)"
        prefetch
        class="hm-chip"
      >
        <ProPhoto
          v-if="player.pro"
          :slug="player.pro.slug"
          :photo="player.pro.photo"
          :width="22"
          :height="22"
          class="photo"
        />
        <img
          v-else-if="player.champion"
          :src="champIcon(player.champion.id)"
          alt=""
          width="22"
          height="22"
          decoding="async"
        />
        <img
          v-else
          :src="profileIcon(player.profileIconId)"
          alt=""
          width="22"
          height="22"
          decoding="async"
        />
        <span class="nm">{{ player.gameName }}</span>
        <small>{{
          player.pro
            ? player.pro.staff
              ? 'Staff'
              : 'Pro'
            : player.champion
              ? 'Champion'
              : `#${player.tagLine}`
        }}</small>
      </Link>
      <button type="button" class="clear" @click="forget">Clear</button>
    </div>
  </div>
</template>
