<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Logo } from '@invadelol/ui'
import { ChevronDown, Download } from 'lucide-vue-next'
import { detectDesktopTarget, type DesktopPlatform } from '../../lib/platform.js'
import DownloadButtons from './DownloadButtons.vue'
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
  <section id="download" class="ap-section get ap-lit rise">
    <div v-reveal class="get-head ap-wrap">
      <Logo :size="56" class="get-glyph ln" />
      <h2 class="ap-display ln">Get Invade.</h2>
      <p class="ap-lead ln">
        Free for Windows and macOS<template v-if="version">, version {{ version }}</template
        >.
      </p>
      <DownloadButtons class="get-dl ln" :others="false" />
    </div>

    <div class="ap-wrap">
      <ul v-reveal class="builds iv-panel lit-sheet ap-sheet">
        <li
          v-for="(b, i) in BUILDS"
          :key="b.id"
          class="ln"
          :class="{ mine: mine === b.id }"
          :style="{ '--i': i + 3 }"
        >
          <span class="build-name">
            {{ b.name }}
            <span v-if="mine === b.id" class="iv-badge brand">This computer</span>
          </span>
          <span class="build-req">{{ b.detail }}</span>
          <a :href="`/download/${b.id}`" class="iv-btn">
            <Download :size="13" aria-hidden="true" />
            Download
          </a>
        </li>
      </ul>
    </div>

    <p v-reveal class="unsigned ap-wrap ap-fine">
      <span class="ln">
        The builds are not code-signed yet, so your system may ask once. On Windows, choose
        <em>More info</em>, then <em>Run anyway</em>. On macOS, drag Invade to Applications, then
        right-click it and choose <em>Open</em>.
      </span>
    </p>

    <div class="faq ap-wrap">
      <h3 v-reveal class="ap-h3 faq-title"><span class="ln">Questions</span></h3>
      <div class="faq-list iv-panel lit-sheet ap-sheet">
        <details v-for="item in FAQ" :key="item.q">
          <summary>
            {{ item.q }}
            <ChevronDown :size="16" aria-hidden="true" />
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
  margin-bottom: 22px;
  color: var(--brand);
}

.get-head .ap-lead {
  margin-top: 14px;
}

.get-dl {
  margin-top: 28px;
}

/* Every build, as rows in one sheet. */
.builds {
  display: grid;
  max-width: 820px;
  margin: clamp(48px, 6vw, 80px) auto 0;
}

.builds li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 2px 20px;
  padding: 16px 20px;
}

.builds li + li {
  border-top: 1px solid var(--line);
}

.build-name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  font-size: 15px;
  font-weight: 600;
  line-height: 20px;
  color: var(--text-1);
}

.build-req {
  grid-row: 2;
  font-size: 13px;
  color: var(--text-3);
}

.builds .iv-btn {
  grid-row: 1 / span 2;
  grid-column: 2;
}

.unsigned {
  max-width: 820px;
  margin-top: 16px;
}

.unsigned em {
  font-style: normal;
  color: var(--text-2);
}

/* ── Questions: rows in one sheet ── */

.faq {
  max-width: 868px;
  margin-top: clamp(96px, 11vw, 150px);
}

.faq-title {
  margin-bottom: 20px;
}

.faq-list details + details {
  border-top: 1px solid var(--line);
}

summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  min-height: 56px;
  padding: 14px 20px;
  font-size: 15px;
  font-weight: 600;
  line-height: 20px;
  color: var(--text-1);
  cursor: pointer;
  list-style: none;
  transition: background-color var(--t-fast);
}

summary:hover {
  background: var(--glint);
}

summary::-webkit-details-marker {
  display: none;
}

summary svg {
  flex: none;
  color: var(--text-3);
  transition: transform 400ms var(--ease-glide);
}

details[open] summary svg {
  transform: rotate(180deg);
}

details p {
  max-width: 44em;
  padding: 0 20px 20px;
  font-size: var(--ap-body);
  line-height: 1.6;
  color: var(--text-2);
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
      height 500ms var(--ease-glide),
      content-visibility 500ms allow-discrete;
  }

  details[open]::details-content {
    height: auto;
  }
}

.legal {
  margin-top: 40px;
  font-size: 12px;
  color: var(--text-4);
}
</style>
