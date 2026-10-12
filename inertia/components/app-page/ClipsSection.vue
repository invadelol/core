<script setup lang="ts">
import { ref } from 'vue'
import { Icon, Switch } from '@invadelol/ui'
import WindowFrame from './WindowFrame.vue'
import { CLIPS } from './demo.js'
import { vReveal } from './reveal.js'

/**
 * Recordings: one game as the app files it (its header, the full game and its clips), and the
 * recorder's settings beside it, with the 0.2.9 all-PC-sound switch, off by default as it ships.
 */
const allSound = ref(false)
const autoRecord = ref(true)

const FILTERS = [
  { label: 'All', n: null, on: true },
  { label: 'Kills', n: 2 },
  { label: 'Deaths', n: 0 },
  { label: 'Objectives', n: 1 },
  { label: 'Saved', n: 1 },
  { label: 'Full games', n: 1 },
]
</script>

<template>
  <section id="clips" class="ap-section page">
    <header v-reveal class="ap-head">
      <div>
        <p class="ap-kicker">Recordings</p>
        <h2>Your best plays, clipped while you play</h2>
      </div>
      <p>
        Games record on their own, on your graphics card's encoder. Kills, objectives and the
        moments you save with a hotkey become clips, filed under the game they came from.
      </p>
    </header>

    <div class="clips">
      <div v-reveal class="ap-frame">
        <WindowFrame>
          <div class="rec iv-root">
            <div class="rec-head">
              <h3>Recordings</h3>
              <span class="rec-used">4.9 GB used</span>
            </div>
            <div class="iv-seg rec-filters">
              <button v-for="f in FILTERS" :key="f.label" type="button" :class="{ on: f.on }" tabindex="-1">
                {{ f.label }}<small v-if="f.n !== null">{{ f.n }}</small>
              </button>
            </div>

            <div class="rec-game">
              <img :src="`/cdn/champion/64.png`" alt="" width="36" height="36" />
              <span class="rec-name"><b>Lee Sin</b><small>Summoner's Rift · Today, 9:40 PM</small></span>
              <span class="rec-kda"><b>11<i>/</i>2<i>/</i>15</b><small>Win · 31:14</small></span>
              <span class="rec-count">4 clips</span>
              <Icon name="star" :size="16" class="rec-star" />
            </div>

            <ul class="rec-grid">
              <li v-for="clip in CLIPS" :key="clip.title" class="rec-card">
                <span class="rec-thumb">
                  <img :src="clip.img" alt="" width="480" height="270" loading="lazy" decoding="async" />
                  <span class="rec-len">{{ clip.length }}</span>
                </span>
                <b>{{ clip.title }}</b>
                <small>{{ clip.meta }}</small>
              </li>
            </ul>
          </div>
        </WindowFrame>
      </div>

      <aside v-reveal class="settings iv-panel">
        <h3>Recording</h3>
        <ul>
          <li>
            <span><b>Auto-record games</b><small>Highlights, the full game, or both</small></span>
            <Switch v-model="autoRecord" label="Auto-record games" />
          </li>
          <li>
            <span>
              <b>Record all PC sound</b>
              <small>Discord, music and any other app in your clips, at their own volume. Off by default.</small>
            </span>
            <Switch v-model="allSound" label="Record all PC sound" />
          </li>
          <li>
            <span><b>Save a moment</b><small>The last seconds, as a clip</small></span>
            <span class="keys"><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>H</kbd></span>
          </li>
          <li>
            <span><b>Folder</b><small>One folder per game. Starred games and favorite clips are never cleaned up.</small></span>
          </li>
        </ul>
        <p class="path">~/Movies/Invade<small>Videos\Invade on Windows</small></p>
      </aside>
    </div>

    <ul class="ap-points" style="--n: 3">
      <li v-reveal>
        <b>Nothing to start</b>
        <p>Recording starts a few seconds into the game and stops when it ends. Nothing to press.</p>
      </li>
      <li v-reveal>
        <b>Cut, not re-encoded</b>
        <p>Nearby moments merge into one clip, cut from the recording without encoding it again.</p>
      </li>
      <li v-reveal>
        <b>Favorites stay</b>
        <p>Star a game or a clip and it is kept when the storage limit clears the oldest ones.</p>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.clips {
  display: grid;
  gap: 16px;
}

