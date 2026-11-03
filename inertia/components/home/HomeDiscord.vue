<script setup lang="ts">
import { Icon } from '@invadelol/ui'
import { DISCORD_URL, REPO_URL, X_URL } from '../../lib/links.js'

/**
 * The community on the home: the Discord's live counts (left out when Discord did not answer),
 * the way in, the channels people come for and the quieter ways to reach the team.
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

const X_MARK =
  'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z'

const count = (n: number) => n.toLocaleString('en-US')
const repo = REPO_URL.replace('https://github.com/', '')
</script>

<template>
  <section class="hm-sec far hm-wrap" aria-labelledby="hm-comm">
    <div class="hm-comm iv-panel lit-sheet">
      <div class="grid">
        <div>
          <h2 id="hm-comm">The Invade Discord</h2>
          <p class="lead">
            Questions, bugs and ideas all go there. We read every post, and new versions land there
            first.
          </p>
          <dl v-if="counts" class="hm-counts">
            <div>
              <dt>Members</dt>
              <dd class="iv-fig num">{{ count(counts.members) }}</dd>
            </div>
            <div>
              <dt>Online now</dt>
              <dd class="iv-fig num">
                <i class="hm-dot" aria-hidden="true" />{{ count(counts.online) }}
              </dd>
            </div>
          </dl>
          <div class="acts">
            <a
              :href="DISCORD_URL"
              target="_blank"
              rel="noreferrer"
              class="iv-btn lg"
              data-track="home_discord"
              >Join the server</a
            >
            <a
              :href="X_URL"
              target="_blank"
              rel="noreferrer"
              class="iv-btn ghost lg"
              data-track="home_x"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="X_MARK" /></svg>Follow
              @invadedotlol
            </a>
          </div>
        </div>
        <div>
          <ul class="hm-chans" aria-label="Channels">
            <li v-for="c in CHANNELS" :key="c.name">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                aria-hidden="true"
              >
                <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
              </svg>
              <b>{{ c.name }}</b
              ><span>{{ c.what }}</span>
            </li>
          </ul>
          <div class="hm-links">
            <a href="/bugs" target="_blank" rel="noreferrer" class="hm-link" data-track="home_bugs">
              <span class="ic"><Icon name="bug" :size="16" /></span>
              <span><b>Report a bug</b><small>Windows or macOS</small></span>
            </a>
            <a
              :href="REPO_URL"
              target="_blank"
              rel="noreferrer"
              class="hm-link"
              data-track="home_github"
            >
              <span class="ic"><Icon name="external" :size="16" /></span>
              <span
                ><b>Source code</b><small>{{ repo }}</small></span
              >
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
