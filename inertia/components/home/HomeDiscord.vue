<script setup lang="ts">
import { Icon } from '@invadelol/ui'
import { DISCORD_URL, REPO_URL, X_URL } from '../../lib/links.js'

/**
 * The community on the home, in one sheet: the Discord's live counts (left out when Discord did
 * not answer) and the way in, the channels people come for, and the quieter ways to reach the
 * team (X, bug reports, the source).
 */
defineProps<{ counts: { members: number; online: number } | null }>()

/** The server's public channels, named as they are on Discord (as on /contact). */
const CHANNELS = [
  { name: 'q-a', what: 'Ask anything, the team marks the answer' },
  { name: 'bug-reports', what: 'One post per bug, tagged Windows or macOS' },
  { name: 'feature-requests', what: 'Ideas, upvoted by everyone' },
  { name: 'changelog', what: 'What changed in each version' },
  { name: 'clips', what: 'Your outplays, and your throws' },
]

const DISCORD_MARK =
  'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z'
const X_MARK =
  'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z'

const count = (n: number) => n.toLocaleString('en-US')
const repo = REPO_URL.replace('https://github.com/', '')
</script>

<template>
  <section class="dv-sec hm-dc rd-card" aria-labelledby="hm-comm">
    <div class="top">
      <span class="ic" aria-hidden="true"
        ><svg viewBox="0 0 24 24"><path :d="DISCORD_MARK" /></svg
      ></span>
      <div class="txt">
        <h2 id="hm-comm">The Invade Discord</h2>
        <p class="num">
          <template v-if="counts"
            >{{ count(counts.members) }} members, {{ count(counts.online) }} online.
          </template>
          Questions, bugs and ideas go there, and new versions land there first.
        </p>
      </div>
      <div class="acts">
        <a
          :href="X_URL"
          target="_blank"
          rel="noreferrer"
          class="iv-btn"
          data-track="home_x"
          aria-label="Follow @invadedotlol on X"
        >
          <svg class="x" viewBox="0 0 24 24" aria-hidden="true"><path :d="X_MARK" /></svg>Follow
        </a>
        <a
          :href="DISCORD_URL"
          target="_blank"
          rel="noreferrer"
          class="iv-btn"
          data-track="home_discord"
          >Join the server</a
        >
      </div>
    </div>
    <div class="bot">
      <ul class="chans" aria-label="Channels">
        <li v-for="c in CHANNELS" :key="c.name" :title="c.what">
          <b>#{{ c.name }}</b
          ><span>{{ c.what }}</span>
        </li>
      </ul>
      <div class="links">
        <a href="/bugs" target="_blank" rel="noreferrer" class="dv-more" data-track="home_bugs"
          ><Icon name="bug" :size="14" />Report a bug</a
        >
        <a
          :href="REPO_URL"
          target="_blank"
          rel="noreferrer"
          class="dv-more"
          data-track="home_github"
          ><Icon name="external" :size="14" />{{ repo }}</a
        >
      </div>
    </div>
  </section>
</template>
