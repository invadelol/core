<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { Logo } from '@invadelol/ui'
import { ArrowUpRight, Bug, Hash, Mail } from 'lucide-vue-next'
import AppHeader from '../components/AppHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { DISCORD_URL, REPO_URL, X_URL } from '../lib/links.js'

/**
 * `/contact`: the Discord first (its live counts and the channels people come for), X next to it,
 * then the quieter ways in. The email is the publisher's address that /legal already shows
 * (app/controllers/legal_controller.ts); its row is left out when none is set. The counts come
 * from Discord (app/services/discord_server.ts) and are left out when Discord did not answer.
 */
const props = defineProps<{
  email: string | null
  discord: { members: number; online: number } | null
}>()

/** The brands' own marks (24×24), drawn in the text colour like any other icon. */
const MARKS = {
  discord:
    'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z',
  x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
  github:
    'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
}

/** The server's public channels people come for, named as they are on Discord. */
const CHANNELS = [
  { name: 'q-a', what: 'Ask anything. The team marks the answer.' },
  { name: 'bug-reports', what: 'One post per bug, tagged Windows or macOS.' },
  { name: 'feature-requests', what: 'Ideas, upvoted by everyone. Planned ones get a tag.' },
  { name: 'changelog', what: 'What changed in each version.' },
  { name: 'clips', what: 'Your outplays, and your throws.' },
]

/** `invadelol/core` out of the repository's address. */
const repo = REPO_URL.replace('https://github.com/', '')

const count = (n: number) => n.toLocaleString('en-US')
</script>

<template>
  <Head title="Contact" />

  <div class="flex min-h-screen flex-col">
    <AppHeader />

    <main class="mx-auto w-full max-w-[1040px] flex-1 px-4 pt-[clamp(32px,9vh,96px)] sm:px-6">
      <h1
        class="text-[28px] font-semibold leading-tight tracking-[-0.012em] text-ink sm:text-[32px]"
      >
        Contact
      </h1>
      <p class="mt-2 text-[14px] text-ink-2">
        Questions, bugs and ideas all go to the Discord. We read every post.
      </p>

      <div class="layout mt-8">
        <!-- The Discord: who is there, and where to post. -->
        <section class="discord iv-panel lit-sheet" aria-labelledby="discord-title">
          <div class="server">
            <span class="icon" aria-hidden="true"><Logo :size="30" /></span>
            <div class="min-w-0">
              <h2 id="discord-title" class="server-name">Invade</h2>
              <p class="server-kind">
                <svg class="brand sm" viewBox="0 0 24 24" aria-hidden="true">
                  <path :d="MARKS.discord" />
                </svg>
                Discord server
              </p>
            </div>
          </div>

          <dl v-if="props.discord" class="counts">
            <div>
              <dt>Members</dt>
              <dd class="iv-fig">{{ count(props.discord.members) }}</dd>
            </div>
            <div>
              <dt>Online now</dt>
              <dd class="iv-fig">{{ count(props.discord.online) }}</dd>
            </div>
          </dl>

          <a
            :href="DISCORD_URL"
            target="_blank"
            rel="noreferrer"
            class="join iv-btn primary lg"
            data-track="contact_discord"
          >
            <svg class="brand" viewBox="0 0 24 24" aria-hidden="true">
              <path :d="MARKS.discord" />
            </svg>
            Join the server
          </a>

          <ul class="channels" aria-label="Channels">
            <li v-for="channel in CHANNELS" :key="channel.name" class="channel">
              <Hash class="hash" :size="15" :stroke-width="2" aria-hidden="true" />
              <span class="channel-name">{{ channel.name }}</span>
              <span class="channel-what">{{ channel.what }}</span>
            </li>
          </ul>
        </section>

        <div class="side">
          <!-- X: the news. -->
          <section class="x iv-panel" aria-labelledby="x-title">
            <span class="icon" aria-hidden="true">
              <svg class="brand" viewBox="0 0 24 24"><path :d="MARKS.x" /></svg>
            </span>
            <h2 id="x-title" class="x-handle">@invadedotlol</h2>
            <p class="x-what">New versions, what we are working on, and the best clips.</p>
            <a
              :href="X_URL"
              target="_blank"
              rel="noreferrer"
              class="follow iv-btn lg"
              data-track="contact_x"
            >
              Follow on X
            </a>
          </section>

          <!-- The quieter ways in. -->
          <nav class="others iv-panel" aria-label="Other ways to reach us">
            <a href="/bugs" target="_blank" rel="noreferrer" class="row" data-track="contact_bugs">
              <span class="row-icon" aria-hidden="true"
                ><Bug :size="16" :stroke-width="1.75"
              /></span>
              <span class="row-text">
                <span class="row-name">Report a bug</span>
                <span class="row-meta">#bug-reports on Discord</span>
              </span>
              <ArrowUpRight class="row-go" :size="15" aria-hidden="true" />
            </a>
            <a
              :href="REPO_URL"
              target="_blank"
              rel="noreferrer"
              class="row"
              data-track="contact_github"
            >
              <span class="row-icon" aria-hidden="true">
                <svg class="brand sm" viewBox="0 0 24 24"><path :d="MARKS.github" /></svg>
              </span>
              <span class="row-text">
                <span class="row-name">Source code</span>
                <span class="row-meta">{{ repo }} on GitHub</span>
              </span>
              <ArrowUpRight class="row-go" :size="15" aria-hidden="true" />
            </a>
            <a v-if="email" :href="`mailto:${email}`" class="row" data-track="contact_email">
              <span class="row-icon" aria-hidden="true"
                ><Mail :size="16" :stroke-width="1.75"
              /></span>
              <span class="row-text">
                <span class="row-name">Privacy and legal</span>
                <span class="row-meta">{{ email }}</span>
              </span>
              <ArrowUpRight class="row-go" :size="15" aria-hidden="true" />
            </a>
          </nav>
        </div>
      </div>
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
/* The Discord takes the wide column; X and the other ways stack beside it. */
.layout {
  display: grid;
  gap: 16px;
}

