<script setup lang="ts">
import { computed } from 'vue'
import { Head, usePage } from '@inertiajs/vue3'
import SiteLayout from '../components/SiteLayout.vue'
import DownloadApp from '../components/DownloadApp.vue'
import Glyph from '../components/ui/Glyph.vue'
import Icon from '../components/ui/Icon.vue'
import MoreLink from '../components/ui/MoreLink.vue'
import { patchName } from '../lib/patch.js'
import '../css/app-facet.css'

/**
 * /app, the desktop app's page (Facet): the app in one line with the download and its Home, then
 * the build in champion select and the score after each game, each beside the app's own screen,
 * then what the newest version changed and what it runs on. The screens are the app drawn with
 * fictional players.
 */
const props = defineProps<{
  version: string | null
  latest: { version: string; day: string | null; lines: string[] } | null
  discord: { members: number; online: number } | null
}>()

const page = usePage()
const patch = computed(() => {
  const v = (page.props as { patch?: string | null }).patch
  return v ? patchName(v) : null
})
const released = computed(() => {
  const v = props.version ?? props.latest?.version
  if (!v) return 'Free, for Windows and macOS'
  const day = props.latest?.version === v ? props.latest.day : null
  return `Free, version ${v}${day ? `, released ${day}` : ''}`
})
const n = (x: number) => x.toLocaleString('en-US')

const SHOTS = {
  home: {
    src: '/app-page/facet-home-1440.webp',
    srcset: '/app-page/facet-home-720.webp 720w, /app-page/facet-home-1440.webp 1440w',
    alt: "The app's Home: rank and LP, tonight's games, the last games scored out of 100, your champion pool",
  },
  live: {
    src: '/app-page/facet-live-1440.webp',
    srcset: '/app-page/facet-live-720.webp 720w, /app-page/facet-live-1440.webp 1440w',
    alt: "The app's live game: both teams lane by lane, your lane's win rate, the build path and the next skill",
  },
}
</script>

<template>
  <Head title="Invade for desktop">
    <link rel="canonical" href="https://invade.lol/app" />
  </Head>
  <SiteLayout>
    <div class="wrap">
      <section class="ap-hero">
        <Glyph :h="48" />
        <h1 class="d1 ap-title">Invade for desktop</h1>
        <p class="body ap-lead">
          It opens with League, puts the build into champion select, follows your game and scores it
          out of 100.
        </p>
        <div id="download" class="ap-dl"><DownloadApp track="app" /></div>
        <p class="meta ap-ver">{{ released }}</p>
        <span class="fr l ap-shot"
          ><img
            :src="SHOTS.home.src"
            :srcset="SHOTS.home.srcset"
            sizes="(max-width: 1180px) 100vw, 1120px"
            :alt="SHOTS.home.alt"
            fetchpriority="high"
            decoding="async"
        /></span>
      </section>

      <section class="feat3">
        <div>
          <h2 class="h1">Your build, in champion select</h2>
          <p class="body ap-p">
            The runes, spells and items that win<template v-if="patch"> on {{ patch }}</template>
            for your champion and your lane, sent to the client before the game loads.
          </p>
          <ul>
            <li>
              <Icon name="check" :size="18" />Runes imported when you lock in, or only when you ask
            </li>
            <li>
              <Icon name="check" :size="18" />The build path and the next skill on screen in game
            </li>
            <li>
              <Icon name="check" :size="18" />ARAM: Mayhem builds that follow the augments you are
              offered
            </li>
          </ul>
        </div>
        <span class="fr l"
          ><img
            :src="SHOTS.live.src"
            :srcset="SHOTS.live.srcset"
            sizes="(max-width: 1023px) 100vw, 680px"
            :alt="SHOTS.live.alt"
            loading="lazy"
            decoding="async"
        /></span>
      </section>

      <section class="feat3 rev">
        <span class="fr l"
          ><img
            :src="SHOTS.home.src"
            :srcset="SHOTS.home.srcset"
            sizes="(max-width: 1023px) 100vw, 680px"
            :alt="SHOTS.home.alt"
            loading="lazy"
            decoding="async"
        /></span>
        <div>
          <h2 class="h1">A score after every game</h2>
          <p class="body ap-p">
            Each game gets a score from 0 to 100 against the Emerald pace of your role and your
            lobby, so you see what went right without reading a scoreboard.
          </p>
          <ul>
            <li>
              <Icon name="check" :size="18" />Laning, fights, farming, vision and survival split out
            </li>
            <li><Icon name="check" :size="18" />Your LP and form for the session</li>
            <li><Icon name="check" :size="18" />The same score on invade.lol and in the app</li>
          </ul>
        </div>
      </section>

      <section class="feat3 ap-last">
        <div>
          <template v-if="latest">
            <h2 class="h1">What is new in {{ latest.version }}</h2>
            <ul class="ap-new">
              <li v-for="(l, i) in latest.lines" :key="i">
                <Icon name="check" :size="18" /><span
                  ><b>{{ l }}</b></span
                >
              </li>
            </ul>
          </template>
          <h2 v-else class="h1">Every release</h2>
          <MoreLink href="/app/changelog" label="Every release" class="ap-more" />
        </div>
        <div class="card ap-sys">
          <span class="h3">System</span>
          <div class="col ap-rows">
            <div class="row">
              <span class="meta">Windows</span><span class="h5">10 and 11, 64-bit</span>
            </div>
            <div class="row">
              <span class="meta">macOS</span><span class="h5">Apple silicon and Intel</span>
            </div>
            <div class="row"><span class="meta">Price</span><span class="h5">Free</span></div>
            <div v-if="discord" class="row">
              <span class="meta">Discord</span
              ><span class="h5 num"
                >{{ n(discord.members) }} players, {{ n(discord.online) }} online</span
              >
            </div>
          </div>
        </div>
      </section>
    </div>
  </SiteLayout>
</template>