@media (min-width: 1024px) {
  .clips {
    grid-template-columns: minmax(0, 1fr) 320px;
    align-items: start;
  }
}

/* ── The Recordings page, as the app draws it ── */
.rec {
  display: grid;
  gap: 14px;
  padding: 18px 24px 26px;
  font-size: 13px;
}

@media (max-width: 639px) {
  .rec {
    padding: 14px 12px 18px;
  }
}

.rec-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.rec-head h3 {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.rec-used {
  font-size: 13px;
  color: var(--text-3);
}

.rec-filters {
  justify-self: start;
  max-width: 100%;
  overflow: hidden;
  flex-wrap: nowrap;
}

.rec-filters small {
  margin-left: 4px;
  font-size: 11.5px;
  color: var(--text-4);
}

.rec-game {
  position: relative;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto auto 20px;
  align-items: center;
  column-gap: 14px;
  min-height: 52px;
  margin-top: 4px;
  padding: 0 14px 0 16px;
  background:
    linear-gradient(rgb(var(--win-rgb) / 0.06), rgb(var(--win-rgb) / 0.06)),
    var(--surface-1);
  border-radius: var(--r-sm);
  box-shadow: var(--hi);
}

.rec-game::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--win);
  border-radius: var(--r-sm) 0 0 var(--r-sm);
}

.rec-game img {
  width: 36px;
  height: 36px;
  border-radius: var(--r-sm);
}

.rec-name,
.rec-kda {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.rec-game b {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.rec-game small {
  overflow: hidden;
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-3);
}

.rec-kda i {
  margin: 0 4px;
  font-style: normal;
  font-weight: 400;
  color: var(--text-4);
}

.rec-count {
  font-size: 12px;
  color: var(--text-3);
}

.rec-star {
  color: var(--gold-c);
}

.rec-star :deep(path) {
  fill: rgb(var(--gold-rgb) / 0.3);
}

@media (max-width: 639px) {
  .rec-game {
    grid-template-columns: 36px minmax(0, 1fr) auto;
  }

  .rec-count,
  .rec-star {
    display: none;
  }
}

.rec-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 16px;
}

@media (max-width: 639px) {
  .rec-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
}

.rec-card {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.rec-thumb {
  position: relative;
  display: block;
  margin-bottom: 6px;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  background: var(--well);
  border-radius: var(--r-sm);
  box-shadow:
    0 2px 4px rgb(0 0 0 / 0.4),
    0 10px 24px -12px rgb(0 0 0 / 0.8);
}

.rec-thumb::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.12),
    inset 0 0 0 1px rgb(255 255 255 / 0.07);
}

.rec-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.rec-len {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 0 5px;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  color: #fff;
  background: rgb(0 0 0 / 0.72);
  border-radius: var(--r-xs);
}

.rec-card b {
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.rec-card small {
  overflow: hidden;
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-3);
}

/* ── The recorder's settings ── */
.settings {
  padding: 18px 20px 20px;
}

.settings h3 {
  margin-bottom: 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
}

.settings li {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid var(--line);
}

.settings li > span:first-child {
  display: grid;
  flex: 1;
  gap: 3px;
}

.settings b {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-1);
}

.settings small {
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--text-3);
}

.keys {
  display: flex;
  gap: 4px;
}

kbd {
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  font: 500 11.5px var(--font);
  color: var(--text-2);
  background: var(--surface-3);
  border-radius: var(--r-xs);
}

.path small {
  display: block;
  margin-top: 2px;
  font-family: var(--font);
  font-size: 11.5px;
}

.path {
  margin-top: 14px;
  padding: 9px 12px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 12.5px;
  color: var(--text-2);
  background: var(--inset);
  border-radius: var(--r-sm);
  box-shadow: var(--inset-shadow);
}
</style>
