<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { MatchRow, PlayerHeader } from '@invadelol/ui'
import AppWindow from './AppWindow.vue'
import WindowFrame from './WindowFrame.vue'
import { DEMO, HOME_GAMES, PROFILE } from './demo.js'
import { vReveal } from './reveal.js'

/**
 * invade.lol and the app side by side: the same profile drawn by the same shared components, on
 * the website (in the site's theme) and in the app's window.
 */
const games = HOME_GAMES.map((g) => g.game)
const rows = HOME_GAMES.slice(0, 4)

/** Dates read in the visitor's time zone: the rows are drawn in the browser only. */
const mounted = ref(false)
onMounted(() => (mounted.value = true))
</script>

<template>
  <section id="invade-lol" class="ap-section page">
    <header v-reveal class="ap-head">
      <div>
        <p class="ap-kicker">Synced with invade.lol</p>
        <h2>The same profile, in the app and on the web</h2>
      </div>
      <p>
        Every game you finish is on invade.lol the moment it ends, scored the same way. With League
        closed, the app reads its profiles and games from invade.lol.
      </p>
    </header>

    <div class="sync">
      <div v-reveal class="ap-frame web">
        <WindowFrame :url="`invade.lol/${DEMO.name}-${DEMO.tag}`" light>
          <div class="web-page iv-root">
            <template v-if="mounted">
              <PlayerHeader :profile="PROFILE" :games="games" />
              <ul class="rows">
                <li v-for="r in rows" :key="r.game.gameId">
                  <MatchRow :game="r.game" :score="r.game.score" :lp="r.lp" />
                </li>
              </ul>
            </template>
            <div v-else class="hold" />
          </div>
        </WindowFrame>
      </div>

      <div v-reveal class="ap-frame app">
        <AppWindow active="profile" :sidebar="false">
          <div class="app-page iv-root">
            <h3>Profile</h3>
            <template v-if="mounted">
              <PlayerHeader :profile="PROFILE" :games="games" />
              <ul class="rows">
                <li v-for="r in rows" :key="r.game.gameId">
                  <MatchRow :game="r.game" :score="r.game.score" :lp="r.lp" />
                </li>
              </ul>
            </template>
            <div v-else class="hold" />
          </div>
        </AppWindow>
      </div>
    </div>

    <ul class="ap-points" style="--n: 3">
      <li v-reveal>
        <b>Published as you play</b>
        <p>
          Finished games only, trimmed to what a profile shows. Nothing is sent during champ select
          or a game.
        </p>
      </li>
      <li v-reveal>
        <b>League closed, still there</b>
        <p>Profiles, match details, scores and every player you click open from invade.lol.</p>
      </li>
      <li v-reveal>
        <b>Search anyone</b>
        <p>
          Ctrl K (⌘K on a Mac) finds a page, a champion or a Riot ID, with players suggested as you
          type.
        </p>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.sync {
  display: grid;
  gap: 16px;
  align-items: start;
}

@media (min-width: 1024px) {
  .sync {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  }
}

/* The website: the site's own theme, its page ink. */
.web {
  background: var(--ink-1);
}

.web-page,
.app-page {
  display: grid;
  gap: 14px;
  padding: 20px;
}

@media (max-width: 639px) {
  .web-page {
    padding: 12px 10px 16px;
  }
}

.hold {
  min-height: 420px;
}

.rows {
  display: grid;
  gap: 6px;
}

.app-page {
  padding: 4px 24px 24px;
}

.app-page h3 {
  padding: 10px 0 4px;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
</style>
