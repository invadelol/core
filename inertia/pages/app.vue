<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { Download } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import DownloadButton from '../components/DownloadButton.vue'
import SiteFooter from '../components/SiteFooter.vue'
import Chapter from '../components/landing/Chapter.vue'
import SceneGame from '../components/landing/SceneGame.vue'
import SceneDraft from '../components/landing/SceneDraft.vue'
import ScenePostGame from '../components/landing/ScenePostGame.vue'
import SceneChampions from '../components/landing/SceneChampions.vue'
import SceneRecording from '../components/landing/SceneRecording.vue'
import { detectDesktopTarget, type DesktopPlatform } from '../lib/platform.js'

defineProps<{ version: string | null }>()

/**
 * /app: the desktop app shown working, one chapter per moment of a game (in game, champ select,
 * after the game, champions, recordings). Each chapter is a player frame that stays in view
 * while the page scrolls: the scroll moves the camera over the real UI, one caption at a time.
 */
const CHAPTERS = {
  game: [
    {
      title: 'Over your game',
      text: "Drawn on top of League from Riot's live game data. Nothing is injected, nothing is read from memory.",
    },
    {
      title: 'Objective timers',
      text: 'Dragon, grubs, herald and Baron as countdowns, and the dragons each team holds.',
    },
    {
      title: 'Your pace',
      text: 'CS, gold, kill participation and KDA against a rank above yours, CS and level against your lane opponent.',
    },
    {
      title: 'Your next item',
      text: 'The next item of your build and the gold it still takes, counting the components you own.',
    },
    {
      title: 'Only what you want',
      text: 'Switch on Win & gold or the champ select widgets, hold Tab for each lane’s gold, and drag any widget where it suits you.',
    },
  ],
  draft: [
    {
      title: 'Picks as they happen',
      text: 'Both teams fill in as players hover and lock, with the turn order, the clock and the draft odds.',
    },
    {
      title: 'Every ally’s rank',
      text: 'Solo/Duo rank next to each ally. Enemy names stay hidden until the game starts, as the client hides them.',
    },
    {
      title: 'The setup for your pick',
      text: 'The most played runes, spells, skill order and items for your champion and role, at your rank.',
    },
    {
      title: 'Runes in your client',
      text: 'The rune page goes into the client as soon as you hover or lock. No copying, no tabbing out.',
    },
  ],
  postGame: [
    {
      title: 'A score for every game',
      text: 'The plate lights up with the game, gold for an exceptional one. MVP and ACE go to the best of each team.',
    },
    {
      title: 'All ten players',
      text: 'Open the game for the full scoreboard: damage, gold, vision and every player’s score.',
    },
    {
      title: 'On invade.lol too',
      text: 'Look up any player and open a game: each score shows what it is made of, read against the lobby and weighted for the role.',
    },
  ],
  champions: [
    {
      title: 'Your tier list',
      text: 'Every champion of your role at your rank: tier, win rate against the role, pick and ban rates.',
    },
    {
      title: 'One click to the champion',
      text: 'A row opens the champion in that role and rank. Back returns to the list as you left it.',
    },
    {
      title: 'The build that is played',
      text: 'Runes, spells, skill order, starter, boots, core items and what to buy after, with their win rates.',
    },
    {
      title: 'Ready for your next game',
      text: 'Save the setup and champ select picks it up, runes included.',
    },
  ],
  recording: [
    {
      title: 'Recorded on its own',
      text: 'From a few seconds in to the end, on your graphics card’s encoder. Nothing to start or stop.',
    },
    {
      title: 'Moments marked',
      text: 'Kills, deaths, assists and objectives are marked as they happen. A hotkey saves the last seconds.',
    },
    {
      title: 'Cut into clips',
      text: 'Each moment becomes a clip, cut without re-encoding and filed under the game it came from.',
    },
  ],
}

const facts = [
  { title: 'Free', text: 'No account, no subscription' },
  { title: 'Stays out of the game', text: 'No memory reading, no injection' },
  { title: '12 languages', text: 'Follows your League client' },
  { title: 'Updates itself', text: 'In the background' },
]

const downloads: Array<{ id: DesktopPlatform; name: string; detail: string }> = [
  { id: 'windows', name: 'Windows', detail: '64-bit, Windows 10 or later' },
  { id: 'mac-arm', name: 'macOS, Apple Silicon', detail: 'M1 and later, macOS 13 or later' },
  { id: 'mac-intel', name: 'macOS, Intel', detail: 'macOS 13 or later' },
]

