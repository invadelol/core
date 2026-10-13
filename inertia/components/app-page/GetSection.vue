<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Download } from 'lucide-vue-next'
import { detectDesktopTarget, type DesktopPlatform } from '../../lib/platform.js'

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

/** The light under the pointer, on the sheet of builds. */
function onPointer(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  const r = el.getBoundingClientRect()
  el.style.setProperty('--mx', `${e.clientX - r.left}px`)
  el.style.setProperty('--my', `${e.clientY - r.top}px`)
}

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
  <section id="download" class="get page">
    <div class="get-main">
      <div class="get-copy">
        <p class="kicker">Download</p>
        <h2>Get Invade.</h2>
        <p class="get-lead">
          Free for Windows and macOS<template v-if="version">, version {{ version }}</template
          >. No account: it reads your profile from the League client on this computer.
        </p>
        <p class="get-also">
          Also in the app: lobby scouting on the Live tab, a page for every champion with builds and
          matchups, a tier list, favorites, and 12 languages.
        </p>
      </div>

      <div class="get-side">
        <ul class="get-rows" @pointermove="onPointer">
          <li v-for="target in downloads" :key="target.id" :class="{ mine: mine === target.id }">
            <span class="get-name">
              <b>
                {{ target.name }}
                <span v-if="mine === target.id" class="get-this">This computer</span>
              </b>
              <small>{{ target.detail }}</small>
            </span>
            <a :href="`/download/${target.id}`" class="get-btn">
              <Download :size="14" :stroke-width="2" />
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
    </div>

    <div class="faq">
      <h2>Questions</h2>
      <div class="faq-list">
        <details v-for="item in FAQ" :key="item.q">
          <summary>{{ item.q }}</summary>
          <p>{{ item.a }}</p>
        </details>
      </div>
    </div>
  </section>
</template>

<style scoped>
.get {
  padding-top: clamp(96px, 12vw, 168px);
  padding-bottom: clamp(48px, 6vw, 96px);
}

.get-main {
  display: grid;
  gap: 40px 64px;
  align-items: start;
}

@media (min-width: 1024px) {
  .get-main {
    grid-template-columns: minmax(0, 1fr) minmax(0, 560px);
  }
}

.kicker {
  margin-bottom: 22px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-3);
}

.get-copy h2 {
  font-size: clamp(30px, 2.6vw, 40px);
  font-weight: 640;
  line-height: 1.06;
  letter-spacing: -0.035em;
  color: var(--text-1);
}

.get-lead {
  max-width: 30em;
  margin-top: 18px;
  font-size: 15.5px;
  line-height: 1.6;
  color: var(--text-2);
  text-wrap: pretty;
}

.get-also {
  max-width: 30em;
  margin-top: 14px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-3);
  text-wrap: pretty;
}

/* The builds: one sheet, the violet light following the pointer over it. */
.get-rows {
  --mx: 80%;
  --my: 0%;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(
      420px circle at var(--mx) var(--my),
      rgb(var(--brand-rgb) / 0.07),
      transparent 70%
    ),
    var(--sheen), var(--surface-1);
  border-radius: var(--r-lg);
  box-shadow: var(--lit);
}

.get-rows li {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 72px;
  padding: 12px 14px 12px 22px;
  border-bottom: 1px solid var(--line);
}

.get-rows li:last-child {
  border-bottom: 0;
}

.get-name {
  display: grid;
  flex: 1;
  gap: 3px;
  min-width: 0;
}

.get-name b {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
}

.get-this {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  color: var(--brand-hi);
}

[data-theme='light'] .get-this {
  color: var(--brand);
}

.get-name small {
  font-size: 13px;
  color: var(--text-3);
}

.get-btn {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 14px 0 12px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-1);
  background: var(--btn);
  border-radius: 8px;
  box-shadow: var(--btn-shadow);
  transition:
    background-color 160ms,
    transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
}

.get-btn:hover {
  background: var(--btn-hover);
}

.get-btn:active {
  transform: scale(0.98);
}

.mine .get-btn {
  color: var(--ink-0);
  background: var(--text-1);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.3);
}

[data-theme='light'] .mine .get-btn {
  color: #fff;
  background: #14151c;
}

@media (prefers-color-scheme: light) {
  [data-theme='system'] .mine .get-btn {
    color: #fff;
    background: #14151c;
  }

  [data-theme='system'] .get-this {
    color: var(--brand);
  }
}

.get-note {
  margin-top: 18px;
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
  margin-top: clamp(96px, 12vw, 152px);
}

@media (min-width: 1024px) {
  .faq {
    grid-template-columns: minmax(0, 1fr) minmax(0, 760px);
  }
}

.faq h2 {
  font-size: clamp(26px, 2.2vw, 32px);
  font-weight: 640;
  letter-spacing: -0.03em;
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
  transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
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
