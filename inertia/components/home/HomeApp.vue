<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import { Icon, Logo, PerfDial } from '@invadelol/ui'
import AppWindow from '../app-page/AppWindow.vue'
import Shot from '../app-page/Shot.vue'
import { detectDesktopTarget, type DesktopPlatform } from '../../lib/platform.js'

/**
 * The desktop app on the home: what it is and the way to it beside its Home in its window, then
 * three moments of a game, each a real capture or the app's own component. The download follows
 * the computer (Windows, else macOS); a phone, or the server, is sent to the app's page.
 */
const target = ref<DesktopPlatform | null | undefined>(undefined)
onMounted(async () => (target.value = await detectDesktopTarget()))

const isMac = () => target.value === 'mac-arm' || target.value === 'mac-intel'

/** The dials the app page shows: the best of the winners, the third, the best of the losers. */
const DIALS = [
  { score: 69, tag: 'mvp' as const, rank: 1 },
  { score: 63, tag: '' as const, rank: 3 },
  { score: 41, tag: 'ace' as const, rank: 1 },
]
</script>

<template>
  <section class="dv-sec hm-appx" aria-labelledby="hm-app">
    <div class="hm-app iv-dark">
      <div class="l">
        <Logo :size="26" />
        <h2 id="hm-app">Invade for desktop</h2>
        <p>Free, for Windows and macOS. It opens with League and stays out of the way.</p>
        <div class="cta">
          <template v-if="target === null">
            <Link href="/app" prefetch class="iv-btn primary lg" data-track="home_app_page">
              <Icon name="download" :size="16" />Get the desktop app
            </Link>
          </template>
          <template v-else-if="isMac()">
            <a
              :href="`/download/${target}`"
              class="iv-btn primary lg"
              data-track="home_download_mac"
            >
              <Icon name="download" :size="16" />Download for macOS
            </a>
            <a href="/download/windows" class="iv-btn lg" data-track="home_download_windows"
              >Windows</a
            >
          </template>
          <template v-else>
            <a
              href="/download/windows"
              class="iv-btn primary lg"
              data-track="home_download_windows"
            >
              <Icon name="download" :size="16" />Download for Windows
            </a>
            <Link href="/app#download" class="iv-btn lg" data-track="home_download_mac">macOS</Link>
          </template>
        </div>
      </div>
      <div class="r">
        <AppWindow
          name="home"
          alt="The Invade desktop app's Home: rank and LP, the last games with their scores, and performance"
          sizes="(min-width: 1088px) 820px, 760px"
        />
      </div>
    </div>

    <div class="hm-moments">
      <div class="hm-mo">
        <div class="vis draft iv-dark">
          <Shot name="live-draft" alt="" sizes="(min-width: 896px) 830px, 200vw" />
        </div>
        <b>Read the lobby in champ select</b>
        <small>Both teams' ranks and picks, and the strongest picks for your role</small>
      </div>
      <div class="hm-mo">
        <div class="vis game iv-dark">
          <Shot name="game" alt="" sizes="(min-width: 896px) 336px, 100vw" />
          <div class="ov"><Shot name="ov-perf" alt="" sizes="168px" /></div>
        </div>
        <b>Your pace against a rank you pick</b>
        <small>Timers and your next item, on the game</small>
      </div>
      <div class="hm-mo">
        <div class="vis dials iv-dark">
          <PerfDial
            v-for="d in DIALS"
            :key="d.score"
            :score="d.score"
            :rank="d.rank"
            :tag="d.tag"
          />
        </div>
        <b>Each game scored</b>
        <small>All ten players, against the pace of their role and the lobby</small>
      </div>
    </div>
  </section>
</template>
