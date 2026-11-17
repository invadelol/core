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
import TeamLogo from '../champions/TeamLogo.vue'

/**
 * What this browser looked up last, newest first, in one quiet line under the home's search: a
 * small picture (round for people, square for champions) and the name, a player's tag in grey.
 * The list lives on this device only (lib/recent.ts), so it is read after hydration and the server
 * never renders it; its line keeps its height either way.
 */
const recent = ref<RecentPlayer[]>([])
onMounted(() => (recent.value = recentPlayers().slice(0, 4)))

function forget() {
  forgetRecent()
  recent.value = []
}
</script>

<template>
  <div class="rc" :aria-hidden="recent.length ? undefined : 'true'">
    <template v-if="recent.length">
      <span class="rc-l">Recent</span>
      <Link
        v-for="player in recent"
        :key="recentKey(player)"
        :href="recentHref(player)"
        prefetch
        class="rc-i"
      >
        <ProPhoto
          v-if="player.pro"
          :slug="player.pro.slug"
          :photo="player.pro.photo"
          :width="20"
          :height="20"
          class="rc-p pr"
        />
        <img
          v-else-if="player.champion"
          class="rc-p ch"
          :src="champIcon(player.champion.id)"
          alt=""
          width="20"
          height="20"
        />
        <span v-else-if="player.team" class="rc-p tm"
          ><TeamLogo
            :team="{ id: player.team.id, name: player.gameName, shortName: player.team.shortName }"
            :size="16"
        /></span>
        <img
          v-else
          class="rc-p"
          :src="profileIcon(player.profileIconId)"
          alt=""
          width="20"
          height="20"
          decoding="async"
        />
        <b>{{ player.gameName }}</b
        ><span v-if="!player.pro && !player.champion && !player.team">#{{ player.tagLine }}</span>
      </Link>
      <button type="button" class="rc-x" @click="forget">Clear</button>
    </template>
  </div>
</template>
