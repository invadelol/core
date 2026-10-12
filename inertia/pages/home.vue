<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import { onMounted, ref } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import SearchBar from '../components/SearchBar.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { RankCrest, useFormat } from '@invadelol/ui'
import { rankLabel, tierColor } from '@invadelol/ui/logic'
import { profileIcon, regionLabel } from '../lib/assets.js'
import { profilePath } from '../lib/format.js'
import { forgetRecent, recentPlayers, type RecentPlayer } from '../lib/recent.js'

const { ago } = useFormat()

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

    <main class="mx-auto w-full max-w-[680px] flex-1 px-4 pt-[clamp(56px,16vh,168px)] sm:px-6">
      <h1 class="text-[28px] font-semibold leading-[1.15] tracking-[-0.012em] sm:text-[32px]">
        Find a player
      </h1>
      <div class="mt-5">
        <SearchBar size="lg" autofocus />
      </div>

      <!-- One panel, one list: the players this browser opened last, newest first. -->
      <section v-if="recent.length" class="iv-panel mt-10" aria-labelledby="recent-title">
        <div class="flex h-11 items-center justify-between gap-3 px-4">
          <h2 id="recent-title" class="text-[14px] font-semibold text-ink">Recently viewed</h2>
          <button type="button" class="iv-btn ghost sm -mr-2" @click="forget">Clear</button>
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
                class="h-[30px] w-[30px] rounded-[5px] shadow-[var(--portrait-sm)]"
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
                <RankCrest :tier="player.rank.tier" :size="16" />
                {{ rankLabel({ ...player.rank, lp: player.rank.leaguePoints }, false) }}
              </span>
              <span
                v-if="player.platform"
                class="hidden w-9 shrink-0 text-right text-[12px] text-ink-3 sm:block"
              >
                {{ regionLabel(player.platform) }}
              </span>
              <span class="num w-[52px] shrink-0 text-right text-[12px] text-ink-3">
                {{ ago(player.at) }}
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
  background: var(--surface-2);
}
</style>
