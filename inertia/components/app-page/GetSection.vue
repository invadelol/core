<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Download } from 'lucide-vue-next'
import { Logo } from '@invadelol/ui'
import { detectDesktopTarget, type DesktopPlatform } from '../../lib/platform.js'
import { vReveal } from './reveal.js'

/** The download, every build with its requirements, then the questions people ask first. */
defineProps<{ version: string | null }>()

const downloads: Array<{ id: DesktopPlatform; name: string; detail: string }> = [
  { id: 'windows', name: 'Windows', detail: '64-bit, Windows 10 or later' },
  { id: 'mac-arm', name: 'macOS, Apple Silicon', detail: 'M1 and later, macOS 13 or later' },
  { id: 'mac-intel', name: 'macOS, Intel', detail: 'macOS 13 or later' },
]

/** The build for this computer, once the browser is inspected. */
const mine = ref<DesktopPlatform | null>(null)
onMounted(async () => (mine.value = await detectDesktopTarget()))

const FAQ = [
  {
    q: 'Is Invade free?',
    a: 'Yes. There is no account and no subscription: Invade reads your profile from the League client on this computer, so there is nothing to sign up for.',
  },
  {
    q: 'Is it safe to use with Riot and Vanguard?',
    a: 'Invade only uses the two APIs Riot’s own software serves on your computer: the League client’s and the game’s Live Client Data API. It never reads the game’s memory and injects nothing into it. The overlay is a separate, transparent window drawn on top of the game.',
  },
  {
    q: 'Which computers does it run on?',
    a: 'Windows 10 or later (64-bit), and macOS 13 or later on Apple Silicon and Intel Macs. Recording needs Windows 10 version 1903 or later, and the Screen Recording permission on macOS.',
  },
  {
    q: 'Where are my clips stored?',
    a: 'On your computer, one folder per game: Movies/Invade on macOS, Videos\\Invade on Windows. When the storage limit is reached the oldest recordings go first; starred games and favorite clips are kept.',
  },
  {
    q: 'Does the overlay work in fullscreen?',
    a: 'It needs Borderless or Windowed mode, as no window can draw over exclusive fullscreen. When champ select starts, Invade switches a Fullscreen setting to Borderless through the League client, before the game opens.',
  },
  {
    q: 'What does Invade send, and where?',
    a: 'Your finished games go to invade.lol, so your profile there is up to date; Settings shows what was sent. Besides that, one anonymous ping when the app starts and one per update, which you can switch off in Settings.',
  },
  {
    q: 'Why does my computer warn me when I open it?',
    a: 'The builds are not code-signed yet, so your system may ask once. On Windows, choose More info, then Run anyway. On macOS, drag Invade to Applications, then right-click it and choose Open.',
  },
  {
    q: 'How does it update?',
    a: 'Invade checks for a new version in the background, never during a game, and installs it when you click Update. Every package is checked against Invade’s signature first.',
  },
]
</script>

<template>
  <section id="download" class="ap-section page get">
    <div v-reveal class="get-card">
      <Logo :size="40" class="get-logo" />
      <h2>Get Invade</h2>
      <p class="get-lead">
        Free, for Windows and macOS<template v-if="version">. Version {{ version }}</template
        >.
      </p>

      <ul class="get-rows">
        <li v-for="target in downloads" :key="target.id">
          <span class="get-name">
            <b>
              {{ target.name }}
              <span v-if="mine === target.id" class="iv-badge brand">This computer</span>
            </b>
            <small>{{ target.detail }}</small>
          </span>
          <a
            :href="`/download/${target.id}`"
            class="iv-btn"
            :class="{ primary: mine === target.id }"
          >
            <Download :size="14" />
            Download
          </a>
        </li>
      </ul>

      <p class="get-note">
        Builds are not code-signed yet, so your system may ask once. On Windows, choose
        <em>More info</em>, then <em>Run anyway</em>. On macOS, drag Invade to Applications, then
        right-click it and choose <em>Open</em>.
      </p>
    </div>

    <div class="faq">
      <h2 v-reveal>Questions</h2>
      <div class="faq-list">
        <details v-for="item in FAQ" :key="item.q" v-reveal>
          <summary>{{ item.q }}</summary>
          <p>{{ item.a }}</p>
        </details>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ── The download card ── */
.get-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 720px;
  margin-inline: auto;
  text-align: center;
}

.get-logo {
  margin-bottom: 24px;
}

.get-card h2 {
  font-size: clamp(32px, 4.4vw, 52px);
  font-weight: 650;
  line-height: 1.05;
  letter-spacing: -0.03em;
  color: var(--text-1);
}

.get-lead {
  margin-top: 12px;
  font-size: 17px;
  color: var(--text-2);
}

.get-rows {
  width: 100%;
  margin-top: 36px;
  overflow: hidden;
  text-align: left;
  background: var(--sheen), var(--surface-1);
  border-radius: var(--r-lg);
  box-shadow: var(--lit);
}

.get-rows li {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 68px;
  padding: 12px 16px 12px 22px;
  border-bottom: 1px solid var(--line);
}

.get-rows li:last-child {
  border-bottom: 0;
}

.get-name {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
}

.get-name b {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--text-1);
}

.get-name small {
  font-size: 13px;
  color: var(--text-3);
}

.get-note {
  max-width: 62ch;
  margin-top: 20px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-3);
}

.get-note em {
  font-style: normal;
  color: var(--text-2);
}

/* ── Questions ── */
.faq {
  display: grid;
  gap: 24px 64px;
  max-width: 1080px;
  margin: clamp(96px, 12vw, 152px) auto 0;
}

@media (min-width: 900px) {
  .faq {
    grid-template-columns: 240px minmax(0, 1fr);
  }
}

.faq h2 {
  font-size: clamp(26px, 3vw, 34px);
  font-weight: 650;
  letter-spacing: -0.025em;
  color: var(--text-1);
}

.faq-list {
  border-top: 1px solid var(--line-2);
}

details {
  border-bottom: 1px solid var(--line-2);
}

summary {
  position: relative;
  display: block;
  padding: 20px 40px 20px 0;
  font-size: 15.5px;
  font-weight: 600;
  color: var(--text-1);
  cursor: pointer;
  list-style: none;
}

summary::-webkit-details-marker {
  display: none;
}

/* A plus that turns into a minus. */
summary::before,
summary::after {
  content: '';
  position: absolute;
  right: 6px;
  top: 50%;
  width: 12px;
  height: 1.5px;
  background: var(--text-3);
  border-radius: 1px;
  transition: transform var(--t-base) var(--ease);
}

summary::after {
  transform: rotate(90deg);
}

details[open] summary::after {
  transform: rotate(0deg);
}

summary:hover::before,
summary:hover::after {
  background: var(--text-1);
}

details p {
  max-width: 62ch;
  padding: 0 40px 22px 0;
  font-size: 14.5px;
  line-height: 1.65;
  color: var(--text-2);
}
</style>