/** The build for this computer, once the browser is inspected. */
const mine = ref<DesktopPlatform | null>(null)
onMounted(async () => (mine.value = await detectDesktopTarget()))
</script>

<template>
  <Head title="Invade for desktop" />

  <div class="flex min-h-screen flex-col">
    <AppHeader />

    <main class="landing flex-1">
      <!-- Hero: what it does, in a player's words, and the download -->
      <section class="wrap">
        <div class="hero fitted">
          <h1>
            <span class="kicker">Invade for desktop</span>Know when dragon spawns, how far ahead you
            are and what to buy next
          </h1>
          <div class="hero-side">
            <p class="hero-lead">
              Invade is a free League of Legends companion for Windows and macOS: timers and your
              pace while you play, ranks and runes in champ select, a score for all ten players
              after every game, and your games recorded.
            </p>
            <div class="hero-cta">
              <DownloadButton />
              <p v-if="version" class="num text-[12px] text-ink-3">Version {{ version }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- In game: Riot's footage, the overlay live over it -->
      <div class="wrap">
        <Chapter id="in-game" name="In game" :steps="CHAPTERS.game" :still="0">
          <template #default="{ step, active, still, narrow }">
            <SceneGame :step="step" :active="active" :still="still" :narrow="narrow" />
          </template>
        </Chapter>
      </div>

      <!-- Champ select -->
      <div class="wrap">
        <Chapter id="champ-select" name="Champ select" :steps="CHAPTERS.draft">
          <template #intro>
            <div class="intro fitted">
              <span class="kicker">Champ select</span>
              <h2>Know the lobby before you lock in</h2>
              <p>
                Both teams as they pick, every ally’s rank, the draft’s odds, and the setup for your
                champion with its runes already in your client.
              </p>
            </div>
          </template>
          <template #default="{ step, active, still, narrow }">
            <SceneDraft :step="step" :active="active" :still="still" :narrow="narrow" />
          </template>
        </Chapter>
      </div>

      <!-- After the game -->
      <div class="wrap">
        <Chapter id="after-the-game" name="After the game" :steps="CHAPTERS.postGame" :still="1">
          <template #intro>
            <div class="intro fitted">
              <span class="kicker">After the game</span>
              <h2>See how you really played</h2>
              <p>
                Every game gets a score from 0 to 100 for all ten players, rated against the other
                nine and weighted for each role.
              </p>
            </div>
          </template>
          <template #default="{ step, active, still, narrow }">
            <ScenePostGame :step="step" :active="active" :still="still" :narrow="narrow" />
          </template>
        </Chapter>
      </div>

      <!-- Champions -->
      <div class="wrap">
        <Chapter id="champions" name="Champions" :steps="CHAPTERS.champions" :still="2">
          <template #intro>
            <div class="intro fitted">
              <span class="kicker">Champions</span>
              <h2>Builds for your rank, every patch</h2>
              <p>
                A tier list for your role and rank, and a page for every champion with the runes,
                items, skill order and matchups that are played.
              </p>
            </div>
          </template>
          <template #default="{ step, active, still, narrow }">
            <SceneChampions :step="step" :active="active" :still="still" :narrow="narrow" />
          </template>
        </Chapter>
      </div>

      <!-- Recordings -->
      <div class="wrap">
        <Chapter id="recordings" name="Recordings" :steps="CHAPTERS.recording">
          <template #intro>
            <div class="intro fitted">
              <span class="kicker">Recordings</span>
              <h2>Every play, already clipped</h2>
              <p>
                Games record on their own. Your kills, deaths and objectives are cut into clips and
                filed under the game they came from.
              </p>
            </div>
          </template>
          <template #default="{ step, active, still, narrow }">
            <SceneRecording :step="step" :active="active" :still="still" :narrow="narrow" />
          </template>
        </Chapter>
      </div>

      <!-- Download -->
      <section id="download" class="wrap download scroll-mt-20">
        <div class="fitted">
          <header class="intro">
            <h2>Get Invade</h2>
            <p>
              Free, for Windows and macOS.<template v-if="version">
                Version {{ version }}.</template
              >
            </p>
          </header>

          <div class="download-grid">
            <ul class="card">
              <li v-for="target in downloads" :key="target.id" class="download-row">
                <span class="min-w-0 flex-1">
                  <span class="block text-[14px] font-semibold text-ink">
                    {{ target.name }}
                    <span v-if="mine === target.id" class="tag tag-brand ml-1.5 align-[1px]">
                      This computer
                    </span>
                  </span>
                  <span class="block text-[13px] text-ink-3">{{ target.detail }}</span>
                </span>
                <a
                  :href="`/download/${target.id}`"
                  class="btn"
                  :class="mine === target.id ? 'btn-primary' : ''"
                >
                  <Download :size="14" />
                  Download
                </a>
              </li>
            </ul>

            <ul class="facts">
              <li v-for="fact in facts" :key="fact.title">
                <p class="text-[14px] font-semibold text-ink">{{ fact.title }}</p>
                <p class="mt-0.5 text-[13px] text-ink-3">{{ fact.text }}</p>
              </li>
            </ul>
          </div>

          <p class="mt-6 max-w-[76ch] text-[13px] leading-relaxed text-ink-3">
            Builds are not code-signed yet, so your system may ask once. On Windows, choose
            <em class="not-italic text-ink-2">More info</em>, then
            <em class="not-italic text-ink-2">Run anyway</em>. On macOS, drag Invade to
            Applications, then right-click it and choose
            <em class="not-italic text-ink-2">Open</em>.
          </p>
        </div>
      </section>
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
.wrap {
  width: 100%;
  max-width: 1320px;
  margin-inline: auto;
  padding-inline: 16px;
}

/* The same width as the header's. */
@media (min-width: 1536px) {
  .wrap {
    max-width: 1480px;
  }
}

@media (min-width: 640px) {
  .wrap {
    padding-inline: 24px;
  }
}

@media (max-width: 640px) {
  .intro h2 {
    font-size: 24px;
  }

  .intro p {
    margin-top: 8px;
    font-size: 14.5px;
    line-height: 1.55;
  }
}

/* Text lines up with the edges of the player frames, which fit the window's height. */
.fitted {
  width: min(100%, calc((100svh - 164px) * 16 / 9));
  margin-inline: auto;
}

/* On a phone, and when nothing is pinned, the frames take the full width. */
@media (max-width: 640px), (prefers-reduced-motion: reduce), (max-height: 519px) {
  .fitted {
    width: 100%;
  }
}

/* ── Hero: the promise on the left, what it is and the download on the right ── */
.hero {
  display: grid;
  gap: 20px 56px;
  align-items: end;
  padding-top: clamp(40px, 8vh, 88px);
  padding-bottom: 8px;
}

@media (min-width: 1100px) {
  .hero {
    grid-template-columns: minmax(0, 1fr) 400px;
  }
}

.hero h1 {
  max-width: 15em;
  font-size: clamp(34px, min(4.3vw, 7svh), 62px);
  font-weight: 650;
  line-height: 1.03;
  letter-spacing: -0.03em;
  color: var(--color-ink);
  text-wrap: balance;
}

.hero-lead {
  max-width: 560px;
  font-size: 16px;
  line-height: 1.6;
  color: var(--color-ink-2);
  text-wrap: pretty;
}

.hero-cta {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px 20px;
  margin-top: 22px;
}

.hero-cta > p {
  height: 36px;
  line-height: 36px;
}

/* ── Chapter intros ───────────────────────────────────────────── */
/* Where the page is: the chapter's name, small and quiet, above its headline. */
.kicker {
  display: block;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: 0;
  color: var(--color-ink-3);
}

.hero h1 .kicker {
  margin-bottom: 16px;
}

.intro h2 {
  max-width: 20em;
  font-size: clamp(26px, 3.4vw, 40px);
  font-weight: 650;
  line-height: 1.1;
  letter-spacing: -0.022em;
  color: var(--color-ink);
  text-wrap: balance;
}

.intro p {
  max-width: 600px;
  margin-top: 14px;
  font-size: 16px;
  line-height: 1.6;
  color: var(--color-ink-2);
  text-wrap: pretty;
}

/* ── Download ─────────────────────────────────────────────────── */
.download {
  padding-bottom: 32px;
}

.download .intro {
  padding-top: clamp(72px, 14vh, 140px);
}

.download-grid {
  display: grid;
  gap: 32px;
  margin-top: 28px;
}

@media (min-width: 1024px) {
  .download-grid {
    grid-template-columns: minmax(0, 760px) minmax(0, 1fr);
    gap: 56px;
  }
}

.download-row {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 64px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-line);
}

.download-row:last-child {
  border-bottom: 0;
}

.facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 20px 32px;
}
</style>
