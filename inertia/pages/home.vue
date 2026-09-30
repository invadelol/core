<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import { onMounted, ref } from 'vue'
import { ArrowRight, Github, X } from 'lucide-vue-next'
import SearchBar from '../components/SearchBar.vue'
import ThemeToggle from '../components/ui/ThemeToggle.vue'
import Glyph from '../components/ui/Glyph.vue'
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
      <div class="ml-auto flex items-center gap-1.5">
        <Link href="/app" class="btn btn-sm hidden sm:inline-flex" title="The Invade desktop app">
          App
        </Link>
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
      <Glyph :size="46" class="mx-auto" />
      <h1 class="display mt-6 text-center text-[clamp(34px,5.4vw,52px)] font-extrabold text-ink">
        Find a summoner
      </h1>
      <div class="mt-7">
        <SearchBar size="lg" autofocus />
      </div>
      <Link href="/app" class="app-tag mx-auto mt-6">
        <span class="app-tag-new">New</span>
        Get the Invade app now
        <ArrowRight :size="13" class="app-tag-arrow" />
      </Link>

      <section v-if="recent.length" class="card mt-10">
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
              class="flex items-center gap-3 rounded-sm px-2.5 py-2 transition-colors hover:bg-raised"
            >
              <img
                :src="profileIcon(player.profileIconId)"
                alt=""
                width="30"
                height="30"
                loading="lazy"
                class="thumb h-[30px] w-[30px] rounded-sm"
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

<style scoped>
/* A pointer to the desktop app, below the search. */
.app-tag {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 4px 12px 4px 4px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--color-ink-2);
  background: var(--color-panel);
  border: 1px solid var(--color-line-2);
  transition:
    color var(--t-base) var(--ease),
    border-color var(--t-base) var(--ease);
}
.app-tag:hover {
  color: var(--color-ink);
  border-color: color-mix(in srgb, var(--color-brand) 55%, transparent);
}
.app-tag-new {
  padding: 2px 7px 2px 6px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-accent-fg);
  background: var(--color-accent);
  clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 0 100%);
}
.app-tag-arrow {
  color: var(--color-ink-3);
  transition: translate var(--t-base) var(--ease);
}
.app-tag:hover .app-tag-arrow {
  translate: 2px 0;
  color: var(--color-brand);
}
</style>
