<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { Download } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import AppWindow from '../components/AppWindow.vue'
import DownloadButton from '../components/DownloadButton.vue'
import OverlayStage from '../components/OverlayStage.vue'
import { detectDesktopTarget, type DesktopPlatform } from '../lib/platform.js'

defineProps<{ version: string | null }>()

interface Feature {
  id: string
  label: string
  title: string
  lead: string
  points: string[]
  note?: string
  image?: string
  alt?: string
}

const features: Feature[] = [
  {
    id: 'overlay',
    label: 'Overlay',
    title: 'Numbers on your screen, not another tab.',
    lead: 'Small widgets over the game, placed wherever you like. They only read what the game already exposes on your own computer.',
    points: [
      'Win probability, gold lead and a fight meter',
      'Dragon, Baron, Herald and Grubs timers, and enemy respawns',
      'Gold per lane while you hold Tab',
      'The next item to build, and tips that react to the game',
    ],
  },
  {
    id: 'champ-select',
    label: 'Champ select',
    title: 'Know the game before it starts.',
    lead: 'Scout all ten players and read the draft while you pick.',
    points: [
      'Draft win chance, split into picks, lanes and duos',
      'Rank, recent form and flags such as smurf, one-trick or on a streak',
      'The best runes, build and spells for your champion, sent to the client for you',
    ],
    note: 'In ranked, the client hides enemy names until the game starts, so only their champions are analysed before then.',
    image: 'live',
    alt: 'Champ select view with draft win chance, lane matchups, both teams and every scouted player',
  },
  {
    id: 'history',
    label: 'Match history',
    title: 'Every game, taken apart.',
    lead: 'A full post-game analysis, and a history that keeps growing past what the League client remembers.',
    points: [
      'An Invade score from 0 to 10 for every player, with MVP and ACE',
      'Scoreboard, gold and XP graphs, damage, timeline and build',
      'All your accounts in one place, even when the client is closed',
    ],
    image: 'profile',
    alt: 'Profile with rank, recent form and an expanded match scoreboard',
  },
  {
    id: 'champions',
    label: 'Champions',
    title: 'Builds, tiers and counters.',
    lead: 'Statistics for every champion, by role and rank.',
    points: [
      'Runes, skill order, items and lane matchups',
      'A tier list with win, pick and ban rates and patch movement',
      'A counter-pick helper that can stay within your champion pool',
    ],
    image: 'champion',
    alt: 'Champion page with tier, win rate, runes, summoner spells and skill order',
  },
  {
    id: 'recording',
    label: 'Recording',
    title: 'Every game on record.',
    lead: 'Games record on their own, with the moments that matter cut out for you.',
    points: [
      'Clips for kills, deaths, assists and objectives',
      'Native capture with hardware encoding, so it stays light',
      'A hotkey to record your screen whenever you want',
    ],
    image: 'recordings',
    alt: 'Recordings page with clips grouped by game',
  },
]

const facts = [
  { title: 'Free', text: 'No account and no subscription.' },
  {
    title: 'Runs on your computer',
    text: 'Only Riot’s local APIs. No memory reading, no injection.',
  },
  { title: '12 languages', text: 'Picked up from your League client.' },
  { title: 'Updates itself', text: 'Checks in the background, installs when you click.' },
]

const downloads: Array<{ id: DesktopPlatform; name: string; detail: string }> = [
  { id: 'windows', name: 'Windows', detail: 'Windows 10 or later · 64-bit' },
  { id: 'mac-arm', name: 'macOS · Apple Silicon', detail: 'M1 and later · macOS 13 or later' },
  { id: 'mac-intel', name: 'macOS · Intel', detail: 'macOS 13 or later' },
]

/** Highlights the row that fits this computer, once the browser is inspected. */
const mine = ref<DesktopPlatform | null>(null)
onMounted(async () => (mine.value = await detectDesktopTarget()))
</script>

