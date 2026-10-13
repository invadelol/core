<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Logo } from '@invadelol/ui'
import { detectDesktopTarget, type DesktopPlatform } from '../../lib/platform.js'
import DownloadPill from './DownloadPill.vue'
import { vReveal } from './motion'

/** The download for this computer, every build with its requirements, then the questions. */
defineProps<{ version: string | null }>()

const BUILDS: Array<{ id: DesktopPlatform; name: string; detail: string }> = [
  { id: 'windows', name: 'Windows', detail: 'Windows 10 or later, 64-bit' },
  { id: 'mac-arm', name: 'macOS, Apple silicon', detail: 'macOS 13 or later, M1 and later' },
  { id: 'mac-intel', name: 'macOS, Intel', detail: 'macOS 13 or later' },
]

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
    a: 'Windows 10 or later (64-bit), and macOS 13 or later on Apple silicon and Intel Macs. Recording needs Windows 10 version 1903 or later, and the Screen Recording permission on macOS.',
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
  <section id="download" class="ap-section get">
    <div v-reveal class="get-head ap-wrap">
      <Logo :size="56" class="get-glyph ln" />
      <h2 class="get-title ln">Get Invade.</h2>
      <p class="ap-lead ln">
        Free for Windows and macOS<template v-if="version">, version {{ version }}</template
        >.
      </p>
      <DownloadPill class="get-dl ln" big :others="false" />
    </div>

    <ul v-reveal class="builds ap-wrap">
      <li
        v-for="(b, i) in BUILDS"
        :key="b.id"
        class="ln"
        :class="{ mine: mine === b.id }"
        :style="{ '--i': i + 3 }"
      >
        <span class="build-name">
          {{ b.name }}
          <em v-if="mine === b.id">This computer</em>
        </span>
        <span class="build-req">{{ b.detail }}</span>
        <a :href="`/download/${b.id}`" class="ap-link">
          Download
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m6 3.5 4.5 4.5L6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" />
          </svg>
        </a>
      </li>
    </ul>

    <p v-reveal class="unsigned ap-wrap ap-fine">
      <span class="ln">
        The builds are not code-signed yet, so your system may ask once. On Windows, choose
        <em>More info</em>, then <em>Run anyway</em>. On macOS, drag Invade to Applications, then
        right-click it and choose <em>Open</em>.
      </span>
    </p>

    <div class="faq ap-wrap">
      <h3 v-reveal class="ap-h3 faq-title"><span class="ln">Questions</span></h3>
      <div class="faq-list">
        <details v-for="item in FAQ" :key="item.q">
          <summary>
            {{ item.q }}
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 6 8 10.5 12.5 6" /></svg>
          </summary>
          <p>{{ item.a }}</p>
        </details>
      </div>
      <p class="legal ap-fine">
        Invade isn’t endorsed by Riot Games and doesn’t reflect the views or opinions of Riot Games
        or anyone officially involved in producing or managing Riot Games properties. Riot Games,
        League of Legends and all associated properties are trademarks or registered trademarks of
        Riot Games, Inc.
      </p>
    </div>
  </section>
</template>

<style scoped>
.get-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.get-glyph {
  margin-bottom: 24px;
  color: var(--brand);
}

.get-title {
  font-size: clamp(56px, 6.6vw, 96px);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.045em;
}

.get-head .ap-lead {
  margin-top: 16px;
}

.get-dl {
  margin-top: 34px;
}

.builds {
  display: grid;
  max-width: 820px;
  margin-top: clamp(56px, 7vw, 88px);
}

.builds li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px 24px;
  padding: 22px 4px;
  border-top: 1px solid var(--line-2);
}

.builds li:last-child {
  border-bottom: 1px solid var(--line-2);
}

.build-name {
  font-size: 19px;
  font-weight: 600;
  color: var(--text-1);
}

.build-name em {
  display: inline-block;
  margin-left: 10px;
  white-space: nowrap;
  font-size: 13px;
  font-style: normal;
  font-weight: 600;
  color: var(--brand-hi);
}

.build-req {
  grid-row: 2;
  font-size: 15px;
  color: var(--ap-grey);
}

.builds .ap-link {
  grid-row: 1 / span 2;
  grid-column: 2;
}

.unsigned {
  max-width: 820px;
  margin-top: 22px;
}

.unsigned em {
  font-style: normal;
  color: var(--text-2);
}

/* ── Questions ── */

.faq {
  max-width: 820px;
  margin-top: clamp(110px, 12vw, 170px);
}

.faq-title {
  margin-bottom: 28px;
}

.faq-list details {
  border-top: 1px solid var(--line-2);
}

.faq-list details:last-child {
  border-bottom: 1px solid var(--line-2);
}

summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  min-height: 68px;
  padding: 18px 4px;
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-1);
  cursor: pointer;
  list-style: none;
}

summary::-webkit-details-marker {
  display: none;
}

summary svg {
  flex: none;
  width: 18px;
  height: 18px;
  fill: none;
  stroke: var(--text-3);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 400ms var(--ap-ease);
}

details[open] summary svg {
  transform: rotate(180deg);
}

details p {
  max-width: 40em;
  padding: 0 4px 24px;
  font-size: 17px;
  font-weight: 500;
  line-height: 1.55;
  color: var(--ap-grey);
}

/* The answer opens smoothly where the browser can animate to the content's height. */
@supports (interpolate-size: allow-keywords) {
  .faq-list {
    interpolate-size: allow-keywords;
  }

  details::details-content {
    height: 0;
    overflow: clip;
    transition:
      height 500ms var(--ap-ease),
      content-visibility 500ms allow-discrete;
  }

  details[open]::details-content {
    height: auto;
  }
}

.legal {
  margin-top: 56px;
  font-size: 12px;
  color: var(--text-4);
}
</style>
