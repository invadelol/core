<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import { onMounted, ref } from 'vue'
import { Github, X } from 'lucide-vue-next'
import SearchBar from '../components/SearchBar.vue'
import ThemeToggle from '../components/ui/ThemeToggle.vue'
import Wordmark from '../components/ui/Wordmark.vue'
import { profileIcon } from '../lib/assets.js'
import { profilePath, timeAgo } from '../lib/format.js'
import { recentPlayers, type RecentPlayer } from '../lib/recent.js'
import { REPO_URL } from '../lib/links.js'

const recent = ref<RecentPlayer[]>([])

onMounted(() => (recent.value = recentPlayers()))

function forget() {
  try {
    localStorage.removeItem('invade-recent')
  } catch {
    /* nothing to forget */
  }
  recent.value = []
}
</script>

<template>
  <Head title="Find a summoner" />

  <div class="flex min-h-screen flex-col">
    <header class="mx-auto flex w-full max-w-[1080px] items-center gap-4 px-5 py-5">
      <Wordmark :size="20" />
      <div class="ml-auto flex items-center gap-0.5">
        <ThemeToggle />
        <a
          :href="REPO_URL"
          target="_blank"
          rel="noreferrer"
          class="icon-btn"
          title="Source on GitHub"
        >
          <Github :size="15" />
          <span class="sr-only">Source code on GitHub</span>
        </a>
      </div>
    </header>

    <main class="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center px-5 pb-28">
      <h1 class="display text-center text-[clamp(32px,5vw,44px)] text-ink">Find a summoner</h1>

      <div class="mt-7">
        <SearchBar size="lg" autofocus />
      </div>

      <section v-if="recent.length" class="card mt-8">
        <div class="section">
          <h2>Recently viewed</h2>
          <button class="meta ml-auto transition-colors hover:text-ink" @click="forget">
            <X :size="11" class="mr-0.5 inline" />Clear
          </button>
        </div>

        <ul class="!p-1.5">
          <li v-for="player in recent" :key="`${player.gameName}#${player.tagLine}`">
            <Link
              :href="profilePath(player.gameName, player.tagLine)"
              class="flex items-center gap-3 rounded-[7px] px-2.5 py-2 transition-colors hover:bg-raised"
            >
              <img
                :src="profileIcon(player.profileIconId)"
                alt=""
                width="30"
                height="30"
                loading="lazy"
                class="thumb h-[30px] w-[30px] rounded-[7px]"
              />
              <span class="min-w-0 flex-1 truncate text-[13px]">
                <span class="font-semibold text-ink">{{ player.gameName }}</span>
                <span class="text-ink-3">#{{ player.tagLine }}</span>
              </span>
              <span class="num shrink-0 text-[11px] text-ink-3">{{ timeAgo(player.at) }}</span>
            </Link>
          </li>
        </ul>
      </section>
    </main>

    <footer class="mx-auto w-full max-w-[1080px] px-5 py-6 text-[10.5px] text-ink-4">
      Not affiliated with or endorsed by Riot Games. League of Legends is a trademark of Riot Games,
      Inc.
    </footer>
  </div>
</template>