@media (min-width: 880px) {
  .layout {
    grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
    align-items: start;
  }
}

.side {
  display: grid;
  gap: 16px;
}

.brand {
  width: 18px;
  height: 18px;
  flex: none;
  fill: currentColor;
}

.brand.sm {
  width: 14px;
  height: 14px;
}

/* A raised key holding the server's or the account's mark. */
.icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 52px;
  height: 52px;
  color: var(--text-1);
  background: var(--key);
  border-radius: var(--r-md);
  box-shadow: var(--key-shadow);
}

/* ── Discord ── */
.discord {
  padding: 24px;
}

.server {
  display: flex;
  align-items: center;
  gap: 14px;
}

.server-name {
  font-size: 20px;
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: -0.012em;
  color: var(--text-1);
}

.server-kind {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  font-size: 13px;
  color: var(--text-3);
}

.counts {
  display: flex;
  gap: 40px;
  margin-top: 24px;
}

.counts dt {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}

.counts dd {
  margin-top: 6px;
  font-size: 32px;
  color: var(--text-1);
}

.join {
  margin-top: 24px;
  gap: 8px;
}

.channels {
  margin-top: 24px;
  border-top: 1px solid var(--line);
  padding-top: 8px;
}

/* One channel per line: its name as Discord shows it, then what it is for. */
.channel {
  display: grid;
  grid-template-columns: 16px auto minmax(0, 1fr);
  align-items: baseline;
  column-gap: 8px;
  padding: 9px 0;
  font-size: 13px;
  line-height: 1.45;
}

.hash {
  align-self: center;
  color: var(--text-4);
}

.channel-name {
  font-weight: 500;
  color: var(--text-1);
}

.channel-what {
  color: var(--text-3);
}

/* ── X ── */
.x {
  padding: 24px;
}

.x-handle {
  margin-top: 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
}

.x-what {
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-2);
}

.follow {
  margin-top: 20px;
}

/* ── The other ways in: one quiet row each. ── */
.others {
  padding: 6px;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 8px 10px;
  border-radius: var(--r-sm);
  transition: background-color var(--t-base) var(--ease);
}

.row:hover {
  background: var(--glint);
}

.row:focus-visible {
  outline: none;
  box-shadow: var(--focus);
}

.row-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 34px;
  height: 34px;
  color: var(--text-2);
  background: var(--inset);
  border-radius: var(--r-sm);
  box-shadow: var(--inset-shadow);
}

.row-text {
  display: grid;
  min-width: 0;
  flex: 1;
}

.row-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

.row-meta {
  font-size: 12px;
  color: var(--text-3);
  overflow-wrap: anywhere;
}

.row-go {
  flex: none;
  color: var(--text-4);
  transition: color var(--t-base) var(--ease);
}

.row:hover .row-go {
  color: var(--text-2);
}

/* The shared button's own shadow would hide the site's focus ring: keep both. */
.follow:focus-visible {
  box-shadow: var(--btn-shadow), var(--focus);
}

.join:focus-visible {
  box-shadow: var(--primary-shadow), var(--focus);
}

/* A phone: the channel's purpose goes under its name, the buttons take the width. */
@media (max-width: 479px) {
  .discord,
  .x {
    padding: 20px;
  }

  .channel {
    grid-template-columns: 16px minmax(0, 1fr);
    row-gap: 1px;
  }

  .channel-what {
    grid-column: 2;
  }

  .join,
  .follow {
    width: 100%;
    justify-content: center;
  }

  .counts dd {
    font-size: 28px;
  }
}
</style>
