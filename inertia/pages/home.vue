<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import { onMounted, ref } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import SearchBar from '../components/SearchBar.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { profileIcon, rankCrest, rankName, regionLabel, tierColor } from '../lib/assets.js'
import { profilePath, timeAgo } from '../lib/format.js'
import { forgetRecent, recentPlayers, type RecentPlayer } from '../lib/recent.js'

/** Read after hydration: the list lives in this browser only. */
const recent = ref<RecentPlayer[]>([])

onMounted(() => (recent.value = recentPlayers()))

function forget() {
  forgetRecent()
  recent.value = []
}
</script>

<template>
  <Head title="Find a player" />

  <div class="flex min-h-screen flex-col">
    <AppHeader :search="false" />

    <main class="mx-auto w-full max-w-[680px] flex-1 px-5 pt-[clamp(56px,16vh,168px)] sm:px-6">
      <h1 class="display text-[28px] text-ink sm:text-[32px]">Find a player</h1>
      <div class="mt-5">
        <SearchBar size="lg" autofocus />
      </div>

      <!-- One panel, one list: the players this browser opened last, newest first. -->
      <section v-if="recent.length" class="card mt-10" aria-labelledby="recent-title">
        <div class="flex h-11 items-center justify-between gap-3 px-4">
          <h2 id="recent-title" class="text-[14px] font-semibold text-ink">Recently viewed</h2>
          <button
            class="-mr-1.5 rounded-[5px] px-1.5 py-0.5 text-[12px] font-medium text-ink-3 transition-colors hover:text-ink"
            @click="forget"
          >
            Clear
          </button>
        </div>

        <ul class="px-1.5 pb-1.5">
          <li v-for="player in recent" :key="`${player.gameName}#${player.tagLine}`">
            <Link
              :href="profilePath(player.gameName, player.tagLine)"
              class="recent flex h-11 items-center gap-3 rounded-[5px] px-2.5 transition-colors"
            >
              <img
                :src="profileIcon(player.profileIconId)"
                alt=""
                width="30"
                height="30"
                loading="lazy"
                class="thumb h-[30px] w-[30px] rounded-[5px]"
              />
              <span class="min-w-0 flex-1 truncate text-[13.5px] leading-[18px]">
                <span class="font-semibold text-ink">{{ player.gameName }}</span>
                <span class="text-ink-3">#{{ player.tagLine }}</span>
              </span>
              <span
                v-if="player.rank?.tier"
                class="flex shrink-0 items-center gap-1.5 text-[12px] font-semibold"
                :style="{ color: tierColor(player.rank.tier) }"
              >
                <img :src="rankCrest(player.rank.tier)" alt="" class="h-4 w-4" />
                {{ rankName(player.rank.tier, player.rank.division) }}
              </span>
              <span
                v-if="player.platform"
                class="hidden w-9 shrink-0 text-right text-[12px] text-ink-3 sm:block"
              >
                {{ regionLabel(player.platform) }}
              </span>
              <span class="num w-[52px] shrink-0 text-right text-[12px] text-ink-3">
                {{ timeAgo(player.at) }}
              </span>
            </Link>
          </li>
        </ul>
      </section>
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
.recent:hover {
  background: var(--color-raised);
}
</style>