<template>
  <Head title="Invade for desktop" />

  <AppHeader />

  <main>
    <!-- Hero -->
    <section class="mx-auto w-full max-w-[1120px] px-5 pt-16 pb-14 sm:pt-24">
      <p class="label flex items-center gap-2.5">
        <span class="inline-block h-3.5 w-[3px] -skew-x-[14deg] bg-brand" />Invade for desktop
      </p>
      <h1 class="display mt-5 max-w-[12ch] text-[clamp(46px,9vw,100px)] text-ink">
        Your League companion.
      </h1>
      <p class="mt-6 max-w-[54ch] text-[15px] leading-relaxed text-ink-2 sm:text-base">
        An overlay in game, scouting in champ select, and the full story of every match after. Free,
        light, and it runs entirely on your computer.
      </p>

      <div class="mt-9">
        <DownloadButton />
        <p class="mt-3 text-[11.5px] text-ink-3">
          <template v-if="version">Version {{ version }} · </template>Windows and macOS
        </p>
      </div>

      <AppWindow
        name="dashboard"
        alt="The Invade dashboard: win rate, form over the last games, rank and recent matches"
        eager
        class="mt-14 shadow-[var(--shadow-e2)]"
      />
    </section>

    <!-- Facts -->
    <section class="border-y border-line">
      <dl class="mx-auto grid w-full max-w-[1120px] sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="fact in facts"
          :key="fact.title"
          class="border-line px-5 py-6 sm:border-l sm:first:border-l-0 lg:first:border-l-0 [&:nth-child(3)]:sm:border-l-0 lg:[&:nth-child(3)]:border-l"
        >
          <dt class="text-[14px] font-bold text-ink">{{ fact.title }}</dt>
          <dd class="mt-1.5 text-[12.5px] leading-relaxed text-ink-3">{{ fact.text }}</dd>
        </div>
      </dl>
    </section>

    <!-- Features -->
    <section
      v-for="feature in features"
      :id="feature.id"
      :key="feature.id"
      class="mx-auto w-full max-w-[1120px] scroll-mt-20 px-5 py-12 sm:py-20"
    >
      <div class="grid gap-x-14 gap-y-7 lg:grid-cols-2">
        <div>
          <p class="label flex items-center gap-2.5">
            <span class="inline-block h-3.5 w-[3px] -skew-x-[14deg] bg-brand" />{{ feature.label }}
          </p>
          <h2 class="display mt-4 max-w-[16ch] text-[clamp(32px,4.6vw,50px)] text-ink">
            {{ feature.title }}
          </h2>
        </div>
        <div class="lg:pt-7">
          <p class="max-w-[52ch] text-[14.5px] leading-relaxed text-ink-2">{{ feature.lead }}</p>
          <ul class="mt-5 space-y-2.5">
            <li
              v-for="point in feature.points"
              :key="point"
              class="flex gap-3 text-[13.5px] leading-snug text-ink"
            >
              <span class="mt-[3px] inline-block h-3 w-[3px] shrink-0 -skew-x-[14deg] bg-ink-4" />
              {{ point }}
            </li>
          </ul>
          <p v-if="feature.note" class="mt-4 max-w-[52ch] text-[11.5px] leading-relaxed text-ink-3">
            {{ feature.note }}
          </p>
        </div>
      </div>

      <div class="mt-10">
        <OverlayStage v-if="feature.id === 'overlay'" />
        <AppWindow v-else :name="feature.image!" :alt="feature.alt!" />
      </div>
    </section>

    <!-- Download -->
    <section id="download" class="border-t border-line">
      <div class="mx-auto w-full max-w-[1120px] scroll-mt-20 px-5 py-16 sm:py-24">
        <p class="label flex items-center gap-2.5">
          <span class="inline-block h-3.5 w-[3px] -skew-x-[14deg] bg-brand" />Download
        </p>
        <h2 class="display mt-4 text-[clamp(30px,4.4vw,44px)] text-ink">Get Invade.</h2>
        <p class="mt-4 max-w-[52ch] text-[14px] leading-relaxed text-ink-2">
          Free, for Windows and macOS.<template v-if="version">
            Latest version: {{ version }}.</template
          >
        </p>

        <ul class="mt-10 border-t border-line">
          <li
            v-for="target in downloads"
            :key="target.id"
            class="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line py-5"
          >
            <div class="min-w-0 flex-1">
              <p class="flex items-center gap-2.5 text-[15px] font-bold text-ink">
                {{ target.name }}
                <span
                  v-if="mine === target.id"
                  class="rounded-[3px] bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-brand-hi uppercase"
                >
                  Your computer
                </span>
              </p>
              <p class="mt-1 text-[12.5px] text-ink-3">{{ target.detail }}</p>
            </div>
            <a
              :href="`/download/${target.id}`"
              class="btn"
              :class="mine === target.id ? 'btn-primary' : ''"
            >
              <Download :size="14" />Download
            </a>
          </li>
        </ul>

        <div class="mt-8 max-w-[68ch] text-[12.5px] leading-relaxed text-ink-3">
          <p class="font-semibold text-ink-2">Builds are not code-signed yet.</p>
          <p class="mt-1.5">
            Your system may ask you to confirm the first time. On Windows, choose
            <em class="not-italic text-ink-2">More info</em>, then
            <em class="not-italic text-ink-2">Run anyway</em>. On macOS, drag Invade to
            Applications, then right-click it and choose
            <em class="not-italic text-ink-2">Open</em>.
          </p>
        </div>
      </div>
    </section>
  </main>

  <footer class="border-t border-line">
    <div class="mx-auto w-full max-w-[1120px] px-5 py-6 text-[10.5px] text-ink-4">
      Not affiliated with or endorsed by Riot Games. League of Legends is a trademark of Riot Games,
      Inc.
    </div>
  </footer>
</template>
